import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/components/transactions/AddPaymentDialog.tsx`,
    "utf8"
)

describe("payment proof image analysis lifecycle", () => {
    it("uses a stable form-aware analysis callback in the paste listener", () => {
        expect(source).toContain("useCallback")
        expect(source).toMatch(/const analyzeImage = useCallback\(async \(file: File\) => \{[\s\S]*?\}, \[setValue, watch\]\)/)
        expect(source).toContain("[isOpen, analyzeImage]")
    })

    it("preserves the guarded AI parsing flow and form updates", () => {
        expect(source).toContain("if (isAnalyzingRef.current) return")
        expect(source).toContain("isAnalyzingRef.current = true")
        expect(source).toContain("fetch('/api/ai/parse-receipt'")
        expect(source).toContain('setValue("amount", amount, { shouldValidate: true })')
        expect(source).toContain('setValue("paymentDate", date, { shouldValidate: true })')
        expect(source).toContain('setValue("notes", description, { shouldValidate: true })')
        expect(source).toContain("isAnalyzingRef.current = false")
    })

    it("preserves paste/file validation, preview, and listener cleanup", () => {
        expect(source).toContain("const validation = validateImageFile(file)")
        expect(source).toContain("analyzeImage(file) // Trigger AI analysis")
        expect(source).toContain("reader.readAsDataURL(file)")
        expect(source).toContain("document.addEventListener('paste', handlePaste)")
        expect(source).toContain("document.removeEventListener('paste', handlePaste)")
    })
})
