
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        // Find the latest unit code
        const latestUnit = await prisma.unit.findFirst({
            orderBy: {
                code: 'desc'
            },
            select: {
                code: true
            }
        })

        let nextCode = 'UNT-001'

        if (latestUnit?.code) {
            // Try standard UNT-XXX format
            const match = latestUnit.code.match(/UNT-(\d+)/)
            if (match) {
                const sequence = parseInt(match[1])
                nextCode = `UNT-${String(sequence + 1).padStart(3, '0')}`
            } else {
                // Try generic number at end
                const numberMatch = latestUnit.code.match(/(\d+)$/)
                if (numberMatch) {
                    const num = parseInt(numberMatch[1])
                    const prefix = latestUnit.code.substring(0, latestUnit.code.length - numberMatch[1].length)
                    nextCode = `${prefix}${String(num + 1).padStart(numberMatch[1].length, '0')}`
                }
            }
        }

        return NextResponse.json({ code: nextCode })
    } catch (error) {
        console.error('Error fetching next unit code:', error)
        return NextResponse.json(
            { error: 'Gagal mengambil kode unit berikutnya' },
            { status: 500 }
        )
    }
}
