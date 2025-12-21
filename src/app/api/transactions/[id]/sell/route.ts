import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const sellSchema = z.object({
    sellDate: z.string().transform((str) => new Date(str)),
    sellPrice: z.number().positive(),
    investorSharePercentage: z.number().min(0).max(100).default(40),
    managerSharePercentage: z.number().min(0).max(100).default(60),
    lossBearer: z.enum(["INVESTOR", "MANAGER", "SHARED"]).optional(),
    notes: z.string().optional(),
})

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = sellSchema.parse(body)

        // 1. Fetch Transaction and Costs
        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { costs: true }
        })

        if (!transaction) {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
        }

        if (transaction.status === "COMPLETED") {
            return NextResponse.json({ error: "Transaction already completed" }, { status: 400 })
        }

        // 2. Calculate Totals
        const costsInvestor = transaction.costs
            .filter(c => c.payer === "INVESTOR")
            .reduce((sum, c) => sum + c.amount, 0)

        const costsManager = transaction.costs
            .filter(c => c.payer === "MANAGER")
            .reduce((sum, c) => sum + c.amount, 0)

        const totalCapitalInvestor = transaction.buyPrice + costsInvestor
        const totalCapitalManager = costsManager
        const totalCapital = totalCapitalInvestor + totalCapitalManager

        const netMargin = validatedData.sellPrice - totalCapital

        let investorProfitAmount = 0
        let managerProfitAmount = 0
        let profitStatus = "BREAK_EVEN"

        if (netMargin > 0) {
            profitStatus = "PROFIT"
            investorProfitAmount = netMargin * (validatedData.investorSharePercentage / 100)
            managerProfitAmount = netMargin * (validatedData.managerSharePercentage / 100)
        } else if (netMargin < 0) {
            profitStatus = "LOSS"
        }

        // 3. Update Transaction and Create ProfitSharing in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update Transaction
            const updatedTransaction = await tx.transaction.update({
                where: { id },
                data: {
                    status: "COMPLETED",
                    sellDate: validatedData.sellDate,
                    sellPrice: validatedData.sellPrice,
                    profitStatus,
                    lossBearer: validatedData.lossBearer, // Only relevant if loss
                    notes: validatedData.notes,
                }
            })

            // Update Unit Status
            await tx.unit.update({
                where: { id: transaction.unitId },
                data: { status: "SOLD" }
            })

            // Create ProfitSharing Record
            const profitSharing = await tx.profitSharing.create({
                data: {
                    transactionId: id,
                    totalCapitalInvestor,
                    totalCapitalManager,
                    totalCapital,
                    netMargin,
                    investorSharePercentage: validatedData.investorSharePercentage,
                    managerSharePercentage: validatedData.managerSharePercentage,
                    investorProfitAmount,
                    managerProfitAmount,
                }
            })

            return { updatedTransaction, profitSharing }
        })

        return NextResponse.json(result)

    } catch (error) {
        console.error("Error finalizing transaction:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
