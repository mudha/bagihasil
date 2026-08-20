import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync("src/app/api/transactions/[id]/route.ts", "utf8")

describe("transaction update payload", () => {
    it("removes profit-sharing percentages before prisma transaction update", () => {
        expect(source).toMatch(/investorSharePercentage:\s*_investorSharePercentage/)
        expect(source).toMatch(/managerSharePercentage:\s*_managerSharePercentage/)
        expect(source).toMatch(/\.\.\.transactionData/)
        expect(source).toContain("data: updateData")
    })
})
