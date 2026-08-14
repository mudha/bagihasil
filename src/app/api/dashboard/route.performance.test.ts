import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(`${process.cwd()}/src/app/api/dashboard/route.ts`, "utf8")

describe("dashboard general statistics queries", () => {
    it("starts the three independent reads together", () => {
        expect(source).toMatch(/const \[activeUnits, completedTransactions, profitStats\] = await Promise\.all\(\[\s*prisma\.unit\.count\(\{ where: unitWhere \}\),\s*prisma\.transaction\.count\(\{ where: transactionWhere \}\),\s*prisma\.profitSharing\.aggregate\(\{/)
    })
})
