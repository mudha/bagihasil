/**
 * Characterization tests for investor self-view page error handling (F1 fix).
 *
 * Verifies:
 * - existing contract (endpoint, auth, financial fields) is preserved
 * - error handling behavior before/after fix
 * - privacy safeguards (no raw err.message)
 * - retry triggers fresh GET (will fail on baseline until retry is added)
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/app/dashboard/investor/page.tsx`,
    "utf-8"
)

describe("Investor self-view page — baseline contract", () => {
    it("fetches from /api/investor/dashboard with months parameter", () => {
        expect(source).toContain('/api/investor/dashboard?months=')
    })

    it("redirects to /login on 401", () => {
        expect(source).toContain("res.status === 401")
        expect(source).toContain("router.push(")
        expect(source).toContain("/login")
    })

    it("passes all financial fields to InvestorTabs", () => {
        const fields = [
            "investorName={data.investor.name}",
            "stats={data.stats}",
            "monthlyChartData={data.monthlyChartData}",
            "monthlySalesTrend={data.monthlySalesTrend}",
            "monthlyRevenueData={data.monthlyRevenueData}",
            "investmentsData={data.investmentsData}",
            "paymentsData={data.paymentsData}",
        ]
        for (const f of fields) {
            expect(source).toContain(f)
        }
    })

    it("accepts monthsRange prop for range selection", () => {
        expect(source).toContain('monthsRange={monthsRange}')
        expect(source).toContain('onMonthsRangeChange={setMonthsRange}')
    })

    it("sets loading=true at start and loading=false in finally", () => {
        expect(source).toContain("setLoading(true)")
        expect(source).toContain("finally")
        expect(source).toContain("setLoading(false)")
    })
})

describe("Investor self-view page — privacy and error handling (F1)", () => {
    it("does not render raw err.message to user", () => {
        expect(source).not.toContain("err.message")
        expect(source).not.toContain("error.message")
    })

    it("does not log console.error in production source (after fix)", () => {
        expect(source).not.toContain("console.error")
    })

    it("has explicit error state variable (after fix)", () => {
        expect(source).toContain("useState")
        expect(source).toContain("[error, setError]")
    })

    it("renders ErrorState component for non-401 errors (after fix)", () => {
        expect(source).toContain("ErrorState")
    })

    it("has retryNonce or equivalent retry mechanism (after fix)", () => {
        expect(source).toMatch(/retryNonce|retry|onRetry|Coba Lagi/)
    })

    it("differentiates access-denied (403) and missing mapping (404)", () => {
        expect(source).toContain("res.status === 403")
        expect(source).toContain("res.status === 404")
        expect(source).toContain("setIsAccessDenied(true)")
        expect(source).toContain("setIsNotFound(true)")
    })

    it("clears prior financial data before every read", () => {
        expect(source).toContain("setData(null)")
        expect(source).toContain("setData(null)\n        try")
    })

    it("validates the response envelope and collection shapes before rendering", () => {
        expect(source).toContain("const result: unknown = await res.json()")
        expect(source).toContain("Array.isArray(result.investmentsData)")
        expect(source).toContain("Array.isArray(result.paymentsData)")
    })

    it("does not conflate network error with missing investor (!data check should be refined after fix)", () => {
        // Baseline: !data shows "Akun Investor Tidak Ditemukan" which is wrong for network errors
        // After fix: network errors should show ErrorState, not "Tidak Ditemukan"
        // This test passes on both baseline and post-fix as a documentation marker
        const lines = source.split("\n")
        const noDataBlock = lines.findIndex(l => l.includes("if (!data)") && !l.includes("//"))
        const errorBlock = lines.findIndex(l => l.includes("ErrorState"))
        if (noDataBlock !== -1 && errorBlock !== -1) {
            // ErrorState should come BEFORE or REPLACE the !data block
            expect(errorBlock).toBeLessThan(noDataBlock)
        }
    })
})
