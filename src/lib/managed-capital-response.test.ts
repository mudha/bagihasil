import { describe, expect, it } from "vitest"
import type { ManagedCapitalSummary } from "./managed-capital-ui-contract"
import { parseManagedCapitalSummaryPayload } from "./managed-capital-response"

const summary: ManagedCapitalSummary = {
    investorId: "investor-1",
    managedCapitalBalance: "0",
    managedCapitalBalanceUpdatedAt: null,
    activeAllocatedInvestorCapital: "1250000",
    availableManagedCapital: "-1250000",
    managedCapitalStatus: "SET",
    warnings: [{ code: "ALLOCATION_EXCEEDS_MANAGED_BALANCE", message: "warning" }],
}

describe("parseManagedCapitalSummaryPayload", () => {
    it("unwraps the authoritative investors envelope", () => {
        expect(parseManagedCapitalSummaryPayload({ investors: [summary] })).toEqual([summary])
    })

    it("accepts an empty investors array", () => {
        expect(parseManagedCapitalSummaryPayload({ investors: [] })).toEqual([])
    })

    it.each([
        ["missing envelope", {}],
        ["null investors", { investors: null }],
        ["object investors", { investors: {} }],
        ["legacy bare array", [summary]],
        ["null payload", null],
    ])("rejects %s", (_label, payload) => {
        expect(() => parseManagedCapitalSummaryPayload(payload)).toThrow("Invalid managed capital summary response")
    })

    it("preserves summary values including zero, null, and warnings", () => {
        const parsed = parseManagedCapitalSummaryPayload({ investors: [summary] })

        expect(parsed[0]).toBe(summary)
        expect(parsed[0].managedCapitalBalance).toBe("0")
        expect(parsed[0].managedCapitalBalanceUpdatedAt).toBeNull()
        expect(parsed[0].warnings).toEqual(summary.warnings)
    })
})
