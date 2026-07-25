import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/api-auth"

const costSchema = z.object({
    costType: z.string(),
    payer: z.enum(["INVESTOR", "MANAGER"]),
    amount: z.number().positive(),
    description: z.string().optional(),
    replaceProofs: z.boolean().optional(),
    proofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional()
})

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string; costId: string }> }
) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    try {
        const { id, costId } = await params
        const body = await req.json()
        const validatedData = costSchema.parse(body)

        const { proofs, replaceProofs, ...data } = validatedData

        const existingCost = await prisma.cost.findFirst({
            where: {
                id: costId,
                transactionId: id
            }
        })

        if (!existingCost) {
            return NextResponse.json({ error: "Cost not found" }, { status: 404 })
        }

        const updateData: any = { ...data }
        if (replaceProofs) {
            updateData.proofs = {
                deleteMany: {},
                create: proofs ?? []
            }
        }

        const cost = await prisma.$transaction(async (tx) => {
            const updatedCost = await tx.cost.update({
                where: { id: costId },
                data: updateData
            })

            const transaction = await tx.transaction.findUnique({
                where: { id },
                include: {
                    costs: true,
                    profitSharing: true,
                    paymentHistories: true
                }
            })

            if (
                transaction?.status === "COMPLETED"
                && transaction.sellPrice !== null
                && transaction.profitSharing
            ) {
                const investorCosts = transaction.costs
                    .filter((item) => item.payer === "INVESTOR")
                    .reduce((sum, item) => sum + item.amount, 0)
                const managerCosts = transaction.costs
                    .filter((item) => item.payer === "MANAGER")
                    .reduce((sum, item) => sum + item.amount, 0)

                const baseInvestorCapital = transaction.initialInvestorCapital ?? transaction.buyPrice
                const baseManagerCapital = transaction.initialManagerCapital ?? 0
                const totalCapitalInvestor = baseInvestorCapital + investorCosts
                const totalCapitalManager = baseManagerCapital + managerCosts
                const totalCapital = totalCapitalInvestor + totalCapitalManager
                const netMargin = transaction.profitSharing.netMargin
                    + existingCost.amount
                    - updatedCost.amount

                const investorProfitAmount = netMargin > 0
                    ? netMargin * (transaction.profitSharing.investorSharePercentage / 100)
                    : 0
                const managerProfitAmount = netMargin > 0
                    ? netMargin - investorProfitAmount
                    : 0

                await tx.profitSharing.update({
                    where: { transactionId: id },
                    data: {
                        totalCapitalInvestor,
                        totalCapitalManager,
                        totalCapital,
                        netMargin,
                        investorProfitAmount,
                        managerProfitAmount
                    }
                })

                const totalPaid = transaction.paymentHistories.reduce(
                    (sum, payment) => sum + payment.amount,
                    0
                )
                const remaining = investorProfitAmount - totalPaid
                const paymentStatus = remaining <= 100
                    ? "PAID"
                    : totalPaid > 0
                        ? "PARTIAL"
                        : "UNPAID"
                const profitStatus = netMargin > 0
                    ? "PROFIT"
                    : netMargin < 0
                        ? "LOSS"
                        : "BREAK_EVEN"

                await tx.transaction.update({
                    where: { id },
                    data: {
                        paymentStatus,
                        profitStatus
                    }
                })
            }

            return updatedCost
        })

        return NextResponse.json(cost)
    } catch (error) {
        console.error("Error updating cost:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Failed to update cost" }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string; costId: string }> }
) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    try {
        const { costId } = await params

        await prisma.cost.delete({
            where: { id: costId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting cost:", error)
        return NextResponse.json({ error: "Failed to delete cost" }, { status: 500 })
    }
}
