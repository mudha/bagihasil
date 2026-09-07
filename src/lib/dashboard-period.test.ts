import { describe, expect, it } from "vitest"

import {
    buildPeriodBucketKeys,
    isDateWithinPeriod,
    parseDashboardPeriod,
    periodBucketKey,
    periodDateFilter,
} from "./dashboard-period"

const NOW = new Date("2026-09-07T05:00:00.000Z")

describe("dashboard period parsing", () => {
    it("keeps the legacy six-month default", () => {
        const result = parseDashboardPeriod(new URLSearchParams(), NOW)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.period.kind).toBe("preset")
        expect(result.period.months).toBe(6)
        expect(result.period.startDate?.toISOString()).toBe("2026-03-31T17:00:00.000Z")
    })

    it.each([6, 12, 24])("accepts the %i-month preset", months => {
        const result = parseDashboardPeriod(new URLSearchParams(`months=${months}`), NOW)
        expect(result.ok && result.period.months).toBe(months)
    })

    it("falls back safely for unsupported month values", () => {
        const result = parseDashboardPeriod(new URLSearchParams("months=36"), NOW)
        expect(result.ok && result.period.months).toBe(6)
    })

    it("supports all-time without a date constraint and groups by year", () => {
        const result = parseDashboardPeriod(new URLSearchParams("range=all"), NOW)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(periodDateFilter(result.period)).toBeUndefined()
        expect(result.period.granularity).toBe("year")
    })

    it("parses a Jakarta custom range with an exclusive end date", () => {
        const result = parseDashboardPeriod(new URLSearchParams("range=custom&from=2024-01-01&to=2024-03-31"), NOW)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.period.startDate?.toISOString()).toBe("2023-12-31T17:00:00.000Z")
        expect(result.period.endDate?.toISOString()).toBe("2024-03-31T17:00:00.000Z")
        expect(result.period.granularity).toBe("month")
    })

    it("uses yearly buckets for custom ranges longer than two years", () => {
        const result = parseDashboardPeriod(new URLSearchParams("range=custom&from=2022-01-01&to=2026-09-07"), NOW)
        expect(result.ok && result.period.granularity).toBe("year")
    })

    it.each([
        "range=custom",
        "range=custom&from=bad&to=2026-01-01",
        "range=custom&from=2026-02-01&to=2026-01-01",
    ])("rejects invalid custom input: %s", query => {
        expect(parseDashboardPeriod(new URLSearchParams(query), NOW).ok).toBe(false)
    })
})

describe("dashboard period buckets", () => {
    it("builds continuous monthly buckets", () => {
        const parsed = parseDashboardPeriod(new URLSearchParams("range=custom&from=2026-01-15&to=2026-03-02"), NOW)
        if (!parsed.ok) throw new Error(parsed.error)
        expect(buildPeriodBucketKeys(parsed.period, [], NOW)).toEqual(["2026-01", "2026-02", "2026-03"])
    })

    it("builds all-time yearly buckets from the earliest record", () => {
        const parsed = parseDashboardPeriod(new URLSearchParams("range=all"), NOW)
        if (!parsed.ok) throw new Error(parsed.error)
        expect(buildPeriodBucketKeys(parsed.period, [new Date("2023-05-01T00:00:00Z")], NOW)).toEqual([
            "2023",
            "2024",
            "2025",
            "2026",
        ])
    })

    it("uses Jakarta calendar boundaries for inclusion and keys", () => {
        const parsed = parseDashboardPeriod(new URLSearchParams("range=custom&from=2026-09-01&to=2026-09-01"), NOW)
        if (!parsed.ok) throw new Error(parsed.error)
        expect(isDateWithinPeriod(new Date("2026-08-31T17:00:00Z"), parsed.period)).toBe(true)
        expect(isDateWithinPeriod(new Date("2026-09-01T17:00:00Z"), parsed.period)).toBe(false)
        expect(periodBucketKey(new Date("2026-08-31T17:00:00Z"), "month")).toBe("2026-09")
    })
})
