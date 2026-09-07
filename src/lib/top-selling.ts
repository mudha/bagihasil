import { prisma } from "@/lib/prisma"

/**
 * Canonical unit name derived from structured brand + model fields.
 * Falls back to the raw unit name if brand/model are missing.
 */
export function canonicalUnitName(brand: string | null, model: string | null, fallbackName: string): string {
    const parts: string[] = []
    if (brand) parts.push(brand.trim())
    if (model) parts.push(model.trim())
    if (parts.length === 0) return fallbackName
    // Title-case the brand, keep model as-is (already canonical in DB)
    parts[0] = parts[0].replace(/\b\w/g, (c) => c.toUpperCase())
    return parts.join(" ")
}

export interface TopSellingUnit {
    name: string
    count: number
    percentage: number // relative to rank 1 (0–100)
}

/**
 * Fetch the top N best-selling unit models within a date range.
 *
 * @param monthsRange  Number of months to look back (6, 12, or 24).
 * @param investorId   If provided, only count transactions for this investor.
 * @param topN         Maximum items to return (default 5).
 */
export async function getTopSellingUnits(
    monthsRange: number,
    investorId: string | null = null,
    topN: number = 5,
): Promise<TopSellingUnit[]> {
    // Compute Jakarta-aware period start (same logic as dashboard route).
    const now = new Date()
    const dateParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "numeric",
    }).formatToParts(now)
    const year = Number(dateParts.find((p) => p.type === "year")?.value)
    const monthIndex = Number(dateParts.find((p) => p.type === "month")?.value) - 1
    const startDate = new Date(Date.UTC(year, monthIndex - (monthsRange - 1), 1, -7))

    // Fetch COMPLETED transactions within period, joining unit for brand/model.
    const where: any = {
        status: "COMPLETED",
        sellDate: { gte: startDate },
    }
    if (investorId) {
        where.unit = { investorId }
    }

    const rows = await prisma.transaction.findMany({
        where,
        select: {
            unit: {
                select: {
                    brand: true,
                    model: true,
                    name: true,
                },
            },
        },
    })

    if (rows.length === 0) return []

    // Group by canonical name.
    const counts = new Map<string, number>()
    for (const row of rows) {
        const canonical = canonicalUnitName(row.unit.brand, row.unit.model, row.unit.name)
        counts.set(canonical, (counts.get(canonical) ?? 0) + 1)
    }

    // Sort: count desc, then name asc (tie-breaker).
    const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id-ID"))
        .slice(0, topN)

    const topCount = sorted[0]?.[1] ?? 1

    return sorted.map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / topCount) * 100),
    }))
}
