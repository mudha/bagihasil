import { describe, expect, it } from "vitest"
import {
    formatManagedCapitalTimestamp,
    isManagedCapitalSummary,
    type ManagedCapitalSummaryResponse,
} from "./managed-capital-self-ui"

const valid: ManagedCapitalSummaryResponse = {
    investorId: "investor-1",
    managedCapitalBalance: "5000000",
    managedCapitalBalanceUpdatedAt: "2026-08-23T00:00:00.000Z",
    activeAllocatedInvestorCapital: "3500000",
    availableManagedCapital: "1500000",
    managedCapitalStatus: "SET",
    warnings: [],
}

describe("managed capital self-view contract", () => {
    it("accepts the exact self-summary response shape", () => {
        expect(isManagedCapitalSummary(valid)).toBe(true)
    })

    it("accepts UNSET and zero without coercing values", () => {
        expect(isManagedCapitalSummary({ ...valid, managedCapitalBalance: null, availableManagedCapital: null, managedCapitalStatus: "UNSET" })).toBe(true)
        expect(isManagedCapitalSummary({ ...valid, managedCapitalBalance: "0", availableManagedCapital: "0" })).toBe(true)
    })

    it("preserves negative and anomaly warnings", () => {
        expect(isManagedCapitalSummary({
            ...valid,
            availableManagedCapital: "-500000",
            warnings: [
                { code: "ALLOCATION_EXCEEDS_MANAGED_BALANCE", message: "allocation warning" },
                { code: "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT", message: "anomaly warning" },
            ],
        })).toBe(true)
    })

    it("formats a valid timestamp without throwing", () => {
        expect(formatManagedCapitalTimestamp("2026-08-23T00:00:00.000Z")).toContain("2026")
        expect(formatManagedCapitalTimestamp("not-a-date")).toBe("Waktu pembaruan tidak valid")
    })

    it.each([null, {}, { ...valid, investorId: 1 }, { ...valid, activeAllocatedInvestorCapital: 0 }, { ...valid, warnings: [{ code: "UNKNOWN", message: "bad" }] }])(
        "rejects malformed response %j as unavailable",
        (value) => expect(isManagedCapitalSummary(value)).toBe(false)
    )
})
