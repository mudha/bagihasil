import type { ManagedCapitalSummary, ManagedCapitalWarningCode } from "./managed-capital-ui-contract"

export type ManagedCapitalSummaryResponse = { investor: ManagedCapitalSummary }

const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/
const SIGNED_INTEGER_PATTERN = /^-?\d+$/
const WARNING_CODES: readonly ManagedCapitalWarningCode[] = [
    "ALLOCATION_EXCEEDS_MANAGED_BALANCE",
    "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT",
]

function isNonNegativeIntegerString(value: unknown): value is string {
    return typeof value === "string" && NON_NEGATIVE_INTEGER_PATTERN.test(value)
}

function isNullableSignedIntegerString(value: unknown): value is string | null {
    return value === null || (typeof value === "string" && SIGNED_INTEGER_PATTERN.test(value))
}

function isSummary(value: unknown): value is ManagedCapitalSummary {
    if (!value || typeof value !== "object") return false
    const summary = value as Record<string, unknown>
    if (typeof summary.investorId !== "string" || summary.investorId.length === 0) return false
    if (summary.managedCapitalBalance !== null && !isNonNegativeIntegerString(summary.managedCapitalBalance)) return false
    if (summary.managedCapitalBalanceUpdatedAt !== null && (typeof summary.managedCapitalBalanceUpdatedAt !== "string" || Number.isNaN(Date.parse(summary.managedCapitalBalanceUpdatedAt)))) return false
    if (!isNonNegativeIntegerString(summary.activeAllocatedInvestorCapital)) return false
    if (!isNullableSignedIntegerString(summary.availableManagedCapital)) return false
    if (summary.managedCapitalStatus !== "UNSET" && summary.managedCapitalStatus !== "SET") return false
    if (summary.managedCapitalStatus === "UNSET" && (summary.managedCapitalBalance !== null || summary.availableManagedCapital !== null)) return false
    if (summary.managedCapitalStatus === "SET" && summary.managedCapitalBalance === null) return false
    if (!Array.isArray(summary.warnings)) return false
    return summary.warnings.every((warning) => {
        if (!warning || typeof warning !== "object") return false
        const item = warning as Record<string, unknown>
        return WARNING_CODES.includes(item.code as ManagedCapitalWarningCode) && typeof item.message === "string" && item.message.length > 0
    })
}

export function isManagedCapitalSummary(value: unknown): value is ManagedCapitalSummaryResponse {
    if (!value || typeof value !== "object") return false
    return isSummary((value as Record<string, unknown>).investor)
}

export function getManagedCapitalSummaryFromResponse(value: unknown): ManagedCapitalSummary | null {
    return isManagedCapitalSummary(value) ? value.investor : null
}

export function getSelfManagedCapitalUnavailableLabel(kind: "error" | "missing"): string {
    return kind === "error" ? "Ringkasan modal kelolaan tidak dapat dimuat." : "Ringkasan modal kelolaan belum tersedia."
}

export function formatManagedCapitalTimestamp(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Waktu pembaruan tidak valid"
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone: "Asia/Jakarta",
    }).format(date)
}
