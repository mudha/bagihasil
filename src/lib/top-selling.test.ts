/**
 * Focused tests for Top 5 Unit Terlaris aggregation and UI contract.
 *
 * All tests use mocks — no Production access.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock setup ───────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
    prisma: {
        transaction: {
            findMany: mocks.findMany,
        },
    },
}))

// Import AFTER mock setup (same pattern as managed-capital-read-query.test.ts)
import { aggregateTopSellingUnits, canonicalUnitName, getJakartaPeriodStart, getTopSellingUnits } from "./top-selling"

// ─── Test canonicalUnitName (pure function, no mock needed) ───
describe("canonicalUnitName", () => {
    it("joins brand + model", () => {
        expect(canonicalUnitName("Yamaha", "XMAX", "Any")).toBe("Yamaha XMAX")
    })

    it("title-cases brand", () => {
        expect(canonicalUnitName("honda", "PCX", "Any")).toBe("Honda PCX")
    })

    it("falls back to raw name when both null", () => {
        expect(canonicalUnitName(null, null, "Yamaha XMAX 256")).toBe("Yamaha XMAX 256")
    })

    it("uses brand only when model is null", () => {
        expect(canonicalUnitName("Kawasaki", null, "Any")).toBe("Kawasaki")
    })

    it("trims and normalizes whitespace", () => {
        expect(canonicalUnitName("  yamaha  ", "  xmax  ", "Any")).toBe("Yamaha xmax")
    })
})

// ─── Test getTopSellingUnits ──────────────────────────────────
function makeTx(brand: string | null, model: string | null, name: string) {
    return { unit: { brand, model, name } }
}

describe("getTopSellingUnits", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("groups by canonical name, sorts by count desc then name asc", async () => {
        mocks.findMany.mockResolvedValue([
            makeTx("Yamaha", "XMAX", "XMAX 256"),
            makeTx("Yamaha", "XMAX", "XMAX Tech Max"),
            makeTx("Honda", "PCX", "PCX 160"),
            makeTx("Yamaha", "XMAX", "XMAX Old"),
            makeTx("Honda", "PCX", "PCX Connected"),
        ])

        const result = await getTopSellingUnits(6, null)

        expect(result).toEqual([
            { name: "Yamaha XMAX", count: 3, percentage: 100 },
            { name: "Honda PCX", count: 2, percentage: 67 },
        ])
    })

    it("limits to topN items", async () => {
        mocks.findMany.mockResolvedValue([
            makeTx("Yamaha", "XMAX", "XMAX 1"),
            makeTx("Honda", "PCX", "PCX 1"),
            makeTx("Kawasaki", "Ninja", "Ninja 1"),
            makeTx("Suzuki", "GSX", "GSX 1"),
            makeTx("Kawasaki", "W175", "W175"),
            makeTx("Honda", "Beat", "Beat 1"),
        ])

        const result = await getTopSellingUnits(6, null, 5)

        expect(result).toHaveLength(5)
    })

    it("returns empty array when no COMPLETED transactions", async () => {
        mocks.findMany.mockResolvedValue([])

        const result = await getTopSellingUnits(6, null)

        expect(result).toEqual([])
    })

    it("passes investorId filter to prisma", async () => {
        mocks.findMany.mockResolvedValue([])

        await getTopSellingUnits(6, "investor-123")

        expect(mocks.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    unit: { investorId: "investor-123" },
                }),
            })
        )
    })

    it("passes startDate based on monthsRange", async () => {
        mocks.findMany.mockResolvedValue([])

        await getTopSellingUnits(12, null)

        const call = mocks.findMany.mock.calls[0][0]
        const gte = call.where.sellDate.gte
        // Should be ~12 months ago
        const now = new Date()
        const diffMonths = (now.getFullYear() - gte.getFullYear()) * 12 + (now.getMonth() - gte.getMonth())
        expect(diffMonths).toBeGreaterThanOrEqual(11)
        expect(diffMonths).toBeLessThanOrEqual(12)
    })

    it("only queries COMPLETED transactions", async () => {
        mocks.findMany.mockResolvedValue([])

        await getTopSellingUnits(6, null)

        const call = mocks.findMany.mock.calls[0][0]
        expect(call.where.status).toBe("COMPLETED")
    })

    it("calculates percentage relative to rank 1", async () => {
        mocks.findMany.mockResolvedValue([
            makeTx("Yamaha", "XMAX", "XMAX 1"),
            makeTx("Yamaha", "XMAX", "XMAX 2"),
            makeTx("Honda", "PCX", "PCX 1"),
            makeTx("Honda", "PCX", "PCX 2"),
            makeTx("Honda", "PCX", "PCX 3"),
        ])

        const result = await getTopSellingUnits(6, null)

        // Honda PCX = 3 (rank 1, 100%), Yamaha XMAX = 2 (rank 2, 67%)
        expect(result[0]).toEqual({ name: "Honda PCX", count: 3, percentage: 100 })
        expect(result[1]).toEqual({ name: "Yamaha XMAX", count: 2, percentage: 67 })
    })

    it("handles tie-breaking by canonical name ascending", async () => {
        mocks.findMany.mockResolvedValue([
            makeTx("Honda", "PCX", "PCX 1"),
            makeTx("Honda", "PCX", "PCX 2"),
            makeTx("Yamaha", "XMAX", "XMAX 1"),
            makeTx("Yamaha", "XMAX", "XMAX 2"),
        ])

        const result = await getTopSellingUnits(6, null)

        // Honda PCX < Yamaha XMAX alphabetically
        expect(result[0].name).toBe("Honda PCX")
        expect(result[1].name).toBe("Yamaha XMAX")
    })

    it("merges structured model variants but keeps different models separate", () => {
        const result = aggregateTopSellingUnits([
            makeTx("Yamaha", "XMAX", "ignored"),
            makeTx("Yamaha", "XMAX Old", "ignored"),
            makeTx("Yamaha", "XMAX Connected", "ignored"),
            makeTx("Yamaha", "XMAX Tech Max", "ignored"),
            makeTx("Yamaha", "XMAX 2024 Matte Black", "ignored"),
            makeTx("Yamaha", "NMAX", "ignored"),
        ])

        expect(result).toEqual([
            { name: "Yamaha XMAX", count: 5, percentage: 100 },
            { name: "Yamaha NMAX", count: 1, percentage: 20 },
        ])
    })

    it("uses the same inclusive Jakarta month boundary as the dashboard", () => {
        expect(getJakartaPeriodStart(6, new Date("2026-09-30T18:00:00.000Z"))).toEqual(
            new Date("2026-04-30T17:00:00.000Z"),
        )
    })

    it("uses one minimal query with exact filter and selection", async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"))
        mocks.findMany.mockResolvedValue([])
        await getTopSellingUnits(6, "investor-auth")
        expect(mocks.findMany).toHaveBeenCalledTimes(1)
        expect(mocks.findMany.mock.calls[0][0]).toEqual({
            where: {
                status: "COMPLETED",
                sellDate: { gte: new Date("2026-03-31T17:00:00.000Z") },
                unit: { investorId: "investor-auth" },
            },
            select: { unit: { select: { brand: true, model: true, name: true } } },
        })
        vi.useRealTimers()
    })
})

// ─── Response contract test ───────────────────────────────────
describe("topSellingUnits response contract", () => {
    it("admin API returns topSellingUnits as additive field", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/app/api/dashboard/route.ts", "utf8")
        expect(src).toContain("topSellingUnits")
        expect(src).toContain('getTopSellingUnits(monthsRange, investorId)')
    })

    it("investor API returns topSellingUnits as additive field", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/app/api/investor/dashboard/route.ts", "utf8")
        expect(src).toContain("topSellingUnits")
        expect(src).toContain('getTopSellingUnits(months, investor.id)')
    })

    it("admin dashboard page uses TopSellingUnits component", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/app/dashboard/page.tsx", "utf8")
        expect(src).toContain('import { TopSellingUnits }')
        expect(src).toContain('<TopSellingUnits')
        expect(src).toContain('stats.topSellingUnits')
    })

    it("investor page refetches and passes fresh topSellingUnits whenever period changes", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/app/dashboard/investor/page.tsx", "utf8")
        expect(src).toContain('fetch(`/api/investor/dashboard?months=${monthsRange}`)')
        expect(src).toContain('[monthsRange, router]')
        expect(src).toContain('topSellingUnits={data.topSellingUnits || []}')
    })

    it("admin page refetches on both active filters", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/app/dashboard/page.tsx", "utf8")
        expect(src).toContain('`/api/dashboard?months=${monthsRange}`')
        expect(src).toContain('`&investorId=${selectedInvestorId}`')
        expect(src).toContain('[selectedInvestorId, monthsRange, retryNonce]')
    })

    it("preserves every legacy response key and adds only topSellingUnits", async () => {
        const { readFileSync } = await import("node:fs")
        const admin = readFileSync("src/app/api/dashboard/route.ts", "utf8")
        const investor = readFileSync("src/app/api/investor/dashboard/route.ts", "utf8")
        for (const key of ["activeUnits", "completedTransactions", "totalMargin", "totalInvestorProfit", "totalManagerProfit", "totalCapitalDeployed", "investorStats", "monthlyStats", "monthlyStatsHijri", "unitStatusDistribution", "recentTransactions", "taxReminders", "topSellingUnits"]) {
            expect(admin).toMatch(new RegExp(`\\b${key}\\b`))
        }
        for (const key of ["investor", "stats", "monthlyChartData", "monthlySalesTrend", "monthlyRevenueData", "monthlyChartDataHijri", "monthlySalesTrendHijri", "monthlyRevenueDataHijri", "investmentsData", "paymentsData", "topSellingUnits"]) {
            expect(investor).toMatch(new RegExp(`\\b${key}\\b`))
        }
    })

    it("keeps investor identity server-authoritative and query-client immutable", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/app/api/investor/dashboard/route.ts", "utf8")
        expect(src).toContain("getInvestorDashboardData(session.user.id!, months)")
        expect(src).toContain("getTopSellingUnits(months, investor.id)")
        expect(src).not.toMatch(/searchParams\.get\(["']investorId["']\)/)
    })

    it("renders accessible relative bars and a clear empty state", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/components/dashboard/TopSellingUnits.tsx", "utf8")
        expect(src).toContain('role="progressbar"')
        expect(src).toContain("aria-valuenow={item.percentage}")
        expect(src).toContain('style={{ width: `${item.percentage}%` }}')
        expect(src).toContain("Belum ada penjualan pada periode ini.")
        expect(src).toContain("dark:")
    })
})
