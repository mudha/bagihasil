const JAKARTA_TIME_ZONE = "Asia/Jakarta"
const DEFAULT_MONTHS = 6
const ALLOWED_MONTHS = new Set([6, 12, 24])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type DashboardPeriod = {
    kind: "preset" | "all" | "custom"
    months: number | null
    startDate: Date | null
    endDate: Date | null
    granularity: "month" | "year"
}

export type DashboardPeriodParseResult =
    | { ok: true; period: DashboardPeriod }
    | { ok: false; error: string }

function jakartaDateStart(value: string): Date | null {
    if (!DATE_PATTERN.test(value)) return null
    const [year, month, day] = value.split("-").map(Number)
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null
    const parsed = new Date(`${value}T00:00:00+07:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function jakartaDateEndExclusive(value: string): Date | null {
    const start = jakartaDateStart(value)
    if (!start) return null
    start.setUTCDate(start.getUTCDate() + 1)
    return start
}

function monthDistance(start: Date, end: Date): number {
    const startParts = jakartaParts(start)
    const endParts = jakartaParts(end)
    return (endParts.year - startParts.year) * 12 + endParts.month - startParts.month + 1
}

export function parseDashboardPeriod(searchParams: URLSearchParams, now = new Date()): DashboardPeriodParseResult {
    const range = searchParams.get("range")

    if (range === "all") {
        return {
            ok: true,
            period: { kind: "all", months: null, startDate: null, endDate: null, granularity: "year" },
        }
    }

    if (range === "custom") {
        const from = searchParams.get("from") ?? ""
        const to = searchParams.get("to") ?? ""
        const startDate = jakartaDateStart(from)
        const endDate = jakartaDateEndExclusive(to)

        if (!startDate || !endDate) {
            return { ok: false, error: "Tanggal awal dan akhir wajib memakai format YYYY-MM-DD." }
        }
        if (startDate >= endDate) {
            return { ok: false, error: "Tanggal awal tidak boleh melewati tanggal akhir." }
        }

        return {
            ok: true,
            period: {
                kind: "custom",
                months: null,
                startDate,
                endDate,
                granularity: monthDistance(startDate, new Date(endDate.getTime() - 1)) > 24 ? "year" : "month",
            },
        }
    }

    const monthsParam = searchParams.get("months")
    const requestedMonths = monthsParam ? Number.parseInt(monthsParam, 10) : DEFAULT_MONTHS
    const months = ALLOWED_MONTHS.has(requestedMonths) && String(requestedMonths) === (monthsParam ?? String(DEFAULT_MONTHS))
        ? requestedMonths
        : DEFAULT_MONTHS

    return {
        ok: true,
        period: {
            kind: "preset",
            months,
            startDate: getJakartaPeriodStart(months, now),
            endDate: null,
            granularity: "month",
        },
    }
}

export function getJakartaPeriodStart(monthsRange: number, now = new Date()): Date {
    const { year, month } = jakartaParts(now)
    const monthIndex = month - 1
    return new Date(Date.UTC(year, monthIndex - (monthsRange - 1), 1, -7))
}

export function createPresetDashboardPeriod(months: number, now = new Date()): DashboardPeriod {
    return {
        kind: "preset",
        months,
        startDate: getJakartaPeriodStart(months, now),
        endDate: null,
        granularity: "month",
    }
}

export function periodDateFilter(period: DashboardPeriod): { gte?: Date; lt?: Date } | undefined {
    if (!period.startDate && !period.endDate) return undefined
    return {
        ...(period.startDate ? { gte: period.startDate } : {}),
        ...(period.endDate ? { lt: period.endDate } : {}),
    }
}

export function isDateWithinPeriod(date: Date, period: DashboardPeriod): boolean {
    if (period.startDate && date < period.startDate) return false
    if (period.endDate && date >= period.endDate) return false
    return true
}

function jakartaParts(date: Date): { year: number; month: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: JAKARTA_TIME_ZONE,
        year: "numeric",
        month: "numeric",
    }).formatToParts(date)
    return {
        year: Number(parts.find(part => part.type === "year")?.value),
        month: Number(parts.find(part => part.type === "month")?.value),
    }
}

export function periodBucketKey(date: Date, granularity: DashboardPeriod["granularity"]): string {
    const { year, month } = jakartaParts(date)
    return granularity === "year" ? String(year) : `${year}-${String(month).padStart(2, "0")}`
}

export function periodBucketLabel(
    key: string,
    granularity: DashboardPeriod["granularity"],
    locale = "en-US",
): string {
    if (granularity === "year") return key
    const [year, month] = key.split("-").map(Number)
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
        timeZone: "UTC",
        month: "short",
        year: "numeric",
    })
}

export function buildPeriodBucketKeys(period: DashboardPeriod, dates: Date[], now = new Date()): string[] {
    let start = period.startDate
    const end = period.endDate ? new Date(period.endDate.getTime() - 1) : now

    if (!start) {
        const validDates = dates.filter(date => !Number.isNaN(date.getTime()))
        start = validDates.length > 0
            ? new Date(Math.min(...validDates.map(date => date.getTime())))
            : now
    }

    const startParts = jakartaParts(start)
    const endParts = jakartaParts(end)
    const keys: string[] = []

    if (period.granularity === "year") {
        for (let year = startParts.year; year <= endParts.year; year++) keys.push(String(year))
        return keys
    }

    let year = startParts.year
    let month = startParts.month
    while (year < endParts.year || (year === endParts.year && month <= endParts.month)) {
        keys.push(`${year}-${String(month).padStart(2, "0")}`)
        month += 1
        if (month === 13) {
            month = 1
            year += 1
        }
    }
    return keys
}
