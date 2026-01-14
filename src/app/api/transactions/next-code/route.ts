
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const unitId = searchParams.get('unitId')

        // If unitId is provided, generate code based on unit's investor
        if (unitId) {
            // Get the unit with investor information
            const unit = await prisma.unit.findUnique({
                where: { id: unitId },
                include: {
                    investor: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            })

            if (!unit) {
                return NextResponse.json(
                    { error: 'Unit tidak ditemukan' },
                    { status: 404 }
                )
            }

            // Generate prefix from investor name (first 3 letters of first name)
            const nameParts = unit.investor.name.split(' ')
            const rawPrefix = nameParts[0].substring(0, 3).toUpperCase()
            const prefix = `TRX-${rawPrefix}`

            // Find the latest transaction for this investor
            const latestTransaction = await prisma.transaction.findFirst({
                where: {
                    unit: {
                        investorId: unit.investor.id
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    transactionCode: true
                }
            })

            let nextCode = `${prefix}-0001`

            if (latestTransaction?.transactionCode) {
                // Try to extract the number part from the code
                // Example: TRX-WAH-0007 -> 0007
                const match = latestTransaction.transactionCode.match(/(\d+)$/)

                if (match) {
                    const lastNumStr = match[1]
                    const lastNum = parseInt(lastNumStr)
                    const nextNum = lastNum + 1

                    // Preserve the padding length
                    const padLength = Math.max(lastNumStr.length, 4)
                    nextCode = `${prefix}-${String(nextNum).padStart(padLength, '0')}`
                }
            }

            return NextResponse.json({ code: nextCode })
        }

        // Fallback: Global transaction code generation
        const latestTransaction = await prisma.transaction.findFirst({
            orderBy: {
                transactionCode: 'desc'
            },
            select: {
                transactionCode: true
            }
        })

        const currentYear = new Date().getFullYear()
        let nextCode = `TRX-${currentYear}-001`

        if (latestTransaction?.transactionCode) {
            const match = latestTransaction.transactionCode.match(/TRX-(\d{4})-(\d+)/)
            if (match) {
                const year = parseInt(match[1])
                const sequence = parseInt(match[2])

                if (year === currentYear) {
                    // Same year, increment sequence
                    nextCode = `TRX-${year}-${String(sequence + 1).padStart(3, '0')}`
                } else {
                    // New year, restart sequence
                    nextCode = `TRX-${currentYear}-001`
                }
            } else {
                // Try to handle simple number increment if format is different but ends in number
                const numberMatch = latestTransaction.transactionCode.match(/(\d+)$/)
                if (numberMatch) {
                    const num = parseInt(numberMatch[1])
                    const prefix = latestTransaction.transactionCode.substring(0, latestTransaction.transactionCode.length - numberMatch[1].length)
                    nextCode = `${prefix}${String(num + 1).padStart(numberMatch[1].length, '0')}`
                }
            }
        }

        return NextResponse.json({ code: nextCode })
    } catch (error) {
        console.error('Error fetching next transaction code:', error)
        return NextResponse.json(
            { error: 'Gagal mengambil kode transaksi berikutnya' },
            { status: 500 }
        )
    }
}
