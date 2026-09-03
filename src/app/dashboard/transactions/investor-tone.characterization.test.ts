import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/app/dashboard/transactions/page.tsx`,
    "utf8"
)

describe("transaction investor tone wiring", () => {
    it("uses the shared helper without local palette duplicates", () => {
        expect(source).toContain('import { getInvestorToneTheme } from "@/lib/investor-tone"')
        expect(source).not.toMatch(/const INVESTOR_TONES\s*=/)
        expect(source).not.toMatch(/const INVESTOR_TONE_OVERRIDES\s*:/)
        expect(source).not.toMatch(/const getInvestorTone\s*=/)
    })

    it("preserves both transaction investor-tone call sites", () => {
        expect(source.match(/getInvestorToneTheme\(trx\.unit\.investor\.name \|\| trx\.unit\.investorId, isDark\)/g)).toHaveLength(2)
    })

    it("preserves every mobile and desktop tone property access", () => {
        expect(source.match(/investorTone\.accent/g)).toHaveLength(6)
        expect(source.match(/investorTone\.stripe/g)).toHaveLength(1)
        expect(source.match(/investorTone\.chipBg/g)).toHaveLength(2)
        expect(source.match(/investorTone\.chipText/g)).toHaveLength(2)
        expect(source.match(/investorTone\.rowBg/g)).toHaveLength(1)
    })
})
