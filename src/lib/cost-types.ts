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

const COST_TYPE_LABELS: Record<string, string> = Object.fromEntries(
    COST_TYPE_OPTIONS.map(({ value, label }) => [value, label])
)

export function getCostTypeLabel(value: string): string {
    return COST_TYPE_LABELS[value] ?? value
}
