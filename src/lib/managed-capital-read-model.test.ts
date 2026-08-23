import { describe, expect, it } from "vitest"
import { buildManagedCapitalSummary } from "./managed-capital-read-model"

const tx = (status: string, buyPrice: string | number, initialInvestorCapital: string | null = null) => ({
    status,
    buyPrice,
    initialInvestorCapital,
})

const investor = (balance: string | null, units: Array<{ id: string; transactions: Array<ReturnType<typeof tx>> }>) => ({
    id: "inv-1",
    managedCapitalBalance: balance,
    managedCapitalBalanceUpdatedAt: new Date("2026-08-23T00:00:00.000Z"),
    units,
})

describe("buildManagedCapitalSummary", () => {
    it("computes available capital exactly from active allocations", () => {
        const result = buildManagedCapitalSummary(investor("5000000", [
            { id: "unit-1", transactions: [tx("ON_PROCESS", "3500000")] },
        ]))

        expect(result).toMatchObject({
            managedCapitalBalance: "5000000",
            activeAllocatedInvestorCapital: "3500000",
            availableManagedCapital: "1500000",
            managedCapitalStatus: "SET",
            warnings: [],
        })
    })

    it("keeps unset balance distinct from zero and preserves active allocation", () => {
        const unset = buildManagedCapitalSummary(investor(null, [
            { id: "unit-1", transactions: [tx("ON_PROCESS", "100")] },
        ]))
        const zero = buildManagedCapitalSummary(investor("0", [
            { id: "unit-1", transactions: [tx("ON_PROCESS", "100")] },
        ]))

        expect(unset).toMatchObject({ managedCapitalBalance: null, availableManagedCapital: null, managedCapitalStatus: "UNSET", activeAllocatedInvestorCapital: "100" })
        expect(zero).toMatchObject({ managedCapitalBalance: "0", availableManagedCapital: "-100", managedCapitalStatus: "SET" })
        expect(zero.warnings.map(w => w.code)).toContain("ALLOCATION_EXCEEDS_MANAGED_BALANCE")
    })

    it("uses nullish fallback, filters status, includes old active transactions, and detects duplicate active units", () => {
        const result = buildManagedCapitalSummary(investor("1000", [
            { id: "unit-1", transactions: [tx("ON_PROCESS", "999", "0"), tx("ON_PROCESS", "1", null), tx("COMPLETED", "500")] },
            { id: "unit-2", transactions: [tx("CANCELLED", "700")] },
        ]))

        expect(result.activeAllocatedInvestorCapital).toBe("1")
        expect(result.warnings.map(w => w.code)).toEqual(["MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT"])
    })

    it("preserves Decimal(18,0)-sized integer precision", () => {
        const result = buildManagedCapitalSummary(investor("999999999999999999", [
            { id: "unit-1", transactions: [tx("ON_PROCESS", "1", "999999999999999998")] },
        ]))

        expect(result.activeAllocatedInvestorCapital).toBe("999999999999999998")
        expect(result.availableManagedCapital).toBe("1")
    })

    it("fails closed for unsafe numeric inputs instead of losing precision", () => {
        expect(() => buildManagedCapitalSummary(investor("500000000000000000", [
            { id: "unit-1", transactions: [tx("ON_PROCESS", 9007199254740992 as unknown as string)] },
        ]))).toThrow(/safe integer/)
    })
})
