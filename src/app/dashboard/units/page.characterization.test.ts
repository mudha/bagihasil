import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

const unitsPage = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const mobileBlock = unitsPage.match(
    /\{\/\* Mobile Card View \*\/\}([\s\S]*?)\{\/\* Desktop Table View \*\/\}/,
)?.[1] ?? ""

describe("unit list mobile detail affordance", () => {
    it("delegates mobile card rendering to UnitCardMobile with required props", () => {
        expect(mobileBlock).toContain("<UnitCardMobile")
        expect(mobileBlock).toContain("key={unit.id}")
        expect(mobileBlock).toContain("unit={unit}")
        expect(mobileBlock).toContain("duplicateInfo={getDuplicateInfo(units, unit)}")
        expect(mobileBlock).toContain("isViewer={isViewer}")
        expect(mobileBlock).toContain("investorTone={investorTone}")
        expect(mobileBlock).toContain("onDetail=")
        expect(mobileBlock).toContain("onEdit=")
        expect(mobileBlock).toContain("onDelete=")
    })

    it("does not contain inline Detail/Aksi JSX in the mobile block", () => {
        expect(mobileBlock).not.toContain("<Eye className=\"mr-1.5 h-4 w-4\" /> Detail")
        expect(mobileBlock).not.toContain("<Button")
        expect(mobileBlock).not.toContain("<DropdownMenu>")
        expect(mobileBlock).not.toContain("{!isViewer && (")
    })

    it("retains the empty state and no route link", () => {
        expect(mobileBlock).toContain("Tidak ada unit yang cocok.")
        expect(mobileBlock).toContain("Belum ada data unit.")
        expect(mobileBlock).not.toMatch(/Link href={`\/dashboard\/units\/\$\{/)
        expect(unitsPage).not.toContain("src/app/dashboard/units/[id]")
    })

    it("retains the existing unit viewer dialog wiring", () => {
        expect(unitsPage).toContain('import { AdminUnitDetailDialog } from "@/components/units/AdminUnitDetailDialog"')
        expect(unitsPage).toContain("open={!!viewingUnit && !isOpen}")
        expect(unitsPage).toContain("unit={viewingUnit}")
    })
})
