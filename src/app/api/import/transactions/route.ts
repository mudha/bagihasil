import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { calculateProfitSharing } from "@/lib/profit-sharing"

// Helper function to parse DD-MM-YYYY date format
function parseDateFromCSV(dateStr: string): Date {
    // Handle DD-MM-YYYY format (e.g., "07-08-2025")
    const parts = dateStr.trim().split('-')

    if (parts.length === 3) {
        const day = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed in JS
        const year = parseInt(parts[2], 10)

        const date = new Date(year, month, day)

        // Validate the date
        if (!isNaN(date.getTime())) {
            return date
        }
    }

    // Fallback to standard Date parsing
    const fallbackDate = new Date(dateStr)
    if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate
    }

    throw new Error(`Invalid date format: ${dateStr}. Expected DD-MM-YYYY (e.g., 07-08-2025)`)
}

export async function POST(req: Request) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    try {
        const body = await req.json()
        const { data } = body

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 })
        }

        let successCount = 0
        const errors: string[] = []

        // Pre-fetch all units
        const units = await prisma.unit.findMany({
            include: { investor: true }
        })
        const unitMap = new Map(units.map(u => [u.code, u]))

        for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const {
                unitCode,
                transactionCode,
                buyDate,
                buyPrice,
                initialInvestorCapital,
                initialManagerCapital,
                status,
                // New fields for completion
                sellDate,
                sellPrice,
                // Cost fields
                biayaInspector,
                biayaTransport,
                biayaMakan,
                biayaTol,
                biayaIklan,
                biayaPRUnit,
                biayaBensin,
                biayaParkir,
                biayaMaterai,
                biayaMakelar,
                biayaLainLainPemodal
            } = row

            if (!unitCode || !transactionCode || !buyDate || !buyPrice) {
                errors.push(`Row ${i + 1}: Missing required fields`)
                continue
            }

            const unit = unitMap.get(unitCode)
            if (!unit) {
                errors.push(`Row ${i + 1}: Unit code '${unitCode}' not found`)
                continue
            }
            const unitId = unit.id

            try {
                const parsedBuyDate = parseDateFromCSV(buyDate)
                const parsedSellDate = sellDate ? parseDateFromCSV(sellDate) : undefined

                // Determine transaction status
                let transactionStatus = status || "ON_PROCESS"
                if (parsedSellDate && sellPrice) {
                    transactionStatus = "COMPLETED"
                }

                // Create transaction
                const transaction = await prisma.transaction.create({
                    data: {
                        unitId,
                        transactionCode,
                        buyDate: parsedBuyDate,
                        buyPrice: parseFloat(buyPrice),
                        sellDate: parsedSellDate,
                        sellPrice: sellPrice ? parseFloat(sellPrice) : undefined,
                        initialInvestorCapital: initialInvestorCapital ? parseFloat(initialInvestorCapital) : undefined,
                        initialManagerCapital: initialManagerCapital ? parseFloat(initialManagerCapital) : undefined,
                        status: transactionStatus
                    }
                })

                // Create cost records if any costs are provided
                const costs: Array<{ costType: string, amount: number, payer: string, description: string }> = []

                if (biayaInspector && parseFloat(biayaInspector) > 0) {
                    costs.push({
                        costType: "Inspector",
                        amount: parseFloat(biayaInspector),
                        payer: "MANAGER",
                        description: "Biaya inspector"
                    })
                }

                if (biayaTransport && parseFloat(biayaTransport) > 0) {
                    costs.push({
                        costType: "Transport",
                        amount: parseFloat(biayaTransport),
                        payer: "MANAGER",
                        description: "Biaya transport"
                    })
                }

                if (biayaMakan && parseFloat(biayaMakan) > 0) {
                    costs.push({
                        costType: "Makan",
                        amount: parseFloat(biayaMakan),
                        payer: "MANAGER",
                        description: "Biaya makan"
                    })
                }

                if (biayaTol && parseFloat(biayaTol) > 0) {
                    costs.push({
                        costType: "Tol",
                        amount: parseFloat(biayaTol),
                        payer: "MANAGER",
                        description: "Biaya tol"
                    })
                }

                if (biayaIklan && parseFloat(biayaIklan) > 0) {
                    costs.push({
                        costType: "Iklan",
                        amount: parseFloat(biayaIklan),
                        payer: "MANAGER",
                        description: "Biaya iklan"
                    })
                }

                if (biayaPRUnit && parseFloat(biayaPRUnit) > 0) {
                    costs.push({
                        costType: "PR Unit",
                        amount: parseFloat(biayaPRUnit),
                        payer: "MANAGER",
                        description: "Biaya PR unit"
                    })
                }

                if (biayaBensin && parseFloat(biayaBensin) > 0) {
                    costs.push({
                        costType: "Bensin",
                        amount: parseFloat(biayaBensin),
                        payer: "MANAGER",
                        description: "Biaya bensin"
                    })
                }

                if (biayaParkir && parseFloat(biayaParkir) > 0) {
                    costs.push({
                        costType: "Parkir",
                        amount: parseFloat(biayaParkir),
                        payer: "MANAGER",
                        description: "Biaya parkir"
                    })
                }

                if (biayaMaterai && parseFloat(biayaMaterai) > 0) {
                    costs.push({
                        costType: "Materai",
                        amount: parseFloat(biayaMaterai),
                        payer: "MANAGER",
                        description: "Biaya materai"
                    })
                }

                if (biayaMakelar && parseFloat(biayaMakelar) > 0) {
                    costs.push({
                        costType: "Makelar",
                        amount: parseFloat(biayaMakelar),
                        payer: "MANAGER",
                        description: "Biaya makelar"
                    })
                }

                if (biayaLainLainPemodal && parseFloat(biayaLainLainPemodal) > 0) {
                    costs.push({
                        costType: "Lain-lain",
                        amount: parseFloat(biayaLainLainPemodal),
                        payer: "INVESTOR",
                        description: "Biaya lain-lain dari pemodal"
                    })
                }

                // Create all cost records
                if (costs.length > 0) {
                    await prisma.cost.createMany({
                        data: costs.map(cost => ({
                            transactionId: transaction.id,
                            ...cost
                        }))
                    })
                }

                // If transaction is COMPLETED (has sell date and price), create profitSharing record
                if (transactionStatus === "COMPLETED" && parsedSellDate && sellPrice) {
                    // Use shared calculation — same as active finalization path
                    const investorSharePercentage = unit.investor?.marginPercentage ?? 50
                    const managerSharePercentage = 100 - investorSharePercentage

                    const calculation = calculateProfitSharing({
                        buyPrice: parseFloat(buyPrice),
                        sellPrice: parseFloat(sellPrice),
                        initialInvestorCapital: initialInvestorCapital ? parseFloat(initialInvestorCapital) : undefined,
                        initialManagerCapital: initialManagerCapital ? parseFloat(initialManagerCapital) : undefined,
                        costs,
                        investorSharePercentage,
                        managerSharePercentage,
                    })

                    // Create profitSharing record
                    await prisma.profitSharing.create({
                        data: {
                            transactionId: transaction.id,
                            totalCapitalInvestor: calculation.totalCapitalInvestor,
                            totalCapitalManager: calculation.totalCapitalManager,
                            totalCapital: calculation.totalCapital,
                            netMargin: calculation.netMargin,
                            investorSharePercentage,
                            managerSharePercentage,
                            investorProfitAmount: calculation.investorProfitAmount,
                            managerProfitAmount: calculation.managerProfitAmount,
                        }
                    })

                    // Update transaction profitStatus
                    await prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { profitStatus: calculation.profitStatus }
                    })

                    // Update unit status to SOLD
                    await prisma.unit.update({
                        where: { id: unitId },
                        data: { status: "SOLD" }
                    })
                }

                successCount++
            } catch (error: any) {
                if (error.code === 'P2002') {
                    errors.push(`Row ${i + 1}: Duplicate transaction code`)
                } else {
                    errors.push(`Row ${i + 1}: ${error.message}`)
                }
            }
        }

        return NextResponse.json({ count: successCount, errors })
    } catch (error) {
        console.error("Import error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
