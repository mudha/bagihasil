
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        // Find the latest transaction code
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
                    // New year, restart sequence? Or continue? 
                    // Usually restart for YYYY based codes.
                    // But if user wants to continue globally, regex might fail if format changes.
                    // Let's assume restart on new year for this format.
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
