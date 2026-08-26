import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

const unitsPage = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const mobileBlock = unitsPage.match(
    /\{\/\* Mobile Card View \*\/\}([\s\S]*?)\{\/\* Desktop Table View \*\/\}/,
)?.[1] ?? ""

describe("unit list mobile detail affordance", () => {
    it("places one semantic Detail button before the separate Aksi control", () => {
        expect(mobileBlock).toContain("<Eye className=\"mr-1.5 h-4 w-4\" /> Detail")
        expect(mobileBlock.match(/<Eye className=/g)).toHaveLength(1)
        expect(mobileBlock.indexOf("onClick={() => setViewingUnit(unit)}")).toBeGreaterThan(-1)
        expect(mobileBlock.indexOf("onClick={() => setViewingUnit(unit)}")).toBeLessThan(
            mobileBlock.indexOf("<DropdownMenu>", mobileBlock.indexOf("onClick={() => setViewingUnit(unit)}")),
        )
    })

    it("keeps Detail and Aksi as separate controls without a unit route link", () => {
        expect(mobileBlock).toContain("<Button")
        expect(mobileBlock).toContain("{!isViewer && (")
        expect(mobileBlock).not.toMatch(/Link href={`\/dashboard\/units\/\$\{/)
        expect(unitsPage).not.toContain("src/app/dashboard/units/[id]")
    })

    it("retains the existing unit viewer dialog wiring", () => {
        expect(unitsPage).toContain('import { AdminUnitDetailDialog } from "@/components/units/AdminUnitDetailDialog"')
        expect(unitsPage).toContain("open={!!viewingUnit && !isOpen}")
        expect(unitsPage).toContain("unit={viewingUnit}")
    })
})
