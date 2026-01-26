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
                code: 'desc'
            },
            select: {
                code: true
            }
        })

        // Initial guess based on latest code
        let nextCodeSuffix = 1

        if (latestUnit?.code) {
            const match = latestUnit.code.match(/(\d+)$/)
            if (match) {
                const lastNumStr = match[1]
                nextCodeSuffix = parseInt(lastNumStr) + 1
            }
        }

        // Loop to find a truly available code
        let isUnique = false
        let attempts = 0
        let finalCode = ''

        while (!isUnique && attempts < 10) {
            const suffix = String(nextCodeSuffix).padStart(3, '0') // Always pad to at least 3
            finalCode = `${prefix}-${suffix}`

            const existing = await prisma.unit.findUnique({
                where: { code: finalCode }
            })

            if (!existing) {
                isUnique = true
            } else {
                nextCodeSuffix++
                attempts++
            }
        }

        return NextResponse.json({ code: finalCode })
    } catch (error) {
        console.error('Error fetching next unit code:', error)
        return NextResponse.json(
            { error: 'Gagal mengambil kode unit berikutnya' },
            { status: 500 }
        )
    }
}
