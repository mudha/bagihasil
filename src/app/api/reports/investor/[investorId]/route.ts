import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ investorId: string }> }
) {
    try {
        const { investorId } = await params

        // Fetch investor details
        const investor = await prisma.investor.findUnique({
            where: { id: investorId },
            include: {
                units: {
                    include: {
                        transactions: {
                            include: {
                                costs: true,
                                profitSharing: true,
                                paymentHistories: true
                            },
                            orderBy: {
                                buyDate: 'desc'
                            }
                        }
                    }
                }
            }
        })

        if (!investor) {
            return NextResponse.json(
                { error: 'Investor tidak ditemukan' },
                { status: 404 }
            )
        }

        // Aggregate all completed transactions
        const allTransactions = investor.units.flatMap((unit: any) =>
            unit.transactions.map((tx: any) => ({
                ...tx,
                unitName: unit.name,
                unitPlateNumber: unit.plateNumber
            }))
        )

        // Calculate summary statistics
        const totalCompletedTransactions = allTransactions.filter((tx: any) => tx.status === 'COMPLETED').length
        const totalProfit = allTransactions.reduce(
            (sum: number, tx: any) => sum + (tx.profitSharing?.investorProfitAmount || 0),
            0
        )
        const totalCapitalDeployed = investor.units.reduce((sum: number, unit: any) => {
            const activeTransactions = unit.transactions.filter(
                (tx: any) => tx.status === 'ON_PROCESS'
            )
            return sum + activeTransactions.reduce(
                (txSum: number, tx: any) => txSum + (tx.initialInvestorCapital || tx.buyPrice),
                0
            )
        }, 0)

        const activeUnitsCount = investor.units.filter((unit: any) =>
            unit.status === 'AVAILABLE' || unit.transactions.some((tx: any) => tx.status === 'ON_PROCESS')
        ).length

        // Calculate monthly profit
        const monthlyProfitMap = new Map<string, number>()

        allTransactions.forEach((tx: any) => {
            if (tx.status === 'COMPLETED' && tx.profitSharing?.investorProfitAmount) {
                // Use sellDate for profit timing, fallback to buyDate, fallback to now
                const date = tx.sellDate ? new Date(tx.sellDate) : (tx.buyDate ? new Date(tx.buyDate) : new Date())
                const key = format(date, 'yyyy-MM') // Sortable format

                const current = monthlyProfitMap.get(key) || 0
                monthlyProfitMap.set(key, current + tx.profitSharing.investorProfitAmount)
            }
        })

        // Fill in missing months if needed, or just return observed months
        // For now, let's return last 12 months or just the observed months sorted
        const monthlyProfit = Array.from(monthlyProfitMap.entries())
            .map(([key, value]) => {
                const [year, month] = key.split('-').map(Number)
                return {
                    year,
                    month, // 1-12
                    amount: value,
                    label: format(new Date(year, month - 1), 'MMM yyyy')
                }
            })
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year
                return a.month - b.month
            })

        // Prepare report data
        const reportData = {
            investor: {
                id: investor.id,
                name: investor.name,
                contactInfo: investor.contactInfo || '-',
                bankAccountDetails: investor.bankAccountDetails || '-',
                notes: investor.notes || '-'
            },
            summary: {
                totalActiveUnits: activeUnitsCount,
                totalCompletedTransactions,
                totalCapitalDeployed,
                totalProfit
            },
            monthlyProfit, // Add this
            transactions: allTransactions.map((tx: any) => ({
                id: tx.id,
                transactionCode: tx.transactionCode,
                unitName: tx.unitName,
                unitPlateNumber: tx.unitPlateNumber,
                buyDate: tx.buyDate,
                sellDate: tx.sellDate,
                buyPrice: tx.buyPrice,
                sellPrice: tx.sellPrice || 0,
                initialInvestorCapital: tx.initialInvestorCapital || tx.buyPrice,
                initialManagerCapital: tx.initialManagerCapital || 0,
                totalCosts: tx.costs.reduce((sum: number, cost: any) => sum + cost.amount, 0),
                investorCosts: tx.costs
                    .filter((cost: any) => cost.payer === 'INVESTOR')
                    .reduce((sum: number, cost: any) => sum + cost.amount, 0),
                managerCosts: tx.costs
                    .filter((cost: any) => cost.payer === 'MANAGER')
                    .reduce((sum: number, cost: any) => sum + cost.amount, 0),
                netMargin: tx.profitSharing?.netMargin || 0,
                investorProfitAmount: tx.profitSharing?.investorProfitAmount || 0,
                managerProfitAmount: tx.profitSharing?.managerProfitAmount || 0,
                paymentStatus: tx.paymentStatus,
                totalPaid: tx.paymentHistories.reduce((sum: number, ph: any) => sum + ph.amount, 0),
                costs: tx.costs.map((cost: any) => ({
                    costType: cost.costType,
                    payer: cost.payer,
                    amount: cost.amount,
                    description: cost.description
                })),
                paymentHistories: tx.paymentHistories.map((ph: any) => ({
                    id: ph.id,
                    amount: ph.amount,
                    paymentDate: ph.paymentDate,
                    method: ph.method,
                    proofImageUrl: ph.proofImageUrl,
                    notes: ph.notes
                }))
            })),
            generatedAt: new Date().toISOString()
        }

        return NextResponse.json(reportData)
    } catch (error) {
        console.error('Error generating investor report:', error)
        return NextResponse.json(
            { error: 'Gagal menghasilkan laporan' },
            { status: 500 }
        )
    }
}
