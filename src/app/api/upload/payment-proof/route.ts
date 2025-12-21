import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json(
                { error: 'Tidak ada file yang diupload' },
                { status: 400 }
            )
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipe file tidak valid. Hanya JPG, PNG, dan PDF yang diperbolehkan.' },
                { status: 400 }
            )
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024 // 5MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'Ukuran file terlalu besar. Maksimal 5MB.' },
                { status: 400 }
            )
        }

        // Generate unique filename
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 8)
        const extension = file.name.split('.').pop()
        const filename = `proof_${timestamp}_${randomString}.${extension}`

        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'payment-proofs')
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true })
        }

        // Convert file to buffer and save
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const filePath = path.join(uploadDir, filename)
        await writeFile(filePath, buffer)

        // Return the public URL
        const publicUrl = `/uploads/payment-proofs/${filename}`

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: filename
        })
    } catch (error) {
        console.error('Error uploading file:', error)
        return NextResponse.json(
            { error: 'Gagal mengupload file' },
            { status: 500 }
        )
    }
}
