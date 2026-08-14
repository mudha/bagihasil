import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/app/dashboard/transactions/page.tsx`,
    "utf8"
)

describe("transaction investor initials wiring", () => {
    it("uses the shared pure helper instead of a local duplicate", () => {
        expect(source).toContain('import { getInvestorInitials } from "@/lib/investor-initials"')
        expect(source).not.toMatch(/const getInvestorInitials\s*=/)
    })

    it("preserves both transaction investor call sites", () => {
        expect(source.match(/getInvestorInitials\(trx\.unit\.investor\.name\)/g)).toHaveLength(2)
    })
})
