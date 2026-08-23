export type ManagedCapitalWarningCode =
    | "ALLOCATION_EXCEEDS_MANAGED_BALANCE"
    | "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT"

export type ManagedCapitalSummary = {
    investorId: string
    managedCapitalBalance: string | null
    managedCapitalBalanceUpdatedAt: string | null
    activeAllocatedInvestorCapital: string
    availableManagedCapital: string | null
    managedCapitalStatus: "UNSET" | "SET"
    warnings: Array<{ code: ManagedCapitalWarningCode; message: string }>
}

export type ManagedCapitalViewState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "loaded"; summaries: Map<string, ManagedCapitalSummary> }
    | { kind: "unavailable"; investorId: string }

const CANONICAL_RUPIAH_PATTERN = /^(0|[1-9]\d{0,17})$/

export function isValidManagedCapitalInput(raw: string): boolean {
    return CANONICAL_RUPIAH_PATTERN.test(raw)
}

export function getManagedCapitalInputError(raw: string): string | null {
    if (!raw) return "Saldo wajib diisi."
    if (!isValidManagedCapitalInput(raw)) {
        return "Masukkan 0 atau angka bulat 1–18 digit tanpa spasi, tanda, pecahan, atau pemisah."
    }
    return null
}

export function buildManagedCapitalSetRequest(raw: string): {
    action: "set"
    managedCapitalBalance: string
} | null {
    return isValidManagedCapitalInput(raw)
        ? { action: "set", managedCapitalBalance: raw }
        : null
}
