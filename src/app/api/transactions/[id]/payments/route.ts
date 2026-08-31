import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { notifyPaymentProof } from '@/lib/notifications'
import { requireAdmin } from '@/lib/api-auth'
import { runSerializableTransaction } from '@/lib/serializable-transaction'
import { createHash } from 'node:crypto'
import {
    legacyPaymentHistorySelect,
    paymentMutationReplaySelect,
    paymentTransactionPreReadSelect,
} from '@/lib/legacy-read-selects'

function isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'P2002'
}

const paymentHistorySchema = z.object({
    transactionId: z.string(),
    investorId: z.string(),
    amount: z.number().positive(),
    paymentDate: z.string().datetime(),
    method: z.enum(['TRANSFER', 'CASH']),
    proofImageUrl: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    idempotencyKey: z.string().min(16).max(200).optional(),
})

function paymentFingerprint(data: z.infer<typeof paymentHistorySchema>): string {
    return createHash('sha256').update(JSON.stringify({
        transactionId: data.transactionId,
        investorId: data.investorId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        method: data.method,
        proofImageUrl: data.proofImageUrl ?? null,
        notes: data.notes ?? null,
    })).digest('hex')
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    let parsedIdempotencyKey: string | undefined
    let parsedFingerprint: string | undefined
    try {
        const { id: transactionId } = await params
        const body = await request.json()
        const validatedData = paymentHistorySchema.parse({
            ...body,
            transactionId,
        })
        parsedIdempotencyKey = validatedData.idempotencyKey
        const fingerprint = paymentFingerprint(validatedData)
        parsedFingerprint = fingerprint

        const outcome = await runSerializableTransaction(prisma, async (tx) => {
            if (validatedData.idempotencyKey) {
                const existing = await tx.paymentHistory.findUnique({
                    where: { idempotencyKey: validatedData.idempotencyKey },
                    select: paymentMutationReplaySelect,
                })
                if (existing) {
                    if (existing.idempotencyFingerprint !== fingerprint) {
                        return { kind: 'IDEMPOTENCY_MISMATCH' as const }
                    }
                    const totalPaid = existing.transactionId
                        ? (await tx.paymentHistory.aggregate({
                            where: { transactionId: existing.transactionId },
                            _sum: { amount: true },
                        }))._sum.amount ?? 0
                        : existing.amount
                    return {
                        kind: 'IDEMPOTENT_REPLAY' as const,
                        payment: existing,
                        paymentStatus: existing.transaction?.paymentStatus ?? 'UNPAID',
                        totalPaid,
                    }
                }
            }

            const transaction = await tx.transaction.findUnique({
                where: { id: transactionId },
                select: paymentTransactionPreReadSelect,
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
                    idempotencyKey: validatedData.idempotencyKey,
                    idempotencyFingerprint: validatedData.idempotencyKey ? fingerprint : null,
                },
                select: legacyPaymentHistorySelect,
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
                select: { id: true },
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

        if (outcome.kind === 'IDEMPOTENCY_MISMATCH') {
            return NextResponse.json({ error: 'Idempotency key sudah dipakai untuk pembayaran berbeda' }, { status: 409 })
        }

        if (outcome.kind === 'IDEMPOTENT_REPLAY') {
            return NextResponse.json({
                success: true,
                replayed: true,
                payment: outcome.payment,
                paymentStatus: outcome.paymentStatus,
                totalPaid: outcome.totalPaid,
            })
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
        if (isUniqueConstraintError(error) && parsedIdempotencyKey) {
            // A concurrent request may win the unique idempotency-key insert.
            // The winner's committed row is the authoritative replay response.
            const replay = await prisma.paymentHistory.findUnique({
                where: { idempotencyKey: parsedIdempotencyKey },
                select: paymentMutationReplaySelect,
            })
            if (replay) {
                if (replay.idempotencyFingerprint !== parsedFingerprint) {
                    return NextResponse.json(
                        { error: 'Idempotency key sudah dipakai untuk pembayaran berbeda' },
                        { status: 409 }
                    )
                }
                const totalPaid = replay.transactionId
                    ? (await prisma.paymentHistory.aggregate({
                        where: { transactionId: replay.transactionId },
                        _sum: { amount: true },
                    }))._sum.amount ?? 0
                    : replay.amount
                return NextResponse.json({
                    success: true,
                    replayed: true,
                    payment: replay,
                    paymentStatus: replay.transaction?.paymentStatus ?? 'UNPAID',
                    totalPaid,
                })
            }
        }
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
