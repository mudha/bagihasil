import { db } from "@/lib/db"

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
        }
    })

    // Calculate Metrics
    let totalInvested = 0
    let totalProfit = 0
    const activeUnitsCount = investor.units.length
    const totalUnitsCount = await db.unit.count({ where: { investorId: investor.id } })

    // Total Invested Calculation (Approximation based on buys)
    // For a more accurate number, we might need to sum 'initialInvestorCapital' or 'buyPrice' of active units
    // + capital of closed units.

    // Let's simplify: Sum of buyPrice/Capital for ALL units this investor funded.
    // Fetch ALL units to calculate capital
    const allInvestorUnits = await db.unit.findMany({
        where: { investorId: investor.id },
        include: { transactions: true }
    })

    for (const unit of allInvestorUnits) {
        // If unit has a transaction
        const trx = unit.transactions[0] // Assuming 1 active/last trx usually
        if (trx) {
            const capital = trx.initialInvestorCapital ?? trx.buyPrice
            totalInvested += capital
        } else {
            // If unit just created but no transaction linked yet (unlikely in this flow but possible)
            // We can't know capital easily without transaction data. 
            // Maybe skip or assume 0 until transaction created.
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

    return {
        investor,
        stats: {
            totalInvested,
            totalProfit,
            totalReceived,
            activeUnitsCount,
            totalUnitsCount
        },
        recentTransactions: transactions.slice(0, 5) // Last 5 transactions
    }
}
