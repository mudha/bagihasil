export function formatOdometer(value: unknown): string {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        return "—"
    }

    return `${value.toLocaleString("id-ID")} km`
}
