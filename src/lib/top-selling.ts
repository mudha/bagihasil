import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export interface TopSellingUnit {
    name: string
    count: number
    percentage: number
}

/**
 * Shape returned by Prisma after the select in getTopSellingUnits.
 * Matches: select { unit: { select: { brand, model, name } } }
 */
export type SoldUnitRow = {
    unit: {
        brand: string | null
        model: string | null
        name: string
    }
}

// ─── Strip helpers ─────────────────────────────────────────────

/** Known variant-only tokens that some old records have as their sole `model` value. */
const VARIANT_ONLY_TOKENS = /^(?:old|connected|tech\s*max)$/i

/** Remove a brand prefix (case-insensitive) from a raw name. */
function stripBrandPrefix(raw: string, brand: string): string {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return raw.replace(new RegExp(`^${escaped}\\s*`, "i"), "").trim()
}

/** Remove year, color phrases, and variant suffixes from a string. */
function stripVariants(raw: string): string {
    // Pad with leading space so regex \s+ anchors always match.
    const padded = ` ${raw}`
    return padded
        // Indonesian color phrases: "warna hijau", "warna merah", etc.
        .replace(/\s+warna\s+\S+/gi, "")
        // Variant suffixes: Old, Connected, Tech Max
        .replace(/\s+(?:old|connected|tech\s*max)\b/gi, "")
        // Trailing year and everything after it.
        .replace(/\s+(?:19|20)\d{2}\b.*$/u, "")
        .trim()
}

function cleanPart(value: string | null): string | null {
    const cleaned = value?.trim().replace(/\s+/g, " ")
    return cleaned || null
}

/**
 * Return true if the structured model is a variant-only token
 * (e.g. "Connected", "Old", "Tech Max") that doesn't represent
 * an actual model and should not be used as the canonical model.
 */
function isVariantOnly(model: string | null): boolean {
    return model !== null && VARIANT_ONLY_TOKENS.test(model.trim())
}

// ─── Core canonicalizer ────────────────────────────────────────

/**
 * Canonical unit name derived from structured brand + model fields.
 *
 * Priority:
 *   1. If structured brand + model are both real → use them.
 *   2. If structured model is variant-only → ignore it, extract from raw name.
 *   3. If structured brand exists but model is missing/null → extract from raw name.
 *   4. If nothing structured → normalize raw name.
 *
 * The raw unit name (`unit.name`) is the same field displayed in the
 * transaction list, so it is the authoritative fallback source.
 */
export function canonicalUnitName(brand: string | null, model: string | null, fallbackName: string): string {
    const cleanBrand = cleanPart(brand)
    const structuredModel = cleanPart(model)

    // Path 1: Both brand and a real model are present.
    if (cleanBrand && structuredModel && !isVariantOnly(model)) {
        return [titleCase(cleanBrand), stripVariants(structuredModel)].join(" ")
    }

    // Path 2 or 3: Brand is present, but model is missing or variant-only.
    // Extract model from the raw unit name (same field shown in the transaction list).
    if (cleanBrand) {
        const rawCore = stripBrandPrefix(fallbackName, cleanBrand)
        const extractedModel = stripVariants(rawCore)
        if (extractedModel) {
            return [titleCase(cleanBrand), extractedModel].join(" ")
        }
        return titleCase(cleanBrand)
    }

    // Path 4: No structured brand — normalize the raw name as-is.
    return stripVariants(fallbackName.trim().replace(/\s+/g, " "))
}

function titleCase(s: string): string {
    return s.toLocaleLowerCase("id-ID").replace(/\b\p{L}/gu, c => c.toLocaleUpperCase("id-ID"))
}

// ─── Period helper (shared with dashboard route) ───────────────

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

// ─── Aggregator ────────────────────────────────────────────────

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

// ─── Database query ────────────────────────────────────────────

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
                // Only three fields needed — same data shown in the transaction list.
                select: { brand: true, model: true, name: true },
            },
        },
    })

    return aggregateTopSellingUnits(rows, topN)
}
