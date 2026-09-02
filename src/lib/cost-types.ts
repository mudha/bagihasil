export const COST_TYPE_VALUES = [
    "INSPECTION",
    "TRANSPORT",
    "MEAL",
    "TOLL",
    "ADS",
    "REPAIR",
    "GAS",
    "PARKING",
    "STAMP_DUTY",
    "BROKER",
    "SALES",
    "TAX",
    "OTHER",
] as const

export type CostType = typeof COST_TYPE_VALUES[number]

export const COST_TYPE_OPTIONS: ReadonlyArray<{ value: CostType; label: string }> = [
    { value: "INSPECTION", label: "Inspeksi" },
    { value: "TRANSPORT", label: "Transport" },
    { value: "MEAL", label: "Makan" },
    { value: "TOLL", label: "Tol" },
    { value: "ADS", label: "Iklan" },
    { value: "REPAIR", label: "Perbaikan (PR)" },
    { value: "GAS", label: "Bensin" },
    { value: "PARKING", label: "Parkir" },
    { value: "STAMP_DUTY", label: "Materai" },
    { value: "BROKER", label: "Makelar" },
    { value: "SALES", label: "Sales" },
    { value: "TAX", label: "Pajak" },
    { value: "OTHER", label: "Lainnya" },
]

// Preserve the pre-Pajak POST allowlist exactly; SALES remains an existing
// UI/legacy value and is intentionally not enabled by this category change.
export const CREATE_COST_TYPE_VALUES = [
    "INSPECTION",
    "TRANSPORT",
    "MEAL",
    "TOLL",
    "ADS",
    "REPAIR",
    "GAS",
    "PARKING",
    "STAMP_DUTY",
    "BROKER",
    "TAX",
    "OTHER",
] as const

export function getCostTypeLabel(value: string): string {
    return value === "TAX" ? "Pajak" : value
}
