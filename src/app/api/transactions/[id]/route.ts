import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"

const transactionUpdateSchema = z.object({
    unitId: z.string().optional(),
    transactionCode: z.string().min(1).optional(),
    buyDate: z.string().transform((str) => new Date(str)).optional(),
    buyPrice: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? Number(val) : val).optional(),
    initialInvestorCapital: z.union([z.string(), z.number()]).transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }).optional(),
    initialManagerCapital: z.union([z.string(), z.number()]).transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }).optional(),
    notes: z.string().optional(),
    status: z.enum(["ON_PROCESS", "COMPLETED"]).optional(),
    sellDate: z.string().transform((str) => new Date(str)).optional(),
    sellPrice: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? Number(val) : val).optional(),
    investorSharePercentage: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? Number(val) : val).optional(),
    managerSharePercentage: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? Number(val) : val).optional(),
    buyProofImageUrl: z.string().nullable().optional(),
    buyProofDescription: z.string().nullable().optional(),
    sellProofImageUrl: z.string().nullable().optional(),
    sellProofDescription: z.string().nullable().optional(),
    buyProofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional(),
    sellProofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional(),
})

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { id } = await params

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: {
                unit: {
                    include: {
                        investor: true
                    }
                },
                costs: {
                    include: { proofs: true },
                    orderBy: { date: 'asc' }
                },
                profitSharing: true,
                paymentHistories: {
                    orderBy: { paymentDate: 'asc' }
                },
                proofs: true
            }
        }) as any

        if (!transaction) {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
        }

        // Calculate payment info
        const totalPaid = transaction.paymentHistories.reduce(
            (sum: number, ph: any) => sum + ph.amount,
            0
        )

        const investorShouldReceive = transaction.profitSharing?.investorProfitAmount || 0
        const remaining = investorShouldReceive - totalPaid

        let calculatedStatus = transaction.paymentStatus || 'UNPAID'
        if (remaining <= 100) {
            calculatedStatus = 'PAID'
        } else if (totalPaid > 0) {
            calculatedStatus = 'PARTIAL'
        }

        // Extend transaction object with payment info
        const transactionWithPayment = {
            ...transaction,
            payment: {
                investorShouldReceive,
                totalPaid,
                remaining,
                paymentStatus: calculatedStatus
            }
        }

        return NextResponse.json(transactionWithPayment)
    } catch (error) {
        console.error("Error fetching transaction:", error)
        return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 })
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = transactionUpdateSchema.parse(body)

        // Check if transaction exists and is editable
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id }
        })

        if (!existingTransaction) {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
        }

        // Handle status changes
        if (body.status && body.status !== existingTransaction.status) {
            if (body.status === "COMPLETED") {
                // Check merged data for requirements
                const finalSellDate = validatedData.sellDate || existingTransaction.sellDate
                const finalSellPrice = validatedData.sellPrice ?? existingTransaction.sellPrice

                // Changing to COMPLETED requires sell date and sell price
                if (!finalSellDate || finalSellPrice === undefined || finalSellPrice === null || finalSellPrice === 0) {
                    return NextResponse.json({
                        error: "Cannot mark as COMPLETED without sell date and sell price. Please finalize the sale first."
                    }, { status: 400 })
                }
                // Update unit status to SOLD
                await prisma.unit.update({
                    where: { id: existingTransaction.unitId },
                    data: { status: "SOLD" }
                })

                // --- Auto-create Profit Sharing Record ---
                // 1. Fetch related data (Costs & Investor Margin)
                const fullTransaction = await prisma.transaction.findUnique({
                    where: { id },
                    include: {
                        costs: true,
                        unit: { include: { investor: true } }
                    }
                })

                if (fullTransaction) {
                    // @ts-ignore
                    const investorDefaultMargin = fullTransaction.unit.investor.marginPercentage ?? 50

                    // 2. Determine Percentages (Body > Default)
                    const investorSharePct = validatedData.investorSharePercentage ?? investorDefaultMargin
                    const managerSharePct = validatedData.managerSharePercentage ?? (100 - investorSharePct)

                    // 3. Calculate Financials
                    const buyPrice = existingTransaction.buyPrice
                    const sellPrice = finalSellPrice

                    const investorCosts = fullTransaction.costs.filter(c => c.payer === "INVESTOR").reduce((sum, c) => sum + c.amount, 0)
                    const managerCosts = fullTransaction.costs.filter(c => c.payer === "MANAGER").reduce((sum, c) => sum + c.amount, 0)
                    const totalCosts = investorCosts + managerCosts

                    const baseInvestorCapital = existingTransaction.initialInvestorCapital ?? buyPrice
                    const baseManagerCapital = existingTransaction.initialManagerCapital ?? 0

                    const totalCapitalInvestor = baseInvestorCapital + investorCosts
                    const totalCapitalManager = baseManagerCapital + managerCosts
                    const totalCapital = totalCapitalInvestor + totalCapitalManager

                    const grossProfit = sellPrice - buyPrice
                    const netMargin = grossProfit - totalCosts

                    let investorProfit = 0
                    let managerProfit = 0

                    if (netMargin > 0) {
                        investorProfit = (netMargin * investorSharePct) / 100
                        managerProfit = netMargin - investorProfit // Ensure raw sum matches
                    }

                    // 4. Create ProfitSharing Record
                    // Delete existing if any to avoid duplicates logic
                    await prisma.profitSharing.deleteMany({ where: { transactionId: id } })

                    await prisma.profitSharing.create({
                        data: {
                            transactionId: id,
                            netMargin: netMargin,
                            investorSharePercentage: investorSharePct,
                            managerSharePercentage: managerSharePct,
                            investorProfitAmount: investorProfit,
                            managerProfitAmount: managerProfit,
                            totalCapitalInvestor: totalCapitalInvestor,
                            totalCapitalManager: totalCapitalManager,
                            totalCapital: totalCapital
                        }
                    })
                }
            } else if (body.status === "ON_PROCESS") {
                // Changing back to ON_PROCESS from COMPLETED
                // Delete profitSharing record if exists
                await prisma.profitSharing.deleteMany({
                    where: { transactionId: id }
                })
                // Update unit status back to AVAILABLE
                await prisma.unit.update({
                    where: { id: existingTransaction.unitId },
                    data: { status: "AVAILABLE" }
                })
            }
        }

        // Extract proofs to handle separately
        const { buyProofs, sellProofs, investorSharePercentage, managerSharePercentage, ...transactionData } = validatedData

        const updateData: any = { ...transactionData }

        // Use transaction to update data and proofs
        const result = await prisma.$transaction(async (tx) => {
            // Handle status validation logic if needed (it was before this block in the file)
            // But I am targeting the update call.

            // 1. Update Transaction
            await tx.transaction.update({
                where: { id },
                data: updateData
            })

            // 2. Handle Buy Proofs
            if (buyProofs) {
                await tx.transactionProof.deleteMany({
                    where: { transactionId: id, proofType: 'BUY' }
                })
                if (buyProofs.length > 0) {
                    await tx.transactionProof.createMany({
                        data: buyProofs.map(p => ({
                            transactionId: id,
                            proofType: 'BUY',
                            imageUrl: p.imageUrl,
                            description: p.description
                        }))
                    })
                }
            }

            // 3. Handle Sell Proofs
            if (sellProofs) {
                await tx.transactionProof.deleteMany({
                    where: { transactionId: id, proofType: 'SELL' }
                })
                if (sellProofs.length > 0) {
                    await tx.transactionProof.createMany({
                        data: sellProofs.map(p => ({
                            transactionId: id,
                            proofType: 'SELL',
                            imageUrl: p.imageUrl,
                            description: p.description
                        }))
                    })
                }
            }

            return await tx.transaction.findUnique({
                where: { id },
                include: { costs: true, proofs: true }
            })
        })

        // Log update
        if (result) {
            await logActivity(
                "UPDATE",
                "TRANSACTION",
                id,
                `Updated transaction ${result.transactionCode}. Status: ${result.status}`
            )
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error("Error updating transaction:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to update transaction",
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const { id } = await params

        // Check if transaction exists
        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { costs: true }
        })

        if (!transaction) {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
        }

        // Delete related costs first, then the transaction
        await prisma.cost.deleteMany({
            where: { transactionId: id }
        })

        await prisma.transaction.delete({
            where: { id }
        })

        // Update unit status back to AVAILABLE if needed
        if (transaction.unitId) {
            await prisma.unit.update({
                where: { id: transaction.unitId },
                data: { status: "AVAILABLE" }
            })
        }

        // Log deletion
        await logActivity("DELETE", "TRANSACTION", id, `Deleted transaction ${transaction.transactionCode}`)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting transaction:", error)
        return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 })
    }
}
