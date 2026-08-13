import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { logActivity } from "@/lib/activity-logger"
import { notifyUnitSold } from "@/lib/notifications"
import { canAccessTransaction, forbidden } from "@/lib/api-auth"
import { calculateProfitSharing } from "@/lib/profit-sharing"
import { runSerializableTransaction } from "@/lib/serializable-transaction"


const transactionUpdateSchema = z.object({
    unitId: z.string().optional(),
    transactionCode: z.string().min(1).optional(),
    buyDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
    buyPrice: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? Number(val) : val).optional(),
    initialInvestorCapital: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }),
    initialManagerCapital: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }),
    notes: z.string().optional(),
    status: z.enum(["ON_PROCESS", "COMPLETED"]).optional(),
    sellDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
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

        if (!(await canAccessTransaction(session, id))) {
            return forbidden()
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
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = transactionUpdateSchema.parse(body)

        // Extract proofs to handle separately
        const { buyProofs, sellProofs, investorSharePercentage, managerSharePercentage, ...transactionData } = validatedData
        const updateData: any = { ...transactionData }

        const outcome = await runSerializableTransaction(prisma, async (tx) => {
            const currentTransaction = await tx.transaction.findUnique({
                where: { id },
                include: {
                    costs: true,
                    unit: { include: { investor: true } },
                },
            })

            if (!currentTransaction) {
                return { kind: "NOT_FOUND" as const }
            }

            const statusChanged = body.status && body.status !== currentTransaction.status
            let notifyInvestorId: string | null = null

            if (statusChanged && body.status === "COMPLETED") {
                const finalSellDate = validatedData.sellDate || currentTransaction.sellDate
                const finalSellPrice = validatedData.sellPrice ?? currentTransaction.sellPrice

                if (!finalSellDate || finalSellPrice === undefined || finalSellPrice === null || finalSellPrice === 0) {
                    return { kind: "INVALID_COMPLETION" as const }
                }

                const investorSharePct = validatedData.investorSharePercentage
                    ?? currentTransaction.unit.investor.marginPercentage
                    ?? 50
                const managerSharePct = validatedData.managerSharePercentage ?? (100 - investorSharePct)
                const calculation = calculateProfitSharing({
                    buyPrice: currentTransaction.buyPrice,
                    sellPrice: finalSellPrice,
                    initialInvestorCapital: currentTransaction.initialInvestorCapital,
                    initialManagerCapital: currentTransaction.initialManagerCapital,
                    costs: currentTransaction.costs,
                    investorSharePercentage: investorSharePct,
                    managerSharePercentage: managerSharePct,
                })

                await tx.unit.update({
                    where: { id: currentTransaction.unitId },
                    data: { status: "SOLD" },
                })

                await tx.profitSharing.deleteMany({ where: { transactionId: id } })
                await tx.profitSharing.create({
                    data: {
                        transactionId: id,
                        netMargin: calculation.netMargin,
                        investorSharePercentage: investorSharePct,
                        managerSharePercentage: managerSharePct,
                        investorProfitAmount: calculation.investorProfitAmount,
                        managerProfitAmount: calculation.managerProfitAmount,
                        totalCapitalInvestor: calculation.totalCapitalInvestor,
                        totalCapitalManager: calculation.totalCapitalManager,
                        totalCapital: calculation.totalCapital,
                    },
                })

                notifyInvestorId = currentTransaction.unit.investorId
            } else if (statusChanged && body.status === "ON_PROCESS") {
                await tx.profitSharing.deleteMany({ where: { transactionId: id } })
                await tx.unit.update({
                    where: { id: currentTransaction.unitId },
                    data: { status: "AVAILABLE" },
                })
            }

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

            const result = await tx.transaction.findUnique({
                where: { id },
                include: { costs: true, proofs: true }
            })
            return { kind: "OK" as const, result, notifyInvestorId }
        })

        // Transaction committed. External side effects start only after this point.
        if (outcome.kind === "NOT_FOUND") {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
        }
        if (outcome.kind === "INVALID_COMPLETION") {
            return NextResponse.json({
                error: "Cannot mark as COMPLETED without sell date and sell price. Please finalize the sale first."
            }, { status: 400 })
        }

        const { result, notifyInvestorId } = outcome
        if (notifyInvestorId) {
            try {
                await notifyUnitSold(notifyInvestorId, id)
            } catch (error) {
                console.error("Failed to send notification:", error)
            }
        }

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
            // Return user-friendly error message instead of raw error object
            const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
            return NextResponse.json({ error: errorMessage || "Validation error" }, { status: 400 })
        }
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to update transaction"
        }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
