export function formatOdometer(value: unknown): string {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        return "—"
    }

    return `${value.toLocaleString("id-ID")} km`
}

export type OdometerSortOrder = "asc" | "desc"

export function compareOdometer(a: unknown, b: unknown, order: OdometerSortOrder): number {
    const aValid = typeof a === "number" && Number.isSafeInteger(a) && a >= 0
    const bValid = typeof b === "number" && Number.isSafeInteger(b) && b >= 0

    if (!aValid && !bValid) return 0
    if (!aValid) return 1
    if (!bValid) return -1

    const comparison = (a as number) - (b as number)
    return order === "asc" ? comparison : -comparison
}
