import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const transactionsSource = readFileSync(
    `${process.cwd()}/src/app/dashboard/transactions/page.tsx`,
    "utf8"
)
const unitsSource = readFileSync(
    `${process.cwd()}/src/app/dashboard/units/page.tsx`,
    "utf8"
)

describe("dashboard upload state wiring", () => {
    it("keeps the active transaction upload and scan flow without a duplicate dead handler", () => {
        expect(transactionsSource).not.toContain("handleImagesChange")
        expect(transactionsSource).not.toMatch(/import\s*\{[^}]*\buseCallback\b[^}]*\}\s*from\s*["']react["']/)
        expect(transactionsSource).toMatch(/onImagesChange=\{\(images\) => \{[\s\S]*setUploadedFiles\(files\)/)
        expect(transactionsSource).toContain("onClick={handleScanProof}")
        expect(transactionsSource).toContain("disabled={isScanning || uploadedFiles.length === 0}")
    })

    it("does not keep an unused unit upload state pair", () => {
        expect(unitsSource).not.toContain("const [isUploading, setIsUploading] = useState(false)")
    })
})
