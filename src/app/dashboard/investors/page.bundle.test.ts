import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(`${process.cwd()}/src/app/dashboard/investors/page.tsx`, "utf8")

const staticExportImports = [
    "exportInvestorReportXLSX",
    "exportInvestorReportPDF",
    "exportAllInvestorsXLSX",
]

describe("investors export bundle", () => {
    it("has no static import for any investor exporter", () => {
        for (const exportName of staticExportImports) {
            const staticImport = new RegExp(
                `import\\s*\\{[^}]*${exportName}[^}]*\\}\\s*from\\s*["']@/lib/export-utils["']`
            )
            expect(source).not.toMatch(staticImport)
        }
    })

    it("loads each exporter only inside its requested action", () => {
        expect(source.match(/await import\(["']@\/lib\/export-utils["']\)/g)).toHaveLength(3)
        expect(source).toContain("const { exportInvestorReportXLSX } = await import")
        expect(source).toContain("const { exportInvestorReportPDF } = await import")
        expect(source).toContain("const { exportAllInvestorsXLSX } = await import")
        expect(source.match(/await runExportAction\(\{/g)).toHaveLength(3)
    })
})
