export type InvestorTransactionLike = {
    status: string
    buyPrice: number
    initialInvestorCapital?: number | null
    profitSharing?: {
        investorProfitAmount?: number | null
    } | null
    costs: Array<{ payer: string; amount: number }>
    paymentHistories: Array<{ amount: number }>
}

export type InvestorUnitLike = {
    status: string
    transactions: InvestorTransactionLike[]
}

export type InvestorReportSummary = {
    totalCompletedTransactions: number
    totalProfit: number
    totalCapitalDeployed: number
    activeUnitsCount: number
}

const COMPLETED = "COMPLETED"
const ACTIVE = "ON_PROCESS"

export function computeInvestorReportSummary(units: InvestorUnitLike[]): InvestorReportSummary {
    const allTransactions = units.flatMap((unit) => unit.transactions)
    const completedTransactions = allTransactions.filter((tx) => tx.status === COMPLETED)
    const activeTransactions = allTransactions.filter((tx) => tx.status === ACTIVE)

    const totalCompletedTransactions = completedTransactions.length

    const totalProfit = completedTransactions.reduce(
        (sum, tx) => sum + (tx.profitSharing?.investorProfitAmount || 0),
        0
    )

    const totalCapitalDeployed = activeTransactions.reduce(
        (sum, tx) => sum + (tx.initialInvestorCapital ?? tx.buyPrice),
        0
    )

    const activeUnitsCount = units.filter(
        (unit) => unit.status === "AVAILABLE" || unit.transactions.some((tx) => tx.status === ACTIVE)
    ).length

    return { totalCompletedTransactions, totalProfit, totalCapitalDeployed, activeUnitsCount }
}
