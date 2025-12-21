
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateProfitSharingSchema = z.object({
    investorSharePercentage: z.number().min(0).max(100),
    managerSharePercentage: z.number().min(0).max(100),
})

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = updateProfitSharingSchema.parse(body)

        // Fetch existing ProfitSharing record
        const profitSharing = await prisma.profitSharing.findUnique({
            where: { transactionId: id }
        })

        if (!profitSharing) {
            return NextResponse.json({ error: "Profit sharing record not found" }, { status: 404 })
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

        // Update record
        const updatedProfitSharing = await prisma.profitSharing.update({
            where: { transactionId: id },
            data: {
                investorSharePercentage: validatedData.investorSharePercentage,
                managerSharePercentage: validatedData.managerSharePercentage,
                investorProfitAmount,
                managerProfitAmount,
            }
        })

        // Also check if we need to update transaction payment status
        // because "investorProfitAmount" changed -> "investorShouldReceive" changes
        // This logic is usually in GET /api/transactions/[id] or calculated on the fly.
        // But the Transaction.paymentStatus might need update?
        // Transaction.paymentStatus is UNPAID, PARTIAL, PAID.
        // It relies on totalPaid vs investorShouldReceive.

        // Let's re-evaluate payment status
        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { paymentHistories: true }
        })

        if (transaction) {
            const totalPaid = transaction.paymentHistories.reduce((sum, p) => sum + p.amount, 0)
            const remaining = investorProfitAmount - totalPaid

            let paymentStatus = 'UNPAID'
            if (remaining <= 100) { // Tolerance
                paymentStatus = 'PAID'
            } else if (totalPaid > 0) {
                paymentStatus = 'PARTIAL'
            }

            if (paymentStatus !== transaction.paymentStatus) {
                await prisma.transaction.update({
                    where: { id },
                    data: { paymentStatus }
                })
            }
        }

        return NextResponse.json(updatedProfitSharing)
    } catch (error) {
        console.error("Error updating profit sharing:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Failed to update profit sharing" }, { status: 500 })
    }
}
