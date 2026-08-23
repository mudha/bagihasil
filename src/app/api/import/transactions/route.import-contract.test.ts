import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8")
const validationSource = readFileSync(new URL("./import-validation.ts", import.meta.url), "utf8")

describe("import route financial contract", () => {
    it("validates import numbers before any row transaction write", () => {
        const validation = source.indexOf("parseImportNumber(buyPrice")
        const rowWrite = source.indexOf("await prisma.$transaction(async (tx)")
        expect(validation).toBeGreaterThan(-1)
        expect(rowWrite).toBeGreaterThan(validation)
        expect(validationSource).toContain("Number(value.trim())")
        expect(validationSource).toContain("Number.isFinite(parsed)")
    })

    it("validates the effective 100% nisbah before helper and persistence", () => {
        const validation = source.indexOf("validateImportProfitShares(investorSharePercentage, managerSharePercentage)")
        const helper = source.indexOf("calculateProfitSharing({")
        const profitWrite = source.indexOf("await tx.profitSharing.create({")
        expect(validation).toBeGreaterThan(-1)
        expect(helper).toBeGreaterThan(validation)
        expect(profitWrite).toBeGreaterThan(helper)
    })

    it("keeps transaction, cost, profit-sharing, and unit writes in one row transaction", () => {
        const rowStart = source.indexOf("await prisma.$transaction(async (tx)")
        const success = source.indexOf("successCount++", rowStart)
        const rowBody = source.slice(rowStart, success)
        expect(rowBody).toContain("await tx.transaction.create")
        expect(rowBody).toContain("await tx.cost.createMany")
        expect(rowBody).toContain("await tx.profitSharing.create")
        expect(rowBody).toContain("await tx.transaction.update")
        expect(rowBody).toContain("await tx.unit.update")
        expect(rowBody).not.toContain("await prisma.transaction.create")
        expect(rowBody).not.toContain("await prisma.profitSharing.create")
    })

    it("uses shared helper outputs for persisted financial values", () => {
        expect(source).toContain("netMargin: calculation.netMargin")
        expect(source).toContain("investorProfitAmount: calculation.investorProfitAmount")
        expect(source).toContain("managerProfitAmount: calculation.managerProfitAmount")
        expect(source).toContain("data: { profitStatus: calculation.profitStatus }")
    })
})
