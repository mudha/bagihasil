
import { NextRequest, NextResponse } from 'next/server'
import { parseTransferProof } from '@/lib/gemini'

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
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipe file tidak valid. Hanya JPG dan PNG yang diperbolehkan.' },
                { status: 400 }
            )
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'Ukuran file terlalu besar. Maksimal 5MB.' },
                { status: 400 }
            )
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        // Simple 10s timeout for AI
        const withTimeout = (promise: Promise<any>, ms: number) => {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), ms)
                )
            ]);
        };

        // AI Parsing with Gemini only
        const result = await withTimeout(
            parseTransferProof(buffer, file.type),
            10000 // 10 seconds max
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
