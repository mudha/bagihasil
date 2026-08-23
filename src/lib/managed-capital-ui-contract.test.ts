import { describe, expect, it } from "vitest"
import {
    buildManagedCapitalSetRequest,
    getManagedCapitalInputError,
    isValidManagedCapitalInput,
    type ManagedCapitalViewState,
} from "./managed-capital-ui-contract"

describe("managed capital input contract", () => {
    it.each(["0", "5000000", "999999999999999999"])("accepts canonical value %s", (value) => {
        expect(isValidManagedCapitalInput(value)).toBe(true)
        expect(getManagedCapitalInputError(value)).toBeNull()
        expect(buildManagedCapitalSetRequest(value)).toEqual({
            action: "set",
            managedCapitalBalance: value,
        })
    })

    it.each(["", " ", "-500", "+500", "1.5", "1e3", "5 000", "abc", "50x", "0001", "1000000000000000000"])(
        "rejects and preserves invalid raw value %j",
        (value) => {
            expect(isValidManagedCapitalInput(value)).toBe(false)
            expect(getManagedCapitalInputError(value)).toBeTruthy()
            expect(buildManagedCapitalSetRequest(value)).toBeNull()
        },
    )
})

describe("managed capital view state", () => {
    it("keeps loading, error, loaded, and unavailable distinct", () => {
        const states: ManagedCapitalViewState[] = [
            { kind: "loading" },
            { kind: "error", message: "Gagal memuat ringkasan modal" },
            { kind: "loaded", summaries: new Map() },
            { kind: "unavailable", investorId: "inv-1" },
        ]

        expect(states.map((state) => state.kind)).toEqual(["loading", "error", "loaded", "unavailable"])
    })
})

it("keeps successful zero as loaded data rather than unset state", () => {
    const state: ManagedCapitalViewState = {
        kind: "loaded",
        summaries: new Map([[
            "inv-1",
            {
                investorId: "inv-1",
                managedCapitalBalance: "0",
                managedCapitalBalanceUpdatedAt: null,
                activeAllocatedInvestorCapital: "0",
                availableManagedCapital: "0",
                managedCapitalStatus: "SET",
                warnings: [],
            },
        ]]),
    }

    expect(state.kind).toBe("loaded")
    if (state.kind === "loaded") expect(state.summaries.get("inv-1")?.managedCapitalBalance).toBe("0")
})

it("preserves negative and anomaly warnings in loaded data", () => {
    const state: ManagedCapitalViewState = {
        kind: "loaded",
        summaries: new Map([[
            "inv-1",
            {
                investorId: "inv-1",
                managedCapitalBalance: "100",
                managedCapitalBalanceUpdatedAt: null,
                activeAllocatedInvestorCapital: "200",
                availableManagedCapital: "-100",
                managedCapitalStatus: "SET",
                warnings: [
                    { code: "ALLOCATION_EXCEEDS_MANAGED_BALANCE", message: "allocation warning" },
                    { code: "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT", message: "anomaly warning" },
                ],
            },
        ]]),
    }

    if (state.kind === "loaded") {
        expect(state.summaries.get("inv-1")?.availableManagedCapital).toBe("-100")
        expect(state.summaries.get("inv-1")?.warnings).toHaveLength(2)
    }
})

it("represents a successful response missing an investor as unavailable", () => {
    const state: ManagedCapitalViewState = { kind: "unavailable", investorId: "inv-missing" }
    expect(state.kind).toBe("unavailable")
})
