import { describe, expect, it } from "vitest"
import { computeInvestorReportSummary, type InvestorUnitLike } from "./investor-report-summary"

const completedTx = {
    status: "COMPLETED",
    buyPrice: 100_000_000,
    initialInvestorCapital: 80_000_000,
    profitSharing: { investorProfitAmount: 5_000_000 },
    costs: [
        { payer: "INVESTOR", amount: 1_000_000 },
        { payer: "MANAGER", amount: 2_000_000 },
    ],
    paymentHistories: [{ amount: 3_000_000 }, { amount: 2_000_000 }],
}

const activeTx = {
    status: "ON_PROCESS",
    buyPrice: 90_000_000,
    initialInvestorCapital: 70_000_000,
    profitSharing: null,
    costs: [],
    paymentHistories: [],
}

const activeTxZeroCapital = {
    status: "ON_PROCESS",
    buyPrice: 80_000_000,
    initialInvestorCapital: 0,
    profitSharing: null,
    costs: [],
    paymentHistories: [],
}

const activeTxWithAbnormalProfit = {
    ...activeTx,
    profitSharing: { investorProfitAmount: 999_000_000 },
}

const completedTxNullCapital = {
    status: "COMPLETED",
    buyPrice: 120_000_000,
    initialInvestorCapital: null,
    profitSharing: { investorProfitAmount: 3_000_000 },
    costs: [],
    paymentHistories: [],
}

function units(...txList: InvestorUnitLike["transactions"][]): InvestorUnitLike[] {
    return txList.map((transactions) => ({ status: "SOLD", transactions }))
}

function unitsWithStatus(status: string, txList: InvestorUnitLike["transactions"]): InvestorUnitLike[] {
    return [{ status, transactions: txList }]
}

describe("computeInvestorReportSummary", () => {
    it("counts completed transactions and sums profit from completed only", () => {
        const summary = computeInvestorReportSummary(units([completedTx, activeTx]))

        expect(summary.totalCompletedTransactions).toBe(1)
        expect(summary.totalProfit).toBe(5_000_000)
    })

    it("does not count active transactions in completed count or profit", () => {
        const summary = computeInvestorReportSummary(units([activeTx, activeTxWithAbnormalProfit]))

        expect(summary.totalCompletedTransactions).toBe(0)
        expect(summary.totalProfit).toBe(0)
    })

    it("computes capital deployed from active transactions with nullish fallback", () => {
        const summary = computeInvestorReportSummary(units([activeTx]))

        expect(summary.totalCapitalDeployed).toBe(70_000_000)
    })

    it("treats initialInvestorCapital = 0 as valid (does not fallback to buyPrice)", () => {
        const summary = computeInvestorReportSummary(units([activeTxZeroCapital]))

        expect(summary.totalCapitalDeployed).toBe(0)
    })

    it("falls back to buyPrice only when initialInvestorCapital is null or undefined", () => {
        const summary = computeInvestorReportSummary(units([completedTxNullCapital]))

        // completedTxNullCapital is COMPLETED so not counted in capital
        expect(summary.totalCapitalDeployed).toBe(0)

        const activeNull = { ...completedTxNullCapital, status: "ON_PROCESS", profitSharing: null }
        const summary2 = computeInvestorReportSummary(units([activeNull]))
        expect(summary2.totalCapitalDeployed).toBe(120_000_000)
    })

    it("counts active units by AVAILABLE status or ON_PROCESS transactions", () => {
        const summary = computeInvestorReportSummary([
            ...unitsWithStatus("AVAILABLE", []),
            ...unitsWithStatus("SOLD", [completedTx]),
            ...unitsWithStatus("SOLD", [activeTx]),
        ])

        expect(summary.activeUnitsCount).toBe(2)
    })

    it("returns zero for empty units", () => {
        const summary = computeInvestorReportSummary([])

        expect(summary.totalCompletedTransactions).toBe(0)
        expect(summary.totalProfit).toBe(0)
        expect(summary.totalCapitalDeployed).toBe(0)
        expect(summary.activeUnitsCount).toBe(0)
    })

    it("sums capital from multiple active transactions across units", () => {
        const summary = computeInvestorReportSummary(units([activeTx, activeTxZeroCapital]))

        expect(summary.totalCapitalDeployed).toBe(70_000_000 + 0)
    })
})
