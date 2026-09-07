import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("dashboard flexible period contract", () => {
    it("offers legacy presets, all-time, and a validated custom range", () => {
        const source = read("src/components/dashboard/DashboardPeriodFilter.tsx")
        for (const label of [
            "6 Bulan Terakhir",
            "1 Tahun Terakhir",
            "2 Tahun Terakhir",
            "Semua Waktu",
            "Rentang Tanggal…",
        ]) {
            expect(source).toContain(label)
        }
        expect(source).toContain('type="date"')
        expect(source).toContain("customFrom <= customTo")
        expect(source).toContain("disabled={!customRangeValid}")
    })

    it("wires the same period query to admin and investor reads", () => {
        const admin = read("src/app/dashboard/page.tsx")
        const investor = read("src/app/dashboard/investor/page.tsx")
        expect(admin).toContain("`/api/dashboard?${periodQuery}`")
        expect(investor).toContain("`/api/investor/dashboard?${periodQuery}`")
        for (const source of [admin, investor]) {
            expect(source).toContain('setPeriodQuery("range=all")')
            expect(source).toContain("range=custom&from=")
        }
    })

    it("keeps investor identity server-authoritative", () => {
        const source = read("src/app/api/investor/dashboard/route.ts")
        expect(source).toContain("getInvestorDashboardData(session.user.id!, period)")
        expect(source).toContain("getTopSellingUnits(period, investor.id)")
        expect(source).not.toMatch(/searchParams\.get\(["']investorId["']\)/)
    })

    it("temporarily hides Status Unit without removing its response contract", () => {
        const page = read("src/app/dashboard/page.tsx")
        const route = read("src/app/api/dashboard/route.ts")
        expect(page).not.toContain('>Status Unit</')
        expect(page).not.toContain("<PieChart")
        expect(route).toContain("unitStatusDistribution")
    })

    it("renders accessible horizontal performance bars following the selected period", () => {
        const source = read("src/app/dashboard/page.tsx")
        expect(source).toContain('role="list" aria-label="Peringkat performa pemodal"')
        expect(source).toContain('role="progressbar"')
        expect(source).toContain("topInvestorProfit")
        expect(source).toContain("Ranking bagi hasil untuk {periodDescription}.")
        expect(source).not.toContain("30 hari terakhir")
    })
})
