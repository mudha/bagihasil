import { db } from "@/lib/db"
import { getHijriMonthYear } from "@/lib/date-utils"

export async function getInvestorDashboardData(userId: string) {
    // 1. Find Investor attached to this User
    const investor = await db.investor.findUnique({
        where: { userId },
        include: {
            units: {
                where: { status: "AVAILABLE" }, // Only active units for count
            },
            paymentHistories: true
        }
    })

    if (!investor) return null

    // 2. Calculate Total Investment (Current Active Units + Completed Transactions)
    // We need to fetch transactions where this investor participated.

    // Fetch all transactions for units owned by this investor
    const transactions = await db.transaction.findMany({
        where: {
            unit: {
                investorId: investor.id
            }
        },
        include: {
            profitSharing: true,
            costs: true // to double check logic if needed
        },
        orderBy: {
            sellDate: 'asc' // Ensure chronological order for charts
        }
    })

    // Calculate Metrics
    let totalInvested = 0
    let activeCapital = 0
    let totalProfit = 0
    const activeUnitsCount = investor.units.length
    const totalUnitsCount = await db.unit.count({ where: { investorId: investor.id } })

    // Total Invested & Active Capital Calculation
    const allInvestorUnits = await db.unit.findMany({
        where: { investorId: investor.id },
        include: { transactions: true }
    })

    for (const unit of allInvestorUnits) {
        const trx = unit.transactions[0]
        if (trx) {
            const capital = trx.initialInvestorCapital ?? trx.buyPrice
            totalInvested += capital
            if (trx.status === "ON_PROCESS") {
                activeCapital += capital
            }
        }
    }

    // Total Profit Calculation (From ProfitSharing table)
    for (const trx of transactions) {
        if (trx.profitSharing && trx.profitSharing.investorProfitAmount > 0) {
            totalProfit += trx.profitSharing.investorProfitAmount
        }
    }

    // Total Received (Payments)
    const totalReceived = investor.paymentHistories.reduce((acc, curr) => acc + curr.amount, 0)

    // Calculate Monthly Stats (Income and Sales Trend)
    const monthlyIncomeStats = new Map<string, number>()
    const monthlySalesStats = new Map<string, number>()

    // Hijri Maps
    const monthlyIncomeStatsHijriMap = new Map<string, { month: string, income: number, rank: number }>()
    const monthlySalesStatsHijriMap = new Map<string, { month: string, count: number, rank: number }>()

    const now = new Date()
    const months = []

    // Initialize last 6 months (including current) for Gregorian
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`
        const label = d.toLocaleDateString("id-ID", { month: "short", year: "numeric" })
        monthlyIncomeStats.set(key, 0)
        monthlySalesStats.set(key, 0)
        months.push({ key, label })
    }

    // Use Transactions for Monthly Stats (Based on PROFIT SHARING)
    transactions.forEach(trx => {
        if (!trx.sellDate) return
        const d = new Date(trx.sellDate)

        // Gregorian Key
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`

        // Income (Investor's Profit Share)
        if (monthlyIncomeStats.has(key) && trx.profitSharing) {
            monthlyIncomeStats.set(key, (monthlyIncomeStats.get(key) || 0) + trx.profitSharing.investorProfitAmount)
        }

        // Sales Trend (Count of units sold)
        if (monthlySalesStats.has(key)) {
            monthlySalesStats.set(key, (monthlySalesStats.get(key) || 0) + 1)
        }

        // --- Hijri Grouping ---
        const hijri = getHijriMonthYear(d)
        const hijriKey = hijri.key

        // Initialize if not exists
        if (!monthlyIncomeStatsHijriMap.has(hijriKey)) {
            // We use rank (timestamp) to sort later
            monthlyIncomeStatsHijriMap.set(hijriKey, { month: hijriKey, income: 0, rank: d.getTime() })
            monthlySalesStatsHijriMap.set(hijriKey, { month: hijriKey, count: 0, rank: d.getTime() })
        }

        if (trx.profitSharing) {
            const current = monthlyIncomeStatsHijriMap.get(hijriKey)!
            current.income += trx.profitSharing.investorProfitAmount
        }

        const currentSales = monthlySalesStatsHijriMap.get(hijriKey)!
        currentSales.count += 1
    })

    const monthlyChartData = months.map(m => ({
        month: m.label,
        income: monthlyIncomeStats.get(m.key) || 0
    }))

    const monthlySalesTrend = months.map(m => ({
        month: m.label,
        count: monthlySalesStats.get(m.key) || 0
    }))

    // Convert Hijri maps to sorted arrays
    const monthlyChartDataHijri = Array.from(monthlyIncomeStatsHijriMap.values())
        .sort((a, b) => a.rank - b.rank)
        .map(item => ({ month: item.month, income: item.income }))

    const monthlySalesTrendHijri = Array.from(monthlySalesStatsHijriMap.values())
        .sort((a, b) => a.rank - b.rank)
        .map(item => ({ month: item.month, count: item.count }))

    // Recent transactions (reversed because we fetched asc)
    const recentTransactions = [...transactions].reverse().slice(0, 5)

    return {
        investor,
        stats: {
            totalInvested,
            activeCapital,
            totalProfit,
            totalReceived,
            activeUnitsCount,
            totalUnitsCount
        },
        monthlyChartData,
        monthlySalesTrend,
        monthlyChartDataHijri,
        monthlySalesTrendHijri,
        recentTransactions
    }
}
