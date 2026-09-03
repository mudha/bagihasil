import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const page = readFileSync("src/app/dashboard/transactions/page.tsx", "utf8")
const dialogStart = page.indexOf("<Dialog open={isOpen}")
const dialogEnd = page.indexOf("</Dialog>", dialogStart)
const dialog = page.slice(dialogStart, dialogEnd)
const unitFieldStart = dialog.indexOf('name="unitId"')
const unitField = dialog.slice(unitFieldStart, dialog.indexOf("</FormField>", unitFieldStart))
const selectSource = readFileSync("src/components/ui/select.tsx", "utf8")
const dialogSource = readFileSync("src/components/ui/dialog.tsx", "utf8")

describe("New Transaction unit Select layering contract", () => {
    it("places the Unit listbox above the Dialog overlay and content", () => {
        expect(dialogSource).toContain("z-[100]")
        expect(selectSource).toContain('portalLayer === "modal" ? "z-[110]" : "z-50"')
        expect(unitField).toContain('<SelectContent className="z-[110]">')
        expect(dialog.match(/<SelectContent className="z-\[110\]">/g)).toHaveLength(1)
    })

    it("keeps the real unit ID mapping and controlled selection wiring", () => {
        expect(unitField).toContain('name="unitId"')
        expect(unitField).toContain("<Select onValueChange={field.onChange} value={field.value}")
        expect(unitField).toContain("<SelectItem key={unit.id} value={unit.id}>")
        expect(unitField).toContain("{unit.name} - {unit.plateNumber}")
        expect(unitField).toContain("availableUnits.map")
    })

    it("keeps the transaction dialog open/reset lifecycle and submit mapping unchanged", () => {
        expect(dialog).toContain("onOpenChange={(open) => {")
        expect(dialog).toContain("if (!open) {")
        expect(dialog).toContain("form.reset()")
        expect(page).toContain("const payload = {")
        expect(page).toContain("proofs: proofs.length > 0 ? proofs : undefined")
        expect(page).toContain("buyProofImageUrl:")
        expect(page).toContain("method,")
        expect(page).toContain("body: JSON.stringify(payload)")
    })

    it("does not change the page-level filter Select or the existing Unit dialog fix", () => {
        const afterDialog = page.slice(dialogEnd)
        expect(afterDialog).toContain("<SelectContent>")
        const unitsPage = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
        expect(unitsPage).toContain('SelectContent className="z-[110]"')
    })
})
