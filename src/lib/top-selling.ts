import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export interface TopSellingUnit {
    name: string
    count: number
    percentage: number
}

type SoldUnitRow = {
    unit: {
        brand: string | null
        model: string | null
        name: string
    }
}

/** Strip a brand prefix (case-insensitive) from a raw name. */
function stripBrandPrefix(raw: string, brand: string): string {
    const regex = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i")
    return raw.replace(regex, "").trim()
}

/** Remove year, color, variant suffixes from a name to get the core model. */
function stripVariants(raw: string): string {
    const padded = ` ${raw}`
    return padded
        // Remove Indonesian color phrases: "warna hijau", "warna merah", etc.
        .replace(/\s+warna\s+\S+/gi, "")
        // Remove variant suffixes: Old, Connected, Tech Max
        .replace(/\s+(?:old|connected|tech\s*max)\b/gi, "")
        // Remove trailing year and everything after: "2024", "2023 warna hijau", "2024 Matte Black"
        .replace(/\s+(?:19|20)\d{2}\b.*$/u, "")
        .trim()
}

function cleanPart(value: string | null): string | null {
    const cleaned = value?.trim().replace(/\s+/g, " ")
    return cleaned || null
}

function canonicalModel(value: string | null): string | null {
    const model = cleanPart(value)
    if (!model) return null
    return stripVariants(model)
}

/** Normalize a raw name to its canonical form (brand + core model). */
function normalizeRawName(raw: string): string {
    const cleaned = raw.trim().replace(/\s+/g, " ")
    return stripVariants(cleaned)
}

/**
 * Canonical unit name derived from structured brand + model fields.
 * Falls back to normalized raw name when structured fields are incomplete.
 */
export function canonicalUnitName(brand: string | null, model: string | null, fallbackName: string): string {
    const cleanBrand = cleanPart(brand)
    const cleanModel = canonicalModel(model)

    if (cleanBrand && cleanModel) {
        return [titleCase(cleanBrand), cleanModel].join(" ")
    }

    if (cleanBrand && !cleanModel) {
        // Brand is known but model is missing — extract model from raw name.
        const rawCore = stripBrandPrefix(fallbackName, cleanBrand)
        const extractedModel = stripVariants(rawCore)
        if (extractedModel) {
            return [titleCase(cleanBrand), extractedModel].join(" ")
        }
        // Only brand left after stripping.
        return titleCase(cleanBrand)
    }

    // No structured brand/model — normalize the raw name.
    return normalizeRawName(fallbackName)
}

function titleCase(s: string): string {
    return s.toLocaleLowerCase("id-ID").replace(/\b\p{L}/gu, c => c.toLocaleUpperCase("id-ID"))
}

/** Start of the earliest included calendar month in Jakarta, inclusive. */
export function getJakartaPeriodStart(monthsRange: number, now = new Date()): Date {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "numeric",
    }).formatToParts(now)
    const year = Number(parts.find(part => part.type === "year")?.value)
    const monthIndex = Number(parts.find(part => part.type === "month")?.value) - 1
    return new Date(Date.UTC(year, monthIndex - (monthsRange - 1), 1, -7))
}

export function aggregateTopSellingUnits(rows: SoldUnitRow[], topN = 5): TopSellingUnit[] {
    const groups = new Map<string, { name: string; count: number }>()
    for (const row of rows) {
        const name = canonicalUnitName(row.unit.brand, row.unit.model, row.unit.name)
        const key = name.toLocaleLowerCase("id-ID")
        const current = groups.get(key)
        if (current) current.count += 1
        else groups.set(key, { name, count: 1 })
    }

    const ranked = [...groups.values()]
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "id-ID"))
        .slice(0, topN)
    const leaderCount = ranked[0]?.count ?? 1

    return ranked.map(item => ({
        ...item,
        percentage: Math.round((item.count / leaderCount) * 100),
    }))
}

export async function getTopSellingUnits(
    monthsRange: number,
    investorId: string | null = null,
    topN = 5,
): Promise<TopSellingUnit[]> {
    const where: Prisma.TransactionWhereInput = {
        status: "COMPLETED",
        sellDate: { gte: getJakartaPeriodStart(monthsRange) },
        ...(investorId ? { unit: { investorId } } : {}),
    }

    const rows = await prisma.transaction.findMany({
        where,
        select: {
            unit: {
                select: { brand: true, model: true, name: true },
            },
        },
    })

    return aggregateTopSellingUnits(rows, topN)
}
