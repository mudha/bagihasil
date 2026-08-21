export type ProfitSharingCost = {
    payer: string
    amount: number
}

export type ProfitSharingInput = {
    buyPrice: number
    sellPrice: number
    initialInvestorCapital?: number | null
    initialManagerCapital?: number | null
    costs: ProfitSharingCost[]
    investorSharePercentage: number
    managerSharePercentage: number
}

export type ProfitStatus = "PROFIT" | "LOSS" | "BREAK_EVEN"

export function calculateProfitSharing(input: ProfitSharingInput) {
    const investorCosts = input.costs
        .filter(cost => cost.payer === "INVESTOR")
        .reduce((sum, cost) => sum + cost.amount, 0)
    const managerCosts = input.costs
        .filter(cost => cost.payer === "MANAGER")
        .reduce((sum, cost) => sum + cost.amount, 0)

    const totalCapitalInvestor = (input.initialInvestorCapital ?? input.buyPrice) + investorCosts
    const totalCapitalManager = (input.initialManagerCapital ?? 0) + managerCosts
    const totalCapital = totalCapitalInvestor + totalCapitalManager
    const netMargin = Math.round(input.sellPrice - input.buyPrice - investorCosts - managerCosts)

    let profitStatus: ProfitStatus = "BREAK_EVEN"
    let investorProfitAmount = 0
    let managerProfitAmount = 0

    if (netMargin > 0) {
        profitStatus = "PROFIT"
        investorProfitAmount = Math.round(netMargin * input.investorSharePercentage / 100)
        managerProfitAmount = netMargin - investorProfitAmount
    } else if (netMargin < 0) {
        profitStatus = "LOSS"
    }

    return {
        totalCapitalInvestor,
        totalCapitalManager,
        totalCapital,
        netMargin,
        profitStatus,
        investorProfitAmount,
        managerProfitAmount,
    }
}