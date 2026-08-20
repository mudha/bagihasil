import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { notifyPaymentProof } from '@/lib/notifications'
import { requireAdmin } from '@/lib/api-auth'
import { runSerializableTransaction } from '@/lib/serializable-transaction'

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
        const validatedData = paymentHistorySchema.parse({
            ...body,
            transactionId,
        })

        const outcome = await runSerializableTransaction(prisma, async (tx) => {
            const transaction = await tx.transaction.findUnique({
                where: { id: transactionId },
                include: {
                    unit: true,
                    profitSharing: true,
                    paymentHistories: true,
                },
            })

            if (!transaction) return { kind: 'NOT_FOUND' as const }

            if (validatedData.investorId !== transaction.unit.investorId) {
                return { kind: 'INVESTOR_MISMATCH' as const }
            }

            const paymentDate = new Date(validatedData.paymentDate)
            const duplicate = transaction.paymentHistories.some((payment: {
                investorId: string
                amount: number
                paymentDate: Date
                method: string
                proofImageUrl: string | null
                notes: string | null
            }) =>
                payment.investorId === validatedData.investorId
                && payment.amount === validatedData.amount
                && payment.paymentDate.getTime() === paymentDate.getTime()
                && payment.method === validatedData.method
                && payment.proofImageUrl === validatedData.proofImageUrl
                && payment.notes === validatedData.notes
            )
            if (duplicate) return { kind: 'DUPLICATE' as const }

            const investorShouldReceive = transaction.profitSharing?.investorProfitAmount || 0
            const totalPaidBefore = transaction.paymentHistories.reduce(
                (sum: number, payment: { amount: number }) => sum + payment.amount,
                0
            )
            const remainingBefore = investorShouldReceive - totalPaidBefore
            if (validatedData.amount > remainingBefore + 100) {
                return { kind: 'OVERPAYMENT' as const, remaining: Math.max(remainingBefore, 0) }
            }

            const payment = await tx.paymentHistory.create({
                data: {
                    transactionId: validatedData.transactionId,
                    investorId: validatedData.investorId,
                    amount: validatedData.amount,
                    paymentDate,
                    method: validatedData.method,
                    proofImageUrl: validatedData.proofImageUrl,
                    notes: validatedData.notes,
                },
            })

            const totalPaid = totalPaidBefore + validatedData.amount
            const paymentStatus = totalPaid >= investorShouldReceive - 100
                ? 'PAID'
                : totalPaid > 0
                    ? 'PARTIAL'
                    : 'UNPAID'

            await tx.transaction.update({
                where: { id: transactionId },
                data: { paymentStatus },
            })

            return { kind: 'CREATED' as const, payment, paymentStatus, totalPaid }
        })

        if (outcome.kind === 'NOT_FOUND') {
            return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
        }
        if (outcome.kind === 'INVESTOR_MISMATCH') {
            return NextResponse.json({ error: 'Investor tidak sesuai dengan transaksi' }, { status: 400 })
        }
        if (outcome.kind === 'DUPLICATE') {
            return NextResponse.json({ error: 'Pembayaran duplikat ditolak' }, { status: 409 })
        }
        if (outcome.kind === 'OVERPAYMENT') {
            return NextResponse.json({
                error: 'Jumlah pembayaran melebihi sisa hak investor',
                remaining: outcome.remaining,
            }, { status: 400 })
        }

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
            payment: outcome.payment,
            paymentStatus: outcome.paymentStatus,
            totalPaid: outcome.totalPaid,
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

// A persisted idempotency key is intentionally not added without an approved schema migration.
// Exact duplicate payloads are rejected within the transaction; cross-retry idempotency remains a follow-up.
