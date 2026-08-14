import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(`${process.cwd()}/src/app/dashboard/transactions/page.tsx`, "utf8")

describe("transactions report bundle", () => {
    it("loads the transaction PDF exporter only when export is requested", () => {
        expect(source).not.toMatch(/import\s*\{\s*exportTransactionReportPDF\s*\}\s*from\s*["']@\/lib\/export-utils["']/)
        expect(source).toMatch(/await import\(["']@\/lib\/export-utils["']\)/)
    })

    it("always clears loading state if the lazy import or export fails", () => {
        expect(source).toMatch(/const loadingToastId = toast\.loading\(/)
        expect(source).toMatch(/catch(?:\s*\([^)]*\))?\s*\{\s*toast\.dismiss\(loadingToastId\)\s*toast\.error\(/)
        expect(source).toMatch(/finally\s*\{\s*setExportingTransactionId\(null\)\s*\}/)
        expect(source.match(/toast\.dismiss\(loadingToastId\)/g)).toHaveLength(2)
    })
})
