import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const investorId = searchParams.get('investorId')

    // 1. General Stats
    const unitWhere: any = { status: "AVAILABLE" }
    const transactionWhere: any = { status: "COMPLETED" }
    const profitWhere: any = {}

    if (investorId) {
        unitWhere.investorId = investorId
        transactionWhere.unit = { investorId }
        profitWhere.transaction = { unit: { investorId } }
    }

    const activeUnits = await prisma.unit.count({ where: unitWhere })
    const completedTransactions = await prisma.transaction.count({ where: transactionWhere })

    const profitStats = await prisma.profitSharing.aggregate({
        where: profitWhere,
        _sum: {
            netMargin: true,
            investorProfitAmount: true,
            managerProfitAmount: true
        }
    })

    // 2. Investor Stats (Always fetch all for the list/selector)
    const investors = await prisma.investor.findMany({
        include: {
            units: {
                select: {
                    status: true,
                    transactions: {
                        where: { status: 'COMPLETED' },
                        include: {
                            profitSharing: true
                        }
                    }
                }
            }
        }
    })

    const investorStats = investors.map(investor => {
        let activeUnitsCount = 0
        let completedTransactionsCount = 0
        let totalInvestorProfit = 0
        let totalCapitalDeployed = 0 // Capital in completed transactions

        investor.units.forEach(unit => {
            if (unit.status === 'AVAILABLE') {
                activeUnitsCount++
            }

            unit.transactions.forEach(tx => {
                completedTransactionsCount++
                if (tx.profitSharing) {
                    totalInvestorProfit += tx.profitSharing.investorProfitAmount
                    totalCapitalDeployed += tx.profitSharing.totalCapitalInvestor
                }
            })
        })

        return {
            id: investor.id,
            name: investor.name,
            activeUnits: activeUnitsCount,
            completedTransactions: completedTransactionsCount,
            totalProfit: totalInvestorProfit,
            totalCapital: totalCapitalDeployed
        }
    })

    // 3. Monthly Stats (Last 12 Months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1) // Start of the month
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyWhere: any = {
        calculatedAt: {
            gte: twelveMonthsAgo
        }
    }

    if (investorId) {
        monthlyWhere.transaction = {
            unit: {
                investorId: investorId
            }
        }
    }

    const monthlyProfits = await prisma.profitSharing.findMany({
        where: monthlyWhere,
        select: {
            calculatedAt: true,
            netMargin: true,
            investorProfitAmount: true,
            managerProfitAmount: true,
            transaction: {
                select: {
                    sellDate: true
                }
            }
        },
        orderBy: {
            calculatedAt: 'asc'
        }
    })

    const monthlyStatsMap = new Map<string, { month: string, totalMargin: number, investorShare: number, managerShare: number }>()

    // Initialize last 12 months with 0 to ensure continuous graph
    for (let i = 0; i < 12; i++) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = d.toLocaleString('default', { month: 'short', year: 'numeric' }) // e.g., "Dec 2025"
        monthlyStatsMap.set(key, { month: key, totalMargin: 0, investorShare: 0, managerShare: 0 })
    }

    monthlyProfits.forEach(profit => {
        // Use sellDate from transaction for monthly grouping, not calculatedAt
        const sellDate = profit.transaction?.sellDate
        if (!sellDate) return // Skip if no sell date

        const key = sellDate.toLocaleString('default', { month: 'short', year: 'numeric' })
        if (monthlyStatsMap.has(key)) {
            const current = monthlyStatsMap.get(key)!
            current.totalMargin += profit.netMargin
            current.investorShare += profit.investorProfitAmount
            current.managerShare += profit.managerProfitAmount
        } else {
            monthlyStatsMap.set(key, {
                month: key,
                totalMargin: profit.netMargin,
                investorShare: profit.investorProfitAmount,
                managerShare: profit.managerProfitAmount
            })
        }
    })

    // Convert map to array and sort by date
    const monthlyStats = Array.from(monthlyStatsMap.values()).sort((a, b) => {
        const dateA = new Date(a.month)
        const dateB = new Date(b.month)
        return dateA.getTime() - dateB.getTime()
    })

    // 4. Unit Status Distribution
    const unitStatusStats = await prisma.unit.groupBy({
        by: ['status'],
        where: investorId ? { investorId } : {},
        _count: {
            status: true
        }
    })

    const unitStatusDistribution = unitStatusStats.map(stat => ({
        name: stat.status,
        value: stat._count.status
    }))

    // 5. Recent Transactions
    const recentTransactions = await prisma.transaction.findMany({
        where: investorId ? { unit: { investorId } } : {},
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            unit: {
                select: {
                    name: true,
                    plateNumber: true
                }
            }
        }
    })

    const formattedRecentTransactions = recentTransactions.map(tx => ({
        id: tx.id,
        code: tx.transactionCode,
        unitName: tx.unit.name,
        type: tx.status === 'COMPLETED' ? 'Sold' : 'Buy', // Simplified for now
        amount: tx.status === 'COMPLETED' ? (tx.sellPrice || 0) : tx.buyPrice,
        date: tx.status === 'COMPLETED' ? (tx.sellDate || tx.updatedAt) : tx.buyDate,
        status: tx.status
    }))

    // 6. Total Capital Deployed (Active Transactions)
    const activeTransactions = await prisma.transaction.findMany({
        where: {
            status: 'ON_PROCESS',
            ...(investorId ? { unit: { investorId } } : {})
        },
        select: {
            buyPrice: true,
            initialInvestorCapital: true
        }
    })

    const totalCapitalDeployed = activeTransactions.reduce((sum, tx) => {
        return sum + (tx.initialInvestorCapital ?? tx.buyPrice)
    }, 0)

    return NextResponse.json({
        activeUnits,
        completedTransactions,
        totalMargin: profitStats._sum.netMargin || 0,
        totalInvestorProfit: profitStats._sum.investorProfitAmount || 0,
        totalManagerProfit: profitStats._sum.managerProfitAmount || 0,
        totalCapitalDeployed,
        investorStats,
        monthlyStats,
        unitStatusDistribution,
        recentTransactions: formattedRecentTransactions
    })
}
