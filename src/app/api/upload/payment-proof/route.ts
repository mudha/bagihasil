import { NextRequest, NextResponse } from 'next/server'
import ImageKit from 'imagekit'

// Configure ImageKit
const imagekit = new ImageKit({
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
    urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT!,
})

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
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipe file tidak valid. Hanya JPG, PNG, dan WEBP yang diperbolehkan.' },
                { status: 400 }
            )
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'Ukuran file terlalu besar. Maksimal 10MB.' },
                { status: 400 }
            )
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Upload to ImageKit
        const uploadResult = await new Promise((resolve, reject) => {
            imagekit.upload({
                file: buffer, // required
                fileName: file.name, // required
                folder: '/profit-sharing-app/payment-proofs',
                useUniqueFileName: true,
            }, (error, result) => {
                if (error) reject(error)
                else resolve(result)
            })
        }) as any

        return NextResponse.json({
            success: true,
            url: uploadResult.url,
            publicId: uploadResult.fileId, // imagekit uses fileId
            filename: uploadResult.name
        })
    } catch (error) {
        console.error('Error uploading to ImageKit:', error)
        return NextResponse.json(
            { error: 'Gagal mengupload file ke Cloud' },
            { status: 500 }
        )
    }
}
