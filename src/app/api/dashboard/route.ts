import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getHijriMonthYear } from "@/lib/date-utils"
import { canReadAdminData, getInvestorForSession } from "@/lib/api-auth"

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        let investorId = searchParams.get('investorId')
        const monthsParam = searchParams.get('months')
        const monthsRange = monthsParam ? parseInt(monthsParam) : 6 // Default 6 months as requested

        if (session.user.role === "INVESTOR") {
            const investor = await getInvestorForSession(session)
            if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
            investorId = investor.id
        } else if (!canReadAdminData(session)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

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

        // 3. Monthly Stats (Gregorian & Hijri)
        const startDate = new Date()
        startDate.setMonth(startDate.getMonth() - (monthsRange - 1)) // -1 because current month is included
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)

        const monthlyWhere: any = {
            calculatedAt: {
                gte: startDate
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
                        sellDate: true,
                        sellPrice: true
                    }
                }
            },
            orderBy: {
                calculatedAt: 'asc'
            }
        })

        const monthlyStatsMap = new Map<string, { month: string, totalMargin: number, investorShare: number, managerShare: number, unitsSold: number, totalRevenue: number }>()

        // Initialize last N months with 0
        for (let i = 0; i < monthsRange; i++) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) // e.g., "Dec 2025"
            monthlyStatsMap.set(key, { month: key, totalMargin: 0, investorShare: 0, managerShare: 0, unitsSold: 0, totalRevenue: 0 })
        }

        // Gregorian Grouping
        monthlyProfits.forEach(profit => {
            const sellDate = profit.transaction?.sellDate
            if (!sellDate) return // Skip if no sell date

            const key = sellDate.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
            if (monthlyStatsMap.has(key)) {
                const current = monthlyStatsMap.get(key)!
                current.totalMargin += profit.netMargin
                current.investorShare += profit.investorProfitAmount
                current.managerShare += profit.managerProfitAmount
                current.unitsSold += 1
                current.totalRevenue += (profit.transaction?.sellPrice || 0)
            }
        })

        // Hijri Grouping
        const monthlyStatsHijriMap = new Map<string, { month: string, totalMargin: number, investorShare: number, managerShare: number, unitsSold: number, totalRevenue: number }>()

        // We can't easily iterate "last 6 Hijri months" without a complex library, 
        // effectively we will just group the fetched profits by Hijri month.
        // The query "monthsRange" still applies to the calculatedAt date in Gregorian, 
        // which roughly corresponds to the recent period.

        monthlyProfits.forEach(profit => {
            const sellDate = profit.transaction?.sellDate
            if (!sellDate) return

            const { key } = getHijriMonthYear(sellDate)

            if (!monthlyStatsHijriMap.has(key)) {
                monthlyStatsHijriMap.set(key, { month: key, totalMargin: 0, investorShare: 0, managerShare: 0, unitsSold: 0, totalRevenue: 0 })
            }

            const current = monthlyStatsHijriMap.get(key)!
            current.totalMargin += profit.netMargin
            current.investorShare += profit.investorProfitAmount
            current.managerShare += profit.managerProfitAmount
            current.unitsSold += 1
            current.totalRevenue += (profit.transaction?.sellPrice || 0)
        })

        // Sort Hijri stats (rough sort by assuming order in array or using first date found, but Map iteration order is insertion order usually)
        // Better: Sort by the actual sellDate of the first transaction in that bucket? 
        // For simplicity, we'll convert to array. The order might need improvement if months are non-continuous.
        const monthlyStatsHijri = Array.from(monthlyStatsHijriMap.values())
        // To sort properly we might need a mapping key -> comparable value. 
        // Given we fetch by date ascending, the insertion order in Map should be correct.

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

        // Tax Reminders (Due in next 30 days)
        const today = new Date()
        const next30Days = new Date()
        next30Days.setDate(today.getDate() + 30)

        const taxRemindersQuery = await prisma.unit.findMany({
            where: {
                status: 'AVAILABLE', // Only check active units
                taxDueDate: {
                    lte: next30Days
                },
                ...(investorId ? { investorId } : {})
            },
            select: {
                id: true,
                name: true,
                plateNumber: true,
                taxDueDate: true
            },
            orderBy: {
                taxDueDate: 'asc'
            }
        })

        const taxReminders = taxRemindersQuery.map(unit => {
            const taxDate = new Date(unit.taxDueDate!)
            const diffTime = taxDate.getTime() - today.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            return {
                id: unit.id,
                name: unit.name,
                plateNumber: unit.plateNumber,
                taxDueDate: unit.taxDueDate,
                daysLeft: diffDays
            }
        })

        return NextResponse.json({
            activeUnits,
            completedTransactions,
            totalMargin: profitStats._sum.netMargin || 0,
            totalInvestorProfit: profitStats._sum.investorProfitAmount || 0,
            totalManagerProfit: profitStats._sum.managerProfitAmount || 0,
            totalCapitalDeployed,
            investorStats,
            monthlyStats, // Gregorian
            monthlyStatsHijri,
            unitStatusDistribution,
            recentTransactions: formattedRecentTransactions,
            taxReminders
        })
    } catch (error) {
        console.error("Dashboard API Error:", error)
        return NextResponse.json({
            error: "Failed to fetch dashboard data",
            details: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
    }
}
