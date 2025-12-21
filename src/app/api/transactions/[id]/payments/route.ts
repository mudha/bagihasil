import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const paymentHistorySchema = z.object({
    transactionId: z.string(),
    investorId: z.string(),
    amount: z.number().positive(),
    paymentDate: z.string().datetime(),
    method: z.enum(['TRANSFER', 'CASH']),
    proofImageUrl: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: transactionId } = await params
        const body = await request.json()

        // Validate input
        const validatedData = paymentHistorySchema.parse({
            ...body,
            transactionId,
        })

        // Check if transaction exists
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { unit: true }
        })

        if (!transaction) {
            return NextResponse.json(
                { error: 'Transaksi tidak ditemukan' },
                { status: 404 }
            )
        }

        // Create payment history
        const payment = await prisma.paymentHistory.create({
            data: {
                transactionId: validatedData.transactionId,
                investorId: validatedData.investorId,
                amount: validatedData.amount,
                paymentDate: new Date(validatedData.paymentDate),
                method: validatedData.method,
                proofImageUrl: validatedData.proofImageUrl,
                notes: validatedData.notes,
            }
        })

        // Calculate total paid
        const totalPaid = await prisma.paymentHistory.aggregate({
            where: { transactionId },
            _sum: { amount: true }
        })

        const total = totalPaid._sum.amount || 0

        // Calculate what investor should receive to determine payment status
        const investorCapital = transaction.initialInvestorCapital || transaction.buyPrice
        const profitSharing = await prisma.profitSharing.findUnique({
            where: { transactionId }
        })

        // Get investor costs
        const costs = await prisma.cost.findMany({
            where: { transactionId }
        })
        const investorCosts = costs
            .filter(c => c.payer === 'INVESTOR')
            .reduce((sum, c) => sum + c.amount, 0)

        const investorShouldReceive = investorCapital - investorCosts + (profitSharing?.investorProfitAmount || 0)

        // Update payment status - Force to PAID as per user request
        // The logic to calculate based on amount is bypassed
        const paymentStatus = 'PAID'
        /*
        let paymentStatus: string
        if (total >= investorShouldReceive) {
            paymentStatus = 'PAID'
        } else if (total > 0) {
            paymentStatus = 'PARTIAL'
        } else {
            paymentStatus = 'UNPAID'
        }
        */

        await prisma.transaction.update({
            where: { id: transactionId },
            data: { paymentStatus }
        })

        return NextResponse.json({
            success: true,
            payment,
            paymentStatus,
            totalPaid: total
        })
    } catch (error) {
        console.error('Error creating payment history:', error)

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Data tidak valid', details: error.issues },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: 'Gagal menambahkan pembayaran' },
            { status: 500 }
        )
    }
}
