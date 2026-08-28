/**
 * Characterization tests for Units add/edit dialog DialogDescription (F2 fix).
 *
 * Verifies:
 * - DialogTitle exists (baseline PASS)
 * - DialogDescription present (RED on baseline, PASS after fix)
 * - Form/action/mutation wiring unchanged
 * - Other dialogs not affected
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/app/dashboard/units/page.tsx`,
    "utf-8"
)

const lines = source.split("\n")

// Find the add/edit dialog (DialogContent with full-viewport class)
const dialogContentIdx = lines.findIndex((l: string) =>
    l.includes('DialogContent') &&
    l.includes('h-[100dvh]')
)

// Find the DialogHeader within the dialog
const headerIdx = dialogContentIdx !== -1
    ? lines.findIndex((l, i) => i > dialogContentIdx && l.includes("DialogHeader"))
    : -1

const headerRegion = headerIdx !== -1
    ? lines.slice(headerIdx, headerIdx + 10).join("\n")
    : ""

describe("Units add/edit dialog — baseline contract", () => {
    it("imports DialogTitle from dialog primitive", () => {
        expect(source).toContain("DialogTitle")
    })

    it("has DialogTitle inside DialogHeader", () => {
        expect(headerRegion).toContain("DialogTitle")
    })

    it("DialogTitle shows edit mode label", () => {
        expect(headerRegion).toContain("Edit Unit")
        expect(headerRegion).toContain("Tambah Unit Baru")
    })

    it("form wiring unchanged: onSubmit calls handleSubmit", () => {
        expect(source).toContain("form.handleSubmit(onSubmit)")
    })

    it("reset clears editing state on dialog close", () => {
        expect(source).toContain("setEditingUnit(null)")
        expect(source).toContain("setViewingUnit(null)")
    })
})

describe("Units add/edit dialog — DialogDescription (F2)", () => {
    it("DialogDescription is present inside DialogHeader (after fix)", () => {
        expect(headerRegion).toContain("DialogDescription")
    })

    it("DialogDescription import exists for Dialog (after fix)", () => {
        // Check that DialogDescription is imported from the Dialog imports
        const dialogImports = source.match(/import[\s\S]*from "@\/components\/ui\/dialog"/)
        expect(dialogImports).toBeTruthy()
        expect(dialogImports![0]).toContain("DialogDescription")
    })
})

describe("Units dialogs — other dialogs not affected", () => {
    it("AlertDialog delete confirm still has its own description", () => {
        expect(source).toContain("AlertDialogDescription")
    })

    it("AlertDialog delete confirm still has its own title", () => {
        expect(source).toContain("AlertDialogTitle")
    })
})
