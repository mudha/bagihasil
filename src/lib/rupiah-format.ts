/**
 * Format a non-negative or negative integer rupiah string to Indonesian currency.
 * Uses BigInt-safe string parsing — never converts through JavaScript Number.
 */
export function formatRupiah(value: string): string {
    const isNegative = value.startsWith("-")
    const digits = isNegative ? value.slice(1) : value
    if (!/^\d+$/.test(digits)) return `Rp${value}`

    // Reverse, group by 3, join with dots, reverse back
    const reversed = digits.split("").reverse()
    const groups: string[] = []
    for (let i = 0; i < reversed.length; i++) {
        if (i > 0 && i % 3 === 0) groups.push(".")
        groups.push(reversed[i])
    }
    const formatted = groups.reverse().join("")

    return isNegative ? `-Rp${formatted}` : `Rp${formatted}`
}

export function formatRupiahOrNull(value: string | null): string {
    return value === null ? "Belum diatur" : formatRupiah(value)
}
