import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getHijriMonthYear } from "@/lib/date-utils"
import { canReadAdminData, getInvestorForSession } from "@/lib/api-auth"
import { investorStatsScope } from "@/lib/dashboard-access"
import { getTopSellingUnits } from "../../../lib/top-selling"
import {
    buildPeriodBucketKeys,
    parseDashboardPeriod,
    periodBucketKey,
    periodBucketLabel,
    periodDateFilter,
} from "../../../lib/dashboard-period"

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        let investorId = searchParams.get('investorId')
        const parsedPeriod = parseDashboardPeriod(searchParams)
        if (!parsedPeriod.ok) {
            return NextResponse.json({ error: parsedPeriod.error }, { status: 400 })
        }
        const { period } = parsedPeriod
        const dateFilter = periodDateFilter(period)

        if (session.user.role === "INVESTOR") {
            const investor = await getInvestorForSession(session)
            if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })
            investorId = investor.id
        } else if (!canReadAdminData(session)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // 1. General Stats
        const unitWhere: any = {
            status: "AVAILABLE",
            transactions: {
                some: {
                    status: "ON_PROCESS",
                    ...(dateFilter ? { buyDate: dateFilter } : {}),
                }
            }
        }
        const transactionWhere: any = {
            status: "COMPLETED",
            ...(dateFilter ? { sellDate: dateFilter } : {}),
        }
        const profitWhere: any = {
            transaction: {
                status: "COMPLETED",
                ...(dateFilter ? { sellDate: dateFilter } : {}),
            }
        }

        if (investorId) {
            unitWhere.investorId = investorId
            transactionWhere.unit = { investorId }
            profitWhere.transaction.unit = { investorId }
        }

        const [activeUnits, completedTransactions, profitStats, topSellingUnits] = await Promise.all([
            prisma.unit.count({ where: unitWhere }),
            prisma.transaction.count({ where: transactionWhere }),
            prisma.profitSharing.aggregate({
                where: profitWhere,
                _sum: {
                    netMargin: true,
                    investorProfitAmount: true,
                    managerProfitAmount: true
                }
            }),
            getTopSellingUnits(period, investorId),
        ])

        // 2. Investor Stats. Admin/viewer see the selector; investors only see their own row.
        const investors = await prisma.investor.findMany({
            where: investorStatsScope(session.user.role === "INVESTOR" ? investorId : null),
            select: {
                id: true,
                name: true,
                units: {
                    select: {
                        status: true,
                        transactions: {
                            where: {
                                OR: [
                                    { status: 'ON_PROCESS', ...(dateFilter ? { buyDate: dateFilter } : {}) },
                                    { status: 'COMPLETED', ...(dateFilter ? { sellDate: dateFilter } : {}) }
                                ]
                            },
                            select: {
                                status: true,
                                sellDate: true,
                                profitSharing: {
                                    select: {
                                        investorProfitAmount: true,
                                        totalCapitalInvestor: true
                                    }
                                }
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
                if (unit.status === 'AVAILABLE' && unit.transactions.some(tx => tx.status === 'ON_PROCESS')) {
                    activeUnitsCount++
                }

                unit.transactions.forEach(tx => {
                    if (tx.status !== 'COMPLETED') return
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
        }).sort((a, b) => {
            if (b.totalProfit !== a.totalProfit) return b.totalProfit - a.totalProfit
            return a.name.localeCompare(b.name, "id-ID")
        })

        // 3. Monthly Stats (Gregorian & Hijri)
        const monthlyWhere: any = {
            transaction: {
                status: 'COMPLETED',
                ...(dateFilter ? { sellDate: dateFilter } : {}),
            }
        }

        if (investorId) {
            monthlyWhere.transaction.unit = { investorId }
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

        const sellDates = monthlyProfits.flatMap(profit => profit.transaction?.sellDate ? [new Date(profit.transaction.sellDate)] : [])
        for (const key of buildPeriodBucketKeys(period, sellDates)) {
            monthlyStatsMap.set(key, {
                month: periodBucketLabel(key, period.granularity),
                totalMargin: 0,
                investorShare: 0,
                managerShare: 0,
                unitsSold: 0,
                totalRevenue: 0,
            })
        }

        // Gregorian Grouping
        monthlyProfits.forEach(profit => {
            const sellDate = profit.transaction?.sellDate
            if (!sellDate) return // Skip if no sell date

            const key = periodBucketKey(sellDate, period.granularity)
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

        // The selected Gregorian/Jakarta date window remains authoritative; the
        // fetched rows are then labelled and grouped in the chosen Hijri view.

        monthlyProfits.forEach(profit => {
            const sellDate = profit.transaction?.sellDate
            if (!sellDate) return

            const hijri = getHijriMonthYear(sellDate)
            const key = period.granularity === "year" ? `${hijri.year} H` : hijri.key

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
        const monthlyStats = Array.from(monthlyStatsMap.values())

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
            select: {
                id: true,
                transactionCode: true,
                status: true,
                buyPrice: true,
                sellPrice: true,
                buyDate: true,
                sellDate: true,
                updatedAt: true,
                unit: {
                    select: {
                        name: true
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
                ...(dateFilter ? { buyDate: dateFilter } : {}),
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
            topSellingUnits,
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
