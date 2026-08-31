import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/api-auth"
import { runSerializableTransaction } from "../../../../../lib/serializable-transaction"
import {
    legacyProfitSharingSelect,
    profitSharingPatchPreReadSelect,
    profitSharingPatchTransactionSelect,
} from "../../../../../lib/legacy-read-selects"

const updateProfitSharingSchema = z.object({
    investorSharePercentage: z.number().min(0).max(100),
    managerSharePercentage: z.number().min(0).max(100),
}).refine((data) => data.investorSharePercentage + data.managerSharePercentage === 100, {
    message: "Total persentase bagi hasil harus 100",
    path: ["managerSharePercentage"],
})

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = updateProfitSharingSchema.parse(body)

        const updatedProfitSharing = await runSerializableTransaction(prisma, async (tx) => {
            const profitSharing = await tx.profitSharing.findUnique({
                where: { transactionId: id },
                select: profitSharingPatchPreReadSelect,
            })

            if (!profitSharing) {
                return { kind: "NOT_FOUND" as const }
            }

            // Recalculate amounts based on existing netMargin
            const { netMargin } = profitSharing
            let investorProfitAmount = 0
            let managerProfitAmount = 0

            if (netMargin > 0) {
                investorProfitAmount = netMargin * (validatedData.investorSharePercentage / 100)
                managerProfitAmount = netMargin * (validatedData.managerSharePercentage / 100)
            }
            // If netMargin <= 0, amounts remain 0 (or handled differently if loss sharing logic changes, but standard is 0 for profit)

            const updated = await tx.profitSharing.update({
                where: { transactionId: id },
                data: {
                    investorSharePercentage: validatedData.investorSharePercentage,
                    managerSharePercentage: validatedData.managerSharePercentage,
                    investorProfitAmount,
                    managerProfitAmount,
                },
                select: legacyProfitSharingSelect,
            })

            // Re-evaluate payment status using the same tolerance and PaymentHistory basis.
            const transaction = await tx.transaction.findUnique({
                where: { id },
                select: profitSharingPatchTransactionSelect,
            })

            if (transaction) {
                const totalPaid = transaction.paymentHistories.reduce(
                    (sum: number, payment: { amount: number }) => sum + payment.amount,
                    0
                )
                const remaining = investorProfitAmount - totalPaid

                let paymentStatus = 'UNPAID'
                if (remaining <= 100) {
                    paymentStatus = 'PAID'
                } else if (totalPaid > 0) {
                    paymentStatus = 'PARTIAL'
                }

                if (paymentStatus !== transaction.paymentStatus) {
                    await tx.transaction.update({
                        where: { id },
                        data: { paymentStatus },
                    })
                }
            }

            return { kind: "UPDATED" as const, profitSharing: updated }
        })

        if (updatedProfitSharing.kind === "NOT_FOUND") {
            return NextResponse.json({ error: "Profit sharing record not found" }, { status: 404 })
        }

        return NextResponse.json(updatedProfitSharing.profitSharing)
    } catch (error) {
        console.error("Error updating profit sharing:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Failed to update profit sharing" }, { status: 500 })
    }
}
