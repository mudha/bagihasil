import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./run-transaction.ts", import.meta.url), "utf8")

describe("transaction E2E runner fail-closed count", () => {
    it("counts every fixture family seeded by the transaction workflow", () => {
        expect(source).toContain("countE2EUsers()")
        expect(source).toContain("countE2ETransactionFixtures()")
        expect(source).toContain("countE2EFinancialFixtures()")
    })
})