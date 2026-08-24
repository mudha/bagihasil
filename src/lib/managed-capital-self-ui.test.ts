import { describe, expect, it } from "vitest"
import { formatManagedCapitalTimestamp, isManagedCapitalSummary, type ManagedCapitalSummaryResponse } from "./managed-capital-self-ui"

const validSummary = {
    investorId: "investor-1",
    managedCapitalBalance: "5000000",
    managedCapitalBalanceUpdatedAt: "2026-08-23T00:00:00.000Z",
    activeAllocatedInvestorCapital: "3500000",
    availableManagedCapital: "1500000",
    managedCapitalStatus: "SET" as const,
    warnings: [],
}
const valid: ManagedCapitalSummaryResponse = { investor: validSummary }

describe("managed capital self-view contract", () => {
    it("accepts the exact endpoint envelope", () => expect(isManagedCapitalSummary(valid)).toBe(true))
    it("accepts UNSET and zero without coercing values", () => {
        expect(isManagedCapitalSummary({ investor: { ...validSummary, managedCapitalBalance: null, availableManagedCapital: null, managedCapitalStatus: "UNSET" } })).toBe(true)
        expect(isManagedCapitalSummary({ investor: { ...validSummary, managedCapitalBalance: "0", availableManagedCapital: "0" } })).toBe(true)
    })
    it("preserves negative available value and both warnings", () => expect(isManagedCapitalSummary({ investor: { ...validSummary, availableManagedCapital: "-500000", warnings: [{ code: "ALLOCATION_EXCEEDS_MANAGED_BALANCE", message: "allocation warning" }, { code: "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT", message: "anomaly warning" }] } })).toBe(true))
    it("accepts exact large integer strings", () => expect(isManagedCapitalSummary({ investor: { ...validSummary, managedCapitalBalance: "9007199254740993", availableManagedCapital: "9007199254740993" } })).toBe(true))
    it("formats valid and invalid timestamps without throwing", () => {
        expect(formatManagedCapitalTimestamp("2026-08-23T00:00:00.000Z")).toContain("2026")
        expect(formatManagedCapitalTimestamp("not-a-date")).toBe("Waktu pembaruan tidak valid")
    })
    it.each([null, {}, validSummary, { investor: { ...validSummary, investorId: 1 } }, { investor: { ...validSummary, managedCapitalBalance: "-1" } }, { investor: { ...validSummary, activeAllocatedInvestorCapital: "-1" } }, { investor: { ...validSummary, managedCapitalStatus: "UNSET", managedCapitalBalance: "1" } }, { investor: { ...validSummary, managedCapitalStatus: "SET", managedCapitalBalance: null } }, { investor: { ...validSummary, managedCapitalBalanceUpdatedAt: "not-a-date" } }, { investor: { ...validSummary, warnings: [{ code: "UNKNOWN", message: "bad" }] } }])("rejects malformed or contradictory response %j", (value) => expect(isManagedCapitalSummary(value)).toBe(false))
})
