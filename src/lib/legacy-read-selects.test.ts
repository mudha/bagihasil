import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
    legacyInvestorSelect,
    legacyInvestorScalarSelect,
    legacyTransactionSelect,
    legacyTransactionForDashboardSelect,
    legacyUnitWithInvestorSelect,
    legacyUnitWithTransactionsSelect,
} from "./legacy-read-selects"

const unitsRoute = readFileSync("src/app/api/units/route.ts", "utf8")
const transactionsRoute = readFileSync("src/app/api/transactions/route.ts", "utf8")
const investorsRoute = readFileSync("src/app/api/investors/route.ts", "utf8")
const investorDashboardRoute = readFileSync("src/app/api/investor/dashboard/route.ts", "utf8")
const investorData = readFileSync("src/lib/investor-data.ts", "utf8")

describe("Production schema compatibility read selections", () => {
    it("excludes pending Investor and Transaction fields from every legacy selection", () => {
        expect(legacyInvestorSelect).not.toHaveProperty("capitalLedgerOpenedAt")
        expect(legacyInvestorScalarSelect).not.toHaveProperty("capitalLedgerOpenedAt")
        expect(legacyTransactionSelect).not.toHaveProperty("finalizationVersion")
        expect(legacyTransactionForDashboardSelect).not.toHaveProperty("finalizationVersion")
        expect(legacyUnitWithInvestorSelect.investor.select).not.toHaveProperty("capitalLedgerOpenedAt")
        expect(legacyTransactionSelect.unit.select.investor.select).not.toHaveProperty("capitalLedgerOpenedAt")
        expect(legacyUnitWithTransactionsSelect.transactions.select).not.toHaveProperty("finalizationVersion")
    })

    it("preserves the complete pre-ledger Investor scalar response", () => {
        expect(Object.keys(legacyInvestorSelect)).toEqual([
            "id",
            "userId",
            "name",
            "contactInfo",
            "notes",
            "bankAccountDetails",
            "marginPercentage",
            "isActive",
            "managedCapitalBalance",
            "managedCapitalBalanceUpdatedAt",
            "createdAt",
            "updatedAt",
        ])
    })

    it("preserves the complete pre-ledger Unit scalar response", () => {
        expect(Object.keys(legacyUnitWithInvestorSelect).filter((key) => key !== "investor")).toEqual([
            "id",
            "investorId",
            "name",
            "plateNumber",
            "code",
            "imageUrl",
            "stnkImageUrl",
            "engineNumber",
            "chassisNumber",
            "taxDueDate",
            "status",
            "createdAt",
            "updatedAt",
            "vehicleType",
            "brand",
            "model",
            "type",
            "year",
            "color",
            "kilometer",
        ])
    })

    it("adopts explicit selections on the affected read routes", () => {
        expect(unitsRoute).toContain("select: legacyUnitWithInvestorSelect")
        expect(transactionsRoute).toContain("select: legacyTransactionSelect")
        expect(investorsRoute).toContain("select: legacyInvestorSelect")
        expect(investorDashboardRoute).toContain("select: legacyTransactionWithUnitSelect")
        expect(investorDashboardRoute).toContain("...legacyUnitWithInvestorSelect")
        expect(investorData).toContain("select: legacyInvestorDashboardSelect")
        expect(investorData).toContain("select: legacyTransactionForDashboardSelect")
        expect(investorData).toContain("select: legacyUnitWithTransactionsSelect")
    })
})
