import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const paymentSource = readFileSync(
    `${process.cwd()}/src/components/transactions/AddPaymentDialog.tsx`,
    "utf8"
)
const finalizeSource = readFileSync(
    `${process.cwd()}/src/components/transactions/FinalizeTransactionDialog.tsx`,
    "utf8"
)

describe("responsive transaction dialogs", () => {
    it("keeps the payment dialog inside the viewport with an internally scrollable form", () => {
        expect(paymentSource).toContain("max-h-[calc(100dvh-1rem)]")
        expect(paymentSource).toContain("grid-rows-[auto_minmax(0,1fr)]")
        expect(paymentSource).toContain("min-h-0 space-y-4 overflow-y-auto overscroll-contain")
    })

    it("keeps the finalization dialog inside the viewport with an internally scrollable form", () => {
        expect(finalizeSource).toContain("max-h-[calc(100dvh-1rem)]")
        expect(finalizeSource).toContain("grid-rows-[auto_minmax(0,1fr)]")
        expect(finalizeSource).toContain("min-h-0 space-y-4 overflow-y-auto overscroll-contain")
    })

    it("preserves payment proof file validation, paste support, and accurate attachment state", () => {
        expect(paymentSource).toContain('accept="image/jpeg,image/jpg,image/png,application/pdf"')
        expect(paymentSource).toContain("document.addEventListener('paste', handlePaste)")
        expect(paymentSource).toContain("validateImageFile(file)")
        expect(paymentSource).toContain("{imageFile ? 1 : 0}/1")
        expect(paymentSource).toContain("fileInputRef.current.value = ''")
    })
})
