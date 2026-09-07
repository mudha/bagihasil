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

function cleanPart(value: string | null): string | null {
    const cleaned = value?.trim().replace(/\s+/g, " ")
    return cleaned || null
}

function canonicalModel(value: string | null): string | null {
    const model = cleanPart(value)
    if (!model) return null
    return model
        .replace(/\s+(?:tech\s*max|connected|old)\b.*$/iu, "")
        .replace(/\s+(?:19|20)\d{2}\b.*$/u, "")
        .trim()
}

/** Structured brand/model are authoritative. Raw name is fallback only. */
export function canonicalUnitName(brand: string | null, model: string | null, fallbackName: string): string {
    const cleanBrand = cleanPart(brand)
    const cleanModel = canonicalModel(model)
    if (!cleanBrand && !cleanModel) return fallbackName.trim().replace(/\s+/g, " ")
    const displayBrand = cleanBrand
        ? cleanBrand.toLocaleLowerCase("id-ID").replace(/\b\p{L}/gu, character => character.toLocaleUpperCase("id-ID"))
        : null
    return [displayBrand, cleanModel].filter(Boolean).join(" ")
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