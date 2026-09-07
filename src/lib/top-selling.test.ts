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
import { aggregateTopSellingUnits, canonicalUnitName, getJakartaPeriodStart, getTopSellingUnits, type SoldUnitRow } from "./top-selling"

// ─── Helper ────────────────────────────────────────────────────
function makeRow(brand: string | null, model: string | null, name: string): SoldUnitRow {
    return { unit: { brand, model, name } }
}

// ─── Test canonicalUnitName ────────────────────────────────────
describe("canonicalUnitName", () => {
    it("joins brand + model", () => {
        expect(canonicalUnitName("Yamaha", "XMAX", "Any")).toBe("Yamaha XMAX")
    })

    it("title-cases brand", () => {
        expect(canonicalUnitName("honda", "PCX", "Any")).toBe("Honda PCX")
    })

    it("falls back to normalized raw name when both structured fields are null", () => {
        expect(canonicalUnitName(null, null, "Yamaha XMAX 2023 warna hijau")).toBe("Yamaha XMAX")
    })

    it("extracts model from raw name when brand is present but model is null", () => {
        expect(canonicalUnitName("Yamaha", null, "Yamaha XMAX 2023 warna hijau")).toBe("Yamaha XMAX")
    })

    it("strips year from raw fallback", () => {
        expect(canonicalUnitName(null, null, "Honda PCX 2024")).toBe("Honda PCX")
    })

    it("strips color from raw fallback", () => {
        expect(canonicalUnitName(null, null, "Yamaha XMAX warna merah")).toBe("Yamaha XMAX")
    })

    it("strips variant from raw fallback", () => {
        expect(canonicalUnitName(null, null, "Yamaha XMAX Connected")).toBe("Yamaha XMAX")
    })

    it("returns brand-only when raw name has no model", () => {
        expect(canonicalUnitName("Kawasaki", null, "Kawasaki")).toBe("Kawasaki")
    })

    it("treats variant-only model 'Connected' as non-canonical, extracts XMAX from raw name", () => {
        expect(canonicalUnitName("Yamaha", "Connected", "Yamaha XMAX Connected 2023 warna Hitam")).toBe("Yamaha XMAX")
    })

    it("treats variant-only model 'Old' as non-canonical, extracts XMAX from raw name", () => {
        expect(canonicalUnitName("Yamaha", "Old", "Yamaha XMAX Old 2022")).toBe("Yamaha XMAX")
    })

    it("treats variant-only model 'Tech Max' as non-canonical, extracts XMAX from raw name", () => {
        expect(canonicalUnitName("Yamaha", "Tech Max", "Yamaha XMAX Tech Max 2024")).toBe("Yamaha XMAX")
    })

    it("preserves valid model NMAX even when brand is Yamaha", () => {
        expect(canonicalUnitName("Yamaha", "NMAX", "any")).toBe("Yamaha NMAX")
    })

    it("does not guess model when variant-only and raw name has no model", () => {
        expect(canonicalUnitName("Yamaha", "Connected", "Yamaha Connected")).toBe("Yamaha")
    })

    it("does not guess model when variant-only and raw name is just the brand", () => {
        expect(canonicalUnitName("Honda", "Old", "Honda")).toBe("Honda")
    })

    it("handles variant-only model with only brand prefix in raw name", () => {
        expect(canonicalUnitName("Yamaha", "Connected", "Yamaha Connected 2023")).toBe("Yamaha")
    })

    it("trims and normalizes whitespace", () => {
        expect(canonicalUnitName("  yamaha  ", "  xmax  ", "Any")).toBe("Yamaha xmax")
    })
})

