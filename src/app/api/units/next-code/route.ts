import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const investorId = searchParams.get('investorId')

        let prefix = 'UNT'

        if (investorId && investorId !== 'all') {
            const investor = await prisma.investor.findUnique({
                where: { id: investorId },
                select: { name: true }
            })

            if (investor && investor.name) {
                // Get first name or first 3 chars of name
                const nameParts = investor.name.split(' ')
                const rawPrefix = nameParts[0].substring(0, 3).toUpperCase()
                prefix = `UNT-${rawPrefix}`
            }
        }

        // Find the latest unit code matching the prefix
        // We use startsWith to find related codes
        const latestUnit = await prisma.unit.findFirst({
            where: {
                code: {
                    startsWith: prefix
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                code: true
            }
        })

        let nextCode = `${prefix}-001`

        if (latestUnit?.code) {
            // Try to extract the number part
            // Example: UNT-WAH-007 -> 007
            // We look for the last sequence of digits
            const match = latestUnit.code.match(/(\d+)$/)

            if (match) {
                const lastNumStr = match[1]
                const lastNum = parseInt(lastNumStr)
                const nextNum = lastNum + 1

                // Preserve the padding length, default to 3
                const padLength = Math.max(lastNumStr.length, 3)
                nextCode = `${prefix}-${String(nextNum).padStart(padLength, '0')}`
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
