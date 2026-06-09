import { NextRequest, NextResponse } from 'next/server'
import { parseTransferProofs } from '@/lib/gemini'
import { requireAdmin } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    try {
        const formData = await request.formData()

        // Handle multiple files
        const filesEntry = formData.getAll('files') as File[]
        const singleFileEntry = formData.get('file') as File | null

        let files: File[] = []
        if (filesEntry.length > 0) {
            files = filesEntry
        } else if (singleFileEntry) {
            files = [singleFileEntry]
        }

        if (files.length === 0) {
            return NextResponse.json(
                { error: 'Tidak ada file yang diupload' },
                { status: 400 }
            )
        }

        // Validate file types and sizes
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
        const MAX_SIZE = 5 * 1024 * 1024 // 5MB

        const processedFiles: { buffer: Buffer; mimeType: string }[] = []

        for (const file of files) {
            if (!validTypes.includes(file.type)) {
                return NextResponse.json(
                    { error: `Tipe file ${file.name} tidak valid. Hanya JPG dan PNG.` },
                    { status: 400 }
                )
            }
            if (file.size > MAX_SIZE) {
                return NextResponse.json(
                    { error: `File ${file.name} terlalu besar. Maksimal 5MB.` },
                    { status: 400 }
                )
            }
            const buffer = Buffer.from(await file.arrayBuffer())
            processedFiles.push({ buffer, mimeType: file.type })
        }

        // Simple 20s timeout for AI (increased for multi-file)
        const withTimeout = (promise: Promise<any>, ms: number) => {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), ms)
                )
            ]);
        };

        // AI Parsing with Gemini
        const result = await withTimeout(
            parseTransferProofs(processedFiles),
            55000 // 55 seconds max
        );

        return NextResponse.json({
            success: true,
            data: result
        })

    } catch (error: any) {
        console.error('Error in parsing receipt:', error)
        return NextResponse.json(
            { error: error.message || 'Gagal memproses gambar' },
            { status: 500 }
        )
    }
}
