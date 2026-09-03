import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const pageSource = readFileSync(
    `${process.cwd()}/src/app/dashboard/units/page.tsx`,
    "utf8"
)

const componentSource = readFileSync(
    `${process.cwd()}/src/components/units/UnitCardMobile.tsx`,
    "utf8"
)

const combinedSource = pageSource + componentSource

describe("unit investor tone wiring", () => {
    it("uses the shared helper without local palette duplicates", () => {
        expect(pageSource).toContain('import { getInvestorToneTheme } from "@/lib/investor-tone"')
        expect(pageSource).not.toMatch(/const INVESTOR_TONES\s*=/)
        expect(pageSource).not.toMatch(/const INVESTOR_TONE_OVERRIDES\s*:/)
        expect(pageSource).not.toMatch(/const getInvestorTone\s*=/)
    })

    it("preserves both unit investor-tone call sites in the page", () => {
        expect(pageSource.match(/getInvestorToneTheme\(unit\.investor\.name \|\| unit\.investorId, isDark\)/g)).toHaveLength(2)
    })

    it("preserves every mobile and desktop tone property access across page and component", () => {
        expect(combinedSource.match(/investorTone\.accent/g)).toHaveLength(6)
        expect(combinedSource.match(/investorTone\.stripe/g)).toHaveLength(1)
        expect(combinedSource.match(/investorTone\.chipBg/g)).toHaveLength(2)
        expect(combinedSource.match(/investorTone\.chipText/g)).toHaveLength(2)
        expect(combinedSource.match(/investorTone\.rowBg/g)).toHaveLength(1)
    })
})
