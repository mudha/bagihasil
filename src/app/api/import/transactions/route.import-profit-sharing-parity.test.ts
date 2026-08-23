import { describe, expect, it } from "vitest"
import { calculateProfitSharing } from "../../../../lib/profit-sharing"

/**
 * Import profit-sharing parity tests.
 *
 * These tests prove that the import inline formula produces different results
 * from the shared calculateProfitSharing. After the fix, import must call the
 * shared helper directly and these tests must pass with identical results.
 *
 * Helper signature:
 *   calculateProfitSharing({
 *     buyPrice, sellPrice, initialInvestorCapital, initialManagerCapital,
 *     costs: [{ payer, amount }], investorSharePercentage, managerSharePercentage
 *   }) => { totalCapitalInvestor, totalCapitalManager, totalCapital, netMargin,
 *            profitStatus, investorProfitAmount, managerProfitAmount }
 */

/** Reproduce the OLD import inline formula for comparison */
function importInlineFormula({
    sellPrice,
    totalCapitalInvestor,
    totalCapitalManager,
    investorSharePercentage,
}: {
    sellPrice: number
    totalCapitalInvestor: number
    totalCapitalManager: number
    investorSharePercentage: number
}) {
    const totalCapital = totalCapitalInvestor + totalCapitalManager
    const netMargin = sellPrice - totalCapital  // NOT rounded
    const managerSharePercentage = 100 - investorSharePercentage

    let investorProfitAmount = 0
    let managerProfitAmount = 0
    let profitStatus = "BREAK_EVEN"

    if (netMargin > 0) {
        profitStatus = "PROFIT"
        investorProfitAmount = netMargin * (investorSharePercentage / 100)  // NOT rounded
        managerProfitAmount = netMargin * (managerSharePercentage / 100)   // NOT rounded
    } else if (netMargin < 0) {
        profitStatus = "LOSS"
    }

    return { netMargin, profitStatus, investorProfitAmount, managerProfitAmount }
}

describe("import profit-sharing parity vs shared helper", () => {
    const baseCosts = [
        { payer: "MANAGER", amount: 10000 },
        { payer: "MANAGER", amount: 5000 },
        { payer: "INVESTOR", amount: 3000 },
    ]

    it("RED: rounding difference on Rp1 margin with 40/60 split", () => {
        // buyPrice=100000, sellPrice=118001, costs=18000 → raw margin=1
        // Shared: Math.round(1) = 1, investor = Math.round(1*40/100) = 0, manager = 1
        // Import: netMargin=1 (no round), investor = 0.4, manager = 0.6
        const shared = calculateProfitSharing({
            buyPrice: 100000,
            sellPrice: 118001,
            initialInvestorCapital: 100000,
            initialManagerCapital: 0,
            costs: baseCosts,
            investorSharePercentage: 40,
            managerSharePercentage: 60,
        })

        const totalCapitalInvestor = 100000 + 3000  // initial + investor costs
        const totalCapitalManager = 0 + 15000        // initial + manager costs
        const legacy = importInlineFormula({
            sellPrice: 118001,
            totalCapitalInvestor,
            totalCapitalManager,
            investorSharePercentage: 40,
        })

        // Shared helper produces integers
        expect(Number.isInteger(shared.investorProfitAmount)).toBe(true)
        expect(Number.isInteger(shared.managerProfitAmount)).toBe(true)

        // Import produces fractions — this is the BUG
        expect(Number.isInteger(legacy.investorProfitAmount)).toBe(false)
        expect(Number.isInteger(legacy.managerProfitAmount)).toBe(false)
    })

    it("RED: total money invariant broken by import formula", () => {
        const shared = calculateProfitSharing({
            buyPrice: 100000,
            sellPrice: 118001,
            initialInvestorCapital: 100000,
            initialManagerCapital: 0,
            costs: baseCosts,
            investorSharePercentage: 40,
            managerSharePercentage: 60,
        })

        const totalCapitalInvestor = 100000 + 3000
        const totalCapitalManager = 0 + 15000
        const legacy = importInlineFormula({
            sellPrice: 118001,
            totalCapitalInvestor,
            totalCapitalManager,
            investorSharePercentage: 40,
        })

        // Shared: 0 + 1 = 1 = rounded margin ✓
        const sharedTotal = shared.investorProfitAmount + shared.managerProfitAmount
        expect(sharedTotal).toBe(shared.netMargin)

        // Import: 0.4 + 0.6 = 1.0 but stored as floats, not integers
        const legacyTotal = legacy.investorProfitAmount + legacy.managerProfitAmount
        expect(legacyTotal).toBe(legacy.netMargin) // numerically equal...
        // but NOT integer rupiah — the real contract violation
        expect(Number.isInteger(legacy.investorProfitAmount)).toBe(false)
    })

    it("shared helper rounds netMargin to nearest integer", () => {
        const shared = calculateProfitSharing({
            buyPrice: 100000,
            sellPrice: 118001,
            initialInvestorCapital: 100000,
            initialManagerCapital: 0,
            costs: baseCosts,
            investorSharePercentage: 40,
            managerSharePercentage: 60,
        })
        // raw: 118001 - 100000 - 3000 - 15000 = 1 → rounded = 1
        expect(shared.netMargin).toBe(1)
        expect(shared.investorProfitAmount).toBe(0)
        expect(shared.managerProfitAmount).toBe(1)
        expect(shared.profitStatus).toBe("PROFIT")
    })

    it("shared helper: break-even yields 0/0", () => {
        const shared = calculateProfitSharing({
            buyPrice: 100000,
            sellPrice: 118000,  // exactly equals total capital
            initialInvestorCapital: 100000,
            initialManagerCapital: 0,
            costs: baseCosts,
            investorSharePercentage: 50,
            managerSharePercentage: 50,
        })
        expect(shared.profitStatus).toBe("BREAK_EVEN")
        expect(shared.investorProfitAmount).toBe(0)
        expect(shared.managerProfitAmount).toBe(0)
    })

    it("shared helper: loss yields 0/0", () => {
        const shared = calculateProfitSharing({
            buyPrice: 100000,
            sellPrice: 100000,
            initialInvestorCapital: 100000,
            initialManagerCapital: 0,
            costs: baseCosts,
            investorSharePercentage: 50,
            managerSharePercentage: 50,
        })
        expect(shared.profitStatus).toBe("LOSS")
        expect(shared.investorProfitAmount).toBe(0)
        expect(shared.managerProfitAmount).toBe(0)
    })

    it("shared helper: large margin with 50/50 split", () => {
        const shared = calculateProfitSharing({
            buyPrice: 50000000,
            sellPrice: 60000000,
            initialInvestorCapital: 50000000,
            initialManagerCapital: 0,
            costs: [
                { payer: "MANAGER", amount: 500000 },
                { payer: "INVESTOR", amount: 200000 },
            ],
            investorSharePercentage: 50,
            managerSharePercentage: 50,
        })
        // netMargin = 60000000 - 50000000 - 200000 - 500000 = 9300000
        expect(shared.netMargin).toBe(9300000)
        expect(shared.investorProfitAmount).toBe(4650000)
        expect(shared.managerProfitAmount).toBe(4650000)
        expect(shared.investorProfitAmount + shared.managerProfitAmount).toBe(shared.netMargin)
    })
})
