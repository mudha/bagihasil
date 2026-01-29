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

        // Fetch all matching codes to avoid string sort issues (e.g., '046' > '0047')
        const existingUnits = await prisma.unit.findMany({
            where: {
                code: {
                    startsWith: prefix
                }
            },
            select: {
                code: true
            }
        })

        let maxSuffix = 0

        existingUnits.forEach(unit => {
            if (unit.code) {
                // Extract last number from code
                const match = unit.code.match(/(\d+)$/)
                if (match) {
                    const num = parseInt(match[1])
                    if (!isNaN(num) && num > maxSuffix) {
                        maxSuffix = num
                    }
                }
            }
        })

        let nextCodeSuffix = maxSuffix + 1
        let isUnique = false
        let attempts = 0
        let finalCode = ''

        while (!isUnique && attempts < 10) {
            // Updated to 4 digits padding as requested
            const suffix = String(nextCodeSuffix).padStart(4, '0')
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
