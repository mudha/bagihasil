import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    unitCount: vi.fn(),
    transactionCount: vi.fn(),
    profitAggregate: vi.fn(),
    investorFindMany: vi.fn(),
    profitFindMany: vi.fn(),
    unitGroupBy: vi.fn(),
    transactionFindMany: vi.fn(),
    unitFindMany: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/date-utils", () => ({
    getHijriMonthYear: (date: Date) => ({ key: `hijri-${date.toISOString()}` }),
}))
vi.mock("@/lib/api-auth", () => ({
    canReadAdminData: () => true,
    getInvestorForSession: vi.fn(),
}))
vi.mock("@/lib/dashboard-access", () => ({ investorStatsScope: () => ({}) }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        unit: {
            count: mocks.unitCount,
            groupBy: mocks.unitGroupBy,
            findMany: mocks.unitFindMany,
        },
        transaction: {
            count: mocks.transactionCount,
            findMany: mocks.transactionFindMany,
        },
        profitSharing: {
            aggregate: mocks.profitAggregate,
            findMany: mocks.profitFindMany,
        },
        investor: { findMany: mocks.investorFindMany },
    },
}))

import { GET } from "./route"

type FixtureProfit = {
    calculatedAt: Date
    netMargin: number
    investorProfitAmount: number
    managerProfitAmount: number
    transaction: { sellDate: Date; sellPrice: number }
}

const profit = (
    sellDate: string,
    sellPrice: number,
    netMargin: number,
    investorProfitAmount: number,
    managerProfitAmount: number,
): FixtureProfit => ({
    calculatedAt: new Date(sellDate),
    netMargin,
    investorProfitAmount,
    managerProfitAmount,
    transaction: { sellDate: new Date(sellDate), sellPrice },
})

const marchToAugustFixture: FixtureProfit[] = [
    profit("2026-06-18T05:00:00.000Z", 600, 300, 180, 120),
    profit("2026-03-12T05:00:00.000Z", 100, 30, 18, 12),
    profit("2026-08-31T16:59:59.999Z", 350, 120, 72, 48),
    profit("2026-04-20T05:00:00.000Z", 200, 100, 60, 40),
    profit("2026-05-15T05:00:00.000Z", 150, 50, 30, 20),
    profit("2026-07-10T05:00:00.000Z", 250, 100, 60, 40),
    profit("2026-04-02T05:00:00.000Z", 300, 150, 90, 60),
]

describe("GET /api/dashboard Gregorian monthly series", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-08-31T05:00:00.000Z"))
        vi.clearAllMocks()

        mocks.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } })
        mocks.unitCount.mockResolvedValue(0)
        mocks.transactionCount.mockResolvedValue(0)
        mocks.profitAggregate.mockResolvedValue({
            _sum: { netMargin: 0, investorProfitAmount: 0, managerProfitAmount: 0 },
        })
        mocks.investorFindMany.mockResolvedValue([])
        mocks.profitFindMany.mockResolvedValue(marchToAugustFixture)
        mocks.unitGroupBy.mockResolvedValue([])
        mocks.transactionFindMany.mockResolvedValue([])
        mocks.unitFindMany.mockResolvedValue([])
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("returns six chronological Gregorian buckets without dropping April or June", async () => {
        const response = await GET(new Request("http://localhost/api/dashboard?months=6"))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.monthlyStats).toEqual([
            { month: "Mar 2026", totalRevenue: 100, totalMargin: 30, investorShare: 18, managerShare: 12, unitsSold: 1 },
            { month: "Apr 2026", totalRevenue: 500, totalMargin: 250, investorShare: 150, managerShare: 100, unitsSold: 2 },
            { month: "May 2026", totalRevenue: 150, totalMargin: 50, investorShare: 30, managerShare: 20, unitsSold: 1 },
            { month: "Jun 2026", totalRevenue: 600, totalMargin: 300, investorShare: 180, managerShare: 120, unitsSold: 1 },
            { month: "Jul 2026", totalRevenue: 250, totalMargin: 100, investorShare: 60, managerShare: 40, unitsSold: 1 },
            { month: "Aug 2026", totalRevenue: 350, totalMargin: 120, investorShare: 72, managerShare: 48, unitsSold: 1 },
        ])
    })

    it("queries completed transactions by the authoritative sellDate from the Jakarta period start", async () => {
        await GET(new Request("http://localhost/api/dashboard?months=6"))

        expect(mocks.profitFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                transaction: {
                    status: "COMPLETED",
                    sellDate: { gte: new Date("2026-02-28T17:00:00.000Z") },
                },
            },
        }))
    })

    it("keeps six chronological year-aware buckets across a year boundary", async () => {
        vi.setSystemTime(new Date("2026-03-31T05:00:00.000Z"))
        mocks.profitFindMany.mockResolvedValue([
            profit("2026-03-20T05:00:00.000Z", 60, 30, 18, 12),
            profit("2025-10-10T05:00:00.000Z", 10, 5, 3, 2),
            profit("2026-01-15T05:00:00.000Z", 40, 20, 12, 8),
        ])

        const body = await (await GET(new Request("http://localhost/api/dashboard?months=6"))).json()

        expect(body.monthlyStats.map((item: { month: string }) => item.month)).toEqual([
            "Oct 2025",
            "Nov 2025",
            "Dec 2025",
            "Jan 2026",
            "Feb 2026",
            "Mar 2026",
        ])
    })

    it("keeps a real no-data month as an explicit zero bucket", async () => {
        mocks.profitFindMany.mockResolvedValue(
            marchToAugustFixture.filter(item => item.transaction.sellDate.getUTCMonth() !== 4),
        )

        const body = await (await GET(new Request("http://localhost/api/dashboard?months=6"))).json()
        const may = body.monthlyStats.find((item: { month: string }) => item.month === "May 2026")

        expect(body.monthlyStats).toHaveLength(6)
        expect(may).toEqual({
            month: "May 2026",
            totalMargin: 0,
            investorShare: 0,
            managerShare: 0,
            unitsSold: 0,
            totalRevenue: 0,
        })
    })

    it("includes Jakarta period boundaries and ignores adjacent-month fixture records", async () => {
        mocks.profitFindMany.mockResolvedValue([
            profit("2026-02-28T16:59:59.999Z", 999, 999, 999, 999),
            profit("2026-02-28T17:00:00.000Z", 10, 4, 3, 1),
            profit("2026-08-31T16:59:59.999Z", 20, 8, 5, 3),
            profit("2026-08-31T17:00:00.000Z", 999, 999, 999, 999),
        ])

        const body = await (await GET(new Request("http://localhost/api/dashboard?months=6"))).json()
        const march = body.monthlyStats[0]
        const august = body.monthlyStats[5]

        expect(march).toEqual({ month: "Mar 2026", totalRevenue: 10, totalMargin: 4, investorShare: 3, managerShare: 1, unitsSold: 1 })
        expect(august).toEqual({ month: "Aug 2026", totalRevenue: 20, totalMargin: 8, investorShare: 5, managerShare: 3, unitsSold: 1 })
    })

    it("keeps Gregorian buckets separate from Hijri grouping", async () => {
        const body = await (await GET(new Request("http://localhost/api/dashboard?months=6"))).json()

        expect(body.monthlyStats).toHaveLength(6)
        expect(body.monthlyStats.every((item: { month: string }) => !item.month.startsWith("hijri-"))).toBe(true)
        expect(body.monthlyStatsHijri.every((item: { month: string }) => item.month.startsWith("hijri-"))).toBe(true)
    })
})
