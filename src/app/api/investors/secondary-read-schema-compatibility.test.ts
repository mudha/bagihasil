import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const route = (name: string) =>
    readFileSync(resolve(__dirname, name), "utf8")

const legacyInvestorFields = [
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
]

describe("Investor mutation pre-migration schema compatibility", () => {
    it("POST uses the existing legacy investor selection for its mutation result", () => {
        const source = route("route.ts")

        expect(source).toMatch(
            /prisma\.investor\.create\(\{[\s\S]*?data: validatedData,[\s\S]*?select: legacyInvestorScalarSelect[\s\S]*?\}\)/,
        )
    })

    it("PUT uses the existing legacy investor selection for its mutation result", () => {
        const source = route("[id]/route.ts")

        const mutation = source.match(
            /prisma\.investor\.update\(\{([\s\S]*?)\}\)/,
        )?.[1]

        expect(mutation).toBeDefined()
        expect(mutation).toContain("where: { id }")
        expect(mutation).toContain("data: validatedData")
        expect(mutation).toContain("select: legacyInvestorScalarSelect")
    })

    it("keeps every existing legacy scalar response field without the pending field", () => {
        const helper = readFileSync(
            resolve(__dirname, "../../../lib/legacy-read-selects.ts"),
            "utf8",
        )
        const selection = helper.match(
            /export const legacyInvestorScalarSelect = \{([\s\S]*?)\} satisfies Prisma\.InvestorSelect/,
        )?.[1]

        expect(selection).toBeDefined()
        for (const field of legacyInvestorFields) {
            expect(selection).toContain(`${field}: true`)
        }
        expect(selection).not.toContain("capitalLedgerOpenedAt")
    })

    it("keeps auth and validation guards before both mutations", () => {
        const post = route("route.ts")
        const put = route("[id]/route.ts")

        expect(post.indexOf("if (!session)")).toBeLessThan(post.indexOf("prisma.investor.create"))
        expect(post.indexOf("investorSchema.parse")).toBeLessThan(post.indexOf("prisma.investor.create"))
        expect(put.indexOf("if (!session)")).toBeLessThan(put.indexOf("prisma.investor.update"))
        expect(put.indexOf("investorSchema.partial().parse")).toBeLessThan(put.indexOf("prisma.investor.update"))
    })
})
