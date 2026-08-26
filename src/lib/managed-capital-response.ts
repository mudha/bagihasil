import type { ManagedCapitalSummary, ManagedCapitalWarningCode } from "./managed-capital-ui-contract"

const warningCodes: ManagedCapitalWarningCode[] = [
    "ALLOCATION_EXCEEDS_MANAGED_BALANCE",
    "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT",
]

function isManagedCapitalSummary(value: unknown): value is ManagedCapitalSummary {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false

    const summary = value as Record<string, unknown>
    const warnings = summary.warnings

    return (
        typeof summary.investorId === "string" &&
        (typeof summary.managedCapitalBalance === "string" || summary.managedCapitalBalance === null) &&
        (typeof summary.managedCapitalBalanceUpdatedAt === "string" || summary.managedCapitalBalanceUpdatedAt === null) &&
        typeof summary.activeAllocatedInvestorCapital === "string" &&
        (typeof summary.availableManagedCapital === "string" || summary.availableManagedCapital === null) &&
        (summary.managedCapitalStatus === "SET" || summary.managedCapitalStatus === "UNSET") &&
        Array.isArray(warnings) &&
        warnings.every((warning) => {
            if (typeof warning !== "object" || warning === null || Array.isArray(warning)) return false
            const item = warning as Record<string, unknown>
            return (
                typeof item.message === "string" &&
                typeof item.code === "string" &&
                warningCodes.includes(item.code as ManagedCapitalWarningCode)
            )
        })
    )
}

export function parseManagedCapitalSummaryPayload(payload: unknown): ManagedCapitalSummary[] {
    if (
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload) ||
        !Array.isArray((payload as Record<string, unknown>).investors) ||
        !(payload as { investors: unknown[] }).investors.every(isManagedCapitalSummary)
    ) {
        throw new Error("Invalid managed capital summary response")
    }

    return (payload as { investors: ManagedCapitalSummary[] }).investors
}
