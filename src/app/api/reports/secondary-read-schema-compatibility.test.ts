import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const selections = readFileSync("src/lib/legacy-read-selects.ts", "utf8")
const transactionDetail = readFileSync("src/app/api/transactions/[id]/route.ts", "utf8")
const transactionReport = readFileSync("src/app/api/reports/transaction/[transactionId]/route.ts", "utf8")
const investorReport = readFileSync("src/app/api/reports/investor/[investorId]/route.ts", "utf8")
const investorCsv = readFileSync("src/app/api/reports/investor/[investorId]/csv/route.ts", "utf8")
const allInvestors = readFileSync("src/app/api/reports/all-investors/route.ts", "utf8")
const unitsPage = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const transactionDetailGet = transactionDetail.slice(0, transactionDetail.indexOf("export async function PUT"))

const reportSources = [transactionReport, investorReport, investorCsv, allInvestors]

describe("secondary read schema compatibility contracts", () => {
    it("defines typed selections for every secondary read graph", () => {
        expect(selections).toContain("legacyTransactionDetailSelect")
        expect(selections).toContain("legacyTransactionReportSelect")
        expect(selections).toContain("legacyInvestorReportSelect")
        expect(selections).toContain("legacyTransactionProofSelect")
        expect(selections).toContain("legacyCostWithProofsSelect")
        expect(selections).toContain("satisfies Prisma.TransactionSelect")
        expect(selections).toContain("satisfies Prisma.InvestorSelect")
        expect(selections).toContain('orderBy: { buyDate: "desc" }')
        expect(selections).toContain('orderBy: { sellDate: "desc" }')
        expect(selections).toContain('orderBy: { buyDate: "asc" }')
        expect(selections).toContain('orderBy: { date: "asc" }')
        expect(selections).toContain('orderBy: { paymentDate: "asc" }')
    })

    it("adopts explicit legacy selections without implicit relation includes", () => {
        expect(transactionDetailGet).toContain("legacyTransactionDetailSelect")
        const expectedHelpers = [
            [transactionReport, "legacyTransactionDetailSelect"],
            [investorReport, "legacyInvestorReportSelect"],
            [investorCsv, "legacyInvestorCsvReportSelect"],
            [allInvestors, "legacyAllInvestorsReportSelect"],
        ] as const
        for (const [source, helper] of expectedHelpers) {
            expect(source).toContain(helper)
            expect(source).not.toContain("include:")
        }
        expect(transactionDetailGet).not.toContain("include:")
    })

    it("excludes pending fields while retaining report and detail response contracts", () => {
        const scopedSource = [selections, transactionDetailGet, ...reportSources].join("\n")
        expect(scopedSource).not.toContain("capitalLedgerOpenedAt")
        expect(scopedSource).not.toContain("finalizationVersion")
        for (const field of [
            "transactionCode", "buyDate", "buyPrice", "sellDate", "sellPrice",
            "initialInvestorCapital", "initialManagerCapital", "paymentStatus",
            "costs", "profitSharing", "paymentHistories", "proofs",
            "investorProfitAmount", "totalCapitalInvestor", "name",
        ]) {
            expect(scopedSource).toContain(field)
        }
    })

    it("keeps Unit detail on the already-loaded list payload", () => {
        expect(unitsPage).toContain("<AdminUnitDetailDialog")
        expect(unitsPage).toMatch(/unit=\{viewingUnit\}/)
    })
})
