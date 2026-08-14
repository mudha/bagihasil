import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(`${process.cwd()}/src/app/dashboard/page.tsx`, "utf8")

describe("dashboard export bundle", () => {
    it("loads export utilities only when an export is requested", () => {
        expect(source).not.toMatch(/import\s*\{[^}]*exportInvestorReport[^}]*\}\s*from\s*["']@\/lib\/export-utils["']/)
        expect(source.match(/await import\(["']@\/lib\/export-utils["']\)/g)).toHaveLength(2)
    })

    it("always unlocks the export UI when a lazy import fails", () => {
        expect(source.match(/catch(?:\s*\([^)]*\))?\s*\{\s*toast\.dismiss\(loadingToastId\)\s*toast\.error\(/g)).toHaveLength(2)
        expect(source.match(/finally\s*\{\s*setExportingReport\(false\)\s*\}/g)).toHaveLength(2)
        expect(source.match(/toast\.dismiss\(loadingToastId\)/g)).toHaveLength(4)
    })
})