// ─── Test getTopSellingUnits ──────────────────────────────────
describe("getTopSellingUnits", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("groups by canonical name, sorts by count desc then name asc", async () => {
        mocks.findMany.mockResolvedValue([
            makeRow("Yamaha", "XMAX", "XMAX 256"),
            makeRow("Yamaha", "XMAX", "XMAX Tech Max"),
            makeRow("Honda", "PCX", "PCX 160"),
            makeRow("Yamaha", "XMAX", "XMAX Old"),
            makeRow("Honda", "PCX", "PCX Connected"),
        ])

        const result = await getTopSellingUnits(6, null)

        expect(result).toEqual([
            { name: "Yamaha XMAX", count: 3, percentage: 100 },
            { name: "Honda PCX", count: 2, percentage: 67 },
        ])
    })

    it("limits to topN items", async () => {
        mocks.findMany.mockResolvedValue([
            makeRow("Yamaha", "XMAX", "XMAX 1"),
            makeRow("Honda", "PCX", "PCX 1"),
            makeRow("Kawasaki", "Ninja", "Ninja 1"),
            makeRow("Suzuki", "GSX", "GSX 1"),
            makeRow("Kawasaki", "W175", "W175"),
            makeRow("Honda", "Beat", "Beat 1"),
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
        const now = new Date()
        const diffMonths = (now.getFullYear() - gte.getFullYear()) * 12 + (now.getMonth() - gte.getMonth())
        expect(diffMonths).toBeGreaterThanOrEqual(11)
        expect(diffMonths).toBeLessThanOrEqual(12)
    })

    it("only queries COMPLETED transactions", async () => {
        mocks.findMany.mockResolvedValue([])
        await getTopSellingUnits(6, null)
        expect(mocks.findMany.mock.calls[0][0].where.status).toBe("COMPLETED")
    })

    it("calculates percentage relative to rank 1", async () => {
        mocks.findMany.mockResolvedValue([
            makeRow("Yamaha", "XMAX", "XMAX 1"),
            makeRow("Yamaha", "XMAX", "XMAX 2"),
            makeRow("Honda", "PCX", "PCX 1"),
            makeRow("Honda", "PCX", "PCX 2"),
            makeRow("Honda", "PCX", "PCX 3"),
        ])

        const result = await getTopSellingUnits(6, null)
        expect(result[0]).toEqual({ name: "Honda PCX", count: 3, percentage: 100 })
        expect(result[1]).toEqual({ name: "Yamaha XMAX", count: 2, percentage: 67 })
    })

    it("handles tie-breaking by canonical name ascending", async () => {
        mocks.findMany.mockResolvedValue([
            makeRow("Honda", "PCX", "PCX 1"),
            makeRow("Honda", "PCX", "PCX 2"),
            makeRow("Yamaha", "XMAX", "XMAX 1"),
            makeRow("Yamaha", "XMAX", "XMAX 2"),
        ])

        const result = await getTopSellingUnits(6, null)
        expect(result[0].name).toBe("Honda PCX")
        expect(result[1].name).toBe("Yamaha XMAX")
    })

    it("merges structured model variants but keeps different models separate", async () => {
        mocks.findMany.mockResolvedValue([
            makeRow("Yamaha", "XMAX", "ignored"),
            makeRow("Yamaha", "XMAX Old", "ignored"),
            makeRow("Yamaha", "XMAX Connected", "ignored"),
            makeRow("Yamaha", "XMAX Tech Max", "ignored"),
            makeRow("Yamaha", "XMAX 2024 Matte Black", "ignored"),
            makeRow("Yamaha", "NMAX", "ignored"),
        ])

        const result = await getTopSellingUnits(6, null)
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

// ─── Boundary tests: Prisma row → aggregateTopSellingUnits ────
describe("aggregateTopSellingUnits (Prisma row boundary)", () => {
    it("regression: 11 XMAX + 1 variant-only Connected from Prisma → 12 Yamaha XMAX", () => {
        // Simulates real DB rows: 11 with model="XMAX", 1 with model="Connected"
        const xmax = Array.from({ length: 11 }, () =>
            makeRow("Yamaha", "XMAX", "Yamaha XMAX 2023")
        )
        const connected = makeRow(
            "Yamaha",
            "Connected",
            "Yamaha XMAX Connected 2023 warna Hitam",
        )

        const result = aggregateTopSellingUnits([...xmax, connected])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ name: "Yamaha XMAX", count: 12, percentage: 100 })
    })

    it("regression: 84 structured + 3 raw-name → 87 Yamaha XMAX", () => {
        const structured = Array.from({ length: 84 }, () =>
            makeRow("Yamaha", "XMAX", "Yamaha XMAX 2024")
        )
        const rawFallback = [
            makeRow("Yamaha", null, "Yamaha XMAX 2023 warna hijau"),
            makeRow("Yamaha", null, "Yamaha XMAX 2023 warna biru"),
            makeRow("Yamaha", null, "Yamaha XMAX 2023 warna hitam"),
        ]

        const result = aggregateTopSellingUnits([...structured, ...rawFallback])
        expect(result[0]).toEqual({ name: "Yamaha XMAX", count: 87, percentage: 100 })
    })

    it("variant-only Old and Tech Max merge into correct model", () => {
        const result = aggregateTopSellingUnits([
            makeRow("Yamaha", "XMAX", "Yamaha XMAX 2024"),
            makeRow("Yamaha", "Old", "Yamaha XMAX Old 2022"),
            makeRow("Yamaha", "Tech Max", "Yamaha XMAX Tech Max 2024"),
        ])
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ name: "Yamaha XMAX", count: 3, percentage: 100 })
    })

    it("NMAX remains separate from XMAX even with variant-only Connected rows", () => {
        const result = aggregateTopSellingUnits([
            makeRow("Yamaha", "XMAX", "Yamaha XMAX 2024"),
            makeRow("Yamaha", "Connected", "Yamaha XMAX Connected 2023"),
            makeRow("Yamaha", "NMAX", "Yamaha NMAX 2024"),
        ])
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual({ name: "Yamaha XMAX", count: 2, percentage: 100 })
        expect(result[1]).toEqual({ name: "Yamaha NMAX", count: 1, percentage: 50 })
    })

    it("unknown model not guessed from brand", () => {
        const result = aggregateTopSellingUnits([
            makeRow("Yamaha", "XMAX", "Yamaha XMAX 2024"),
            makeRow("Yamaha", "Connected", "Yamaha Connected"),  // no model in raw name either
        ])
        expect(result).toHaveLength(2)
        expect(result.find(r => r.name === "Yamaha")).toBeDefined()
        expect(result.find(r => r.name === "Yamaha XMAX")).toBeDefined()
    })

    it("derives model from raw name when brand is present but model is null", () => {
        const result = aggregateTopSellingUnits([
            makeRow("Yamaha", null, "Yamaha XMAX 2024"),
        ])
        expect(result[0]).toEqual({ name: "Yamaha XMAX", count: 1, percentage: 100 })
    })

    it("derives model from raw name when model is variant-only", () => {
        const result = aggregateTopSellingUnits([
            makeRow("Honda", "Old", "Honda Beat Street 2023 warna Biru"),
        ])
        expect(result[0]).toEqual({ name: "Honda Beat Street", count: 1, percentage: 100 })
    })
})

// ─── Response contract tests ──────────────────────────────────
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

    it("validates investor periods against the same 6/12/24 allowlist", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/app/api/investor/dashboard/route.ts", "utf8")
        expect(src).toContain("new Set([6, 12, 24])")
        expect(src).toContain("String(requestedMonths) === (monthsParam ?? \"6\")")
        expect(src).toContain(": 6")
    })

    it("renders accessible relative bars and a clear empty state", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/components/dashboard/TopSellingUnits.tsx", "utf8")
        expect(src).toContain('<ol className="space-y-3">')
        expect(src).toContain('<li key={item.name}')
        expect(src).toContain('aria-hidden="true"')
        expect(src).toContain('role="progressbar"')
        expect(src).toContain("aria-valuenow={item.percentage}")
        expect(src).toContain('style={{ width: `${item.percentage}%` }}')
        expect(src).toContain("Belum ada penjualan pada periode ini.")
        expect(src).toContain("dark:")
    })

    it("top-selling.ts exports SoldUnitRow type for query boundary typing", async () => {
        const { readFileSync } = await import("node:fs")
        const src = readFileSync("src/lib/top-selling.ts", "utf8")
        expect(src).toContain("export type SoldUnitRow")
        expect(src).toContain("select: { brand: true, model: true, name: true }")
    })
})
