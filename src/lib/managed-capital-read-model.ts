export type ManagedCapitalWarningCode =
    | "ALLOCATION_EXCEEDS_MANAGED_BALANCE"
    | "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT"

export type ManagedCapitalWarning = {
    code: ManagedCapitalWarningCode
    message: string
}

export type ManagedCapitalSummary = {
    investorId: string
    managedCapitalBalance: string | null
    managedCapitalBalanceUpdatedAt: string | null
    activeAllocatedInvestorCapital: string
    availableManagedCapital: string | null
    managedCapitalStatus: "UNSET" | "SET"
    warnings: ManagedCapitalWarning[]
}

type DecimalLike = { toString(): string } | string | number

type SummaryInvestor = {
    id: string
    managedCapitalBalance: DecimalLike | null
    managedCapitalBalanceUpdatedAt: Date | null
    units: Array<{
        id: string
        transactions: Array<{
            status: string
            buyPrice: DecimalLike
            initialInvestorCapital: DecimalLike | null
        }>
    }>
}

const ACTIVE_STATUS = "ON_PROCESS"
const ALLOCATION_WARNING_MESSAGE = "Modal aktif melebihi saldo modal kelolaan yang tercatat."
const DUPLICATE_WARNING_MESSAGE = "Unit memiliki lebih dari satu transaksi ON_PROCESS."

function integerString(value: DecimalLike): string {
    if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
        throw new Error("Managed capital number is not a safe integer rupiah")
    }
    const text = typeof value === "number" ? String(value) : value.toString()
    if (!/^\d+$/.test(text)) throw new Error("Managed capital values must be non-negative integer rupiah")
    return text
}

export function buildManagedCapitalSummary(investor: SummaryInvestor): ManagedCapitalSummary {
    let activeAllocatedInvestorCapital = BigInt(0)
    const warnings: ManagedCapitalWarning[] = []

    for (const unit of investor.units) {
        const activeTransactions = unit.transactions.filter(transaction => transaction.status === ACTIVE_STATUS)
        if (activeTransactions.length > 1) {
            warnings.push({ code: "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT", message: DUPLICATE_WARNING_MESSAGE })
        }
        for (const transaction of activeTransactions) {
            activeAllocatedInvestorCapital += BigInt(integerString(transaction.initialInvestorCapital ?? transaction.buyPrice))
        }
    }

    const managedCapitalBalance = investor.managedCapitalBalance === null
        ? null
        : integerString(investor.managedCapitalBalance)
    const activeAllocated = activeAllocatedInvestorCapital.toString()
    const availableManagedCapital = managedCapitalBalance === null
        ? null
        : (BigInt(managedCapitalBalance) - activeAllocatedInvestorCapital).toString()

    if (availableManagedCapital !== null && BigInt(availableManagedCapital) < BigInt(0)) {
        warnings.push({ code: "ALLOCATION_EXCEEDS_MANAGED_BALANCE", message: ALLOCATION_WARNING_MESSAGE })
    }

    return {
        investorId: investor.id,
        managedCapitalBalance,
        managedCapitalBalanceUpdatedAt: investor.managedCapitalBalanceUpdatedAt?.toISOString() ?? null,
        activeAllocatedInvestorCapital: activeAllocated,
        availableManagedCapital,
        managedCapitalStatus: managedCapitalBalance === null ? "UNSET" : "SET",
        warnings,
    }
}
