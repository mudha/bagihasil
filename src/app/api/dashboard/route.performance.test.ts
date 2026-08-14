import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(`${process.cwd()}/src/app/api/dashboard/route.ts`, "utf8")

describe("dashboard general statistics queries", () => {
    it("starts the three independent reads together", () => {
        expect(source).toMatch(/const \[activeUnits, completedTransactions, profitStats\] = await Promise\.all\(\[\s*prisma\.unit\.count\(\{ where: unitWhere \}\),\s*prisma\.transaction\.count\(\{ where: transactionWhere \}\),\s*prisma\.profitSharing\.aggregate\(\{/)
    })
})

describe("dashboard recent transactions query", () => {
    it("selects only fields used by the response formatter", () => {
        expect(source).toMatch(/const recentTransactions = await prisma\.transaction\.findMany\(\{[\s\S]*?take: 5,[\s\S]*?select:\s*\{\s*id: true,\s*transactionCode: true,\s*status: true,\s*buyPrice: true,\s*sellPrice: true,\s*buyDate: true,\s*sellDate: true,\s*updatedAt: true,\s*unit:\s*\{\s*select:\s*\{\s*name: true\s*\}\s*\}\s*\}/)
    })
})
