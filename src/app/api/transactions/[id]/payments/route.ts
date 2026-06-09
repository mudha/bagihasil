import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { notifyPaymentProof } from '@/lib/notifications'
import { requireAdmin } from '@/lib/api-auth'

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
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

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

        if (validatedData.investorId !== transaction.unit.investorId) {
            return NextResponse.json(
                { error: 'Investor tidak sesuai dengan transaksi' },
                { status: 400 }
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
        const profitSharing = await prisma.profitSharing.findUnique({
            where: { transactionId }
        })

        const investorShouldReceive = profitSharing?.investorProfitAmount || 0

        let paymentStatus: string
        if (total >= investorShouldReceive - 100) {
            paymentStatus = 'PAID'
        } else if (total > 0) {
            paymentStatus = 'PARTIAL'
        } else {
            paymentStatus = 'UNPAID'
        }

        await prisma.transaction.update({
            where: { id: transactionId },
            data: { paymentStatus }
        })

        // Trigger Notification
        try {
            await notifyPaymentProof(
                validatedData.investorId,
                transactionId,
                validatedData.amount,
                validatedData.proofImageUrl
            )
        } catch (error) {
            console.error("Failed to send notification:", error)
        }

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
