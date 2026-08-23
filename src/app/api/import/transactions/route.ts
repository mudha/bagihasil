import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { calculateProfitSharing } from "@/lib/profit-sharing"
import { parseImportNumber, validateImportProfitShares } from "./import-validation"

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
                const parsedBuyPrice = parseImportNumber(buyPrice, "buyPrice", { required: true, min: 0 })!
                const parsedSellPrice = parseImportNumber(sellPrice, "sellPrice", { min: 0 })
                const parsedInitialInvestorCapital = parseImportNumber(initialInvestorCapital, "initialInvestorCapital", { min: 0 })
                const parsedInitialManagerCapital = parseImportNumber(initialManagerCapital, "initialManagerCapital", { min: 0 })

                // Determine transaction status
                let transactionStatus = status || "ON_PROCESS"
                if (parsedSellDate && sellPrice) {
                    transactionStatus = "COMPLETED"
                }

                const investorSharePercentage = unit.investor?.marginPercentage ?? 50
                const managerSharePercentage = 100 - investorSharePercentage
                if (transactionStatus === "COMPLETED") {
                    validateImportProfitShares(investorSharePercentage, managerSharePercentage)
                }

                await prisma.$transaction(async (tx) => {
                // Create transaction
                const transaction = await tx.transaction.create({
                    data: {
                        unitId,
                        transactionCode,
                        buyDate: parsedBuyDate,
                        buyPrice: parsedBuyPrice,
                        sellDate: parsedSellDate,
                        sellPrice: parsedSellPrice,
                        initialInvestorCapital: parsedInitialInvestorCapital,
                        initialManagerCapital: parsedInitialManagerCapital,
                        status: transactionStatus
                    }
                })

                // Create cost records if any costs are provided
                const costs: Array<{ costType: string, amount: number, payer: string, description: string }> = []

                if (biayaInspector && parseImportNumber(biayaInspector, "biayaInspector", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Inspector",
                        amount: parseImportNumber(biayaInspector, "biayaInspector", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya inspector"
                    })
                }

                if (biayaTransport && parseImportNumber(biayaTransport, "biayaTransport", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Transport",
                        amount: parseImportNumber(biayaTransport, "biayaTransport", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya transport"
                    })
                }

                if (biayaMakan && parseImportNumber(biayaMakan, "biayaMakan", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Makan",
                        amount: parseImportNumber(biayaMakan, "biayaMakan", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya makan"
                    })
                }

                if (biayaTol && parseImportNumber(biayaTol, "biayaTol", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Tol",
                        amount: parseImportNumber(biayaTol, "biayaTol", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya tol"
                    })
                }

                if (biayaIklan && parseImportNumber(biayaIklan, "biayaIklan", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Iklan",
                        amount: parseImportNumber(biayaIklan, "biayaIklan", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya iklan"
                    })
                }

                if (biayaPRUnit && parseImportNumber(biayaPRUnit, "biayaPRUnit", { min: 0 })! > 0) {
                    costs.push({
                        costType: "PR Unit",
                        amount: parseImportNumber(biayaPRUnit, "biayaPRUnit", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya PR unit"
                    })
                }

                if (biayaBensin && parseImportNumber(biayaBensin, "biayaBensin", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Bensin",
                        amount: parseImportNumber(biayaBensin, "biayaBensin", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya bensin"
                    })
                }

                if (biayaParkir && parseImportNumber(biayaParkir, "biayaParkir", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Parkir",
                        amount: parseImportNumber(biayaParkir, "biayaParkir", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya parkir"
                    })
                }

                if (biayaMaterai && parseImportNumber(biayaMaterai, "biayaMaterai", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Materai",
                        amount: parseImportNumber(biayaMaterai, "biayaMaterai", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya materai"
                    })
                }

                if (biayaMakelar && parseImportNumber(biayaMakelar, "biayaMakelar", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Makelar",
                        amount: parseImportNumber(biayaMakelar, "biayaMakelar", { min: 0 })!,
                        payer: "MANAGER",
                        description: "Biaya makelar"
                    })
                }

                if (biayaLainLainPemodal && parseImportNumber(biayaLainLainPemodal, "biayaLainLainPemodal", { min: 0 })! > 0) {
                    costs.push({
                        costType: "Lain-lain",
                        amount: parseImportNumber(biayaLainLainPemodal, "biayaLainLainPemodal", { min: 0 })!,
                        payer: "INVESTOR",
                        description: "Biaya lain-lain dari pemodal"
                    })
                }

                // Create all cost records
                if (costs.length > 0) {
                    await tx.cost.createMany({
                        data: costs.map(cost => ({
                            transactionId: transaction.id,
                            ...cost
                        }))
                    })
                }

                // If transaction is COMPLETED (has sell date and price), create profitSharing record
                if (transactionStatus === "COMPLETED" && parsedSellDate && sellPrice) {
                    // Use shared calculation — same as active finalization path
                    const calculation = calculateProfitSharing({
                        buyPrice: parsedBuyPrice,
                        sellPrice: parsedSellPrice!,
                        initialInvestorCapital: parsedInitialInvestorCapital,
                        initialManagerCapital: parsedInitialManagerCapital,
                        costs,
                        investorSharePercentage,
                        managerSharePercentage,
                    })

                    // Create profitSharing record
                    await tx.profitSharing.create({
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
                    await tx.transaction.update({
                        where: { id: transaction.id },
                        data: { profitStatus: calculation.profitStatus }
                    })

                    // Update unit status to SOLD
                    await tx.unit.update({
                        where: { id: unitId },
                        data: { status: "SOLD" }
                    })
                }

                })
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
