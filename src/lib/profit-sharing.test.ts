import { describe, expect, it } from "vitest"

import { calculateProfitSharing } from "./profit-sharing"

describe("calculateProfitSharing", () => {
    it("splits a positive net margin using the configured percentages", () => {
        const result = calculateProfitSharing({
            buyPrice: 100_000_000,
            sellPrice: 120_000_000,
            initialInvestorCapital: null,
            initialManagerCapital: null,
            costs: [
                { payer: "INVESTOR", amount: 2_000_000 },
                { payer: "MANAGER", amount: 3_000_000 },
            ],
            investorSharePercentage: 40,
            managerSharePercentage: 60,
        })

        expect(result).toEqual({
            totalCapitalInvestor: 102_000_000,
            totalCapitalManager: 3_000_000,
            totalCapital: 105_000_000,
            netMargin: 15_000_000,
            profitStatus: "PROFIT",
            investorProfitAmount: 6_000_000,
            managerProfitAmount: 9_000_000,
        })
    })

    it("returns zero profit shares for a loss", () => {
        const result = calculateProfitSharing({
            buyPrice: 100_000_000,
            sellPrice: 95_000_000,
            costs: [{ payer: "MANAGER", amount: 2_000_000 }],
            investorSharePercentage: 50,
            managerSharePercentage: 50,
        })

        expect(result.netMargin).toBe(-7_000_000)
        expect(result.profitStatus).toBe("LOSS")
        expect(result.investorProfitAmount).toBe(0)
        expect(result.managerProfitAmount).toBe(0)
    })

    it("classifies an exact zero margin as break even", () => {
        const result = calculateProfitSharing({
            buyPrice: 100_000_000,
            sellPrice: 105_000_000,
            costs: [{ payer: "INVESTOR", amount: 5_000_000 }],
            investorSharePercentage: 40,
            managerSharePercentage: 60,
        })

        expect(result.netMargin).toBe(0)
        expect(result.profitStatus).toBe("BREAK_EVEN")
        expect(result.investorProfitAmount).toBe(0)
        expect(result.managerProfitAmount).toBe(0)
    })

    it("tracks explicit investor and manager capital in capital totals", () => {
        const result = calculateProfitSharing({
            buyPrice: 100_000_000,
            sellPrice: 115_000_000,
            initialInvestorCapital: 80_000_000,
            initialManagerCapital: 20_000_000,
            costs: [
                { payer: "INVESTOR", amount: 1_000_000 },
                { payer: "MANAGER", amount: 4_000_000 },
            ],
            investorSharePercentage: 40,
            managerSharePercentage: 60,
        })

        expect(result.totalCapitalInvestor).toBe(81_000_000)
        expect(result.totalCapitalManager).toBe(24_000_000)
        expect(result.totalCapital).toBe(105_000_000)
        expect(result.netMargin).toBe(10_000_000)
    })

    it("preserves the existing rule that the manager receives the remaining profit", () => {
        const result = calculateProfitSharing({
            buyPrice: 100_000_000,
            sellPrice: 110_000_000,
            costs: [],
            investorSharePercentage: 40,
            managerSharePercentage: 50,
        })

        expect(result.investorProfitAmount).toBe(4_000_000)
        expect(result.managerProfitAmount).toBe(6_000_000)
    })
})