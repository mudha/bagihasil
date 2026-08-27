import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

const pageSource = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const componentSource = readFileSync("src/components/units/UnitCardMobile.tsx", "utf8")

const mobileBlock = pageSource.match(
    /\{\/\* Mobile Card View \*\/\}([\s\S]*?)\{\/\* Desktop Table View \*\/\}/,
)?.[1] ?? ""

describe("UnitCardMobile — page wiring", () => {
    it("is imported from the correct path", () => {
        expect(pageSource).toContain('import { UnitCardMobile } from "@/components/units/UnitCardMobile"')
    })

    it("is used inside the Mobile Card View block with required props", () => {
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

    it("does not contain old inline card JSX in the mobile block", () => {
        expect(mobileBlock).not.toContain("<ImageHoverPreview")
        expect(mobileBlock).not.toContain('<Image src={unit.imageUrl}')
        expect(mobileBlock).not.toContain('<Eye className="mr-1.5 h-4 w-4" /> Detail')
        expect(mobileBlock).not.toContain("<DropdownMenu>")
    })

    it("retains the empty state inside the mobile block", () => {
        expect(mobileBlock).toContain("Tidak ada unit yang cocok.")
        expect(mobileBlock).toContain("Belum ada data unit.")
    })
})

describe("UnitCardMobile — component contract", () => {
    it("exports a named function", () => {
        expect(componentSource).toContain("export function UnitCardMobile")
    })

    it("defines a typed props interface", () => {
        expect(componentSource).toContain("export interface UnitCardMobileProps")
        expect(componentSource).toContain("unit: UnitCardUnit")
        expect(componentSource).toContain("duplicateInfo: DuplicateInfo")
        expect(componentSource).toContain("isViewer: boolean")
        expect(componentSource).toContain("investorTone: InvestorTone")
        expect(componentSource).toContain("onDetail: () => void")
        expect(componentSource).toContain("onEdit: () => void")
        expect(componentSource).toContain("onDelete: () => void")
    })

    it("imports getTaxStatus from the shared helper", () => {
        expect(componentSource).toContain('import { getTaxStatus } from "@/lib/unit-tax-status"')
        expect(componentSource).not.toContain("@/app/dashboard/units/page")
        expect(componentSource).not.toContain("getDuplicateInfo")
    })

    it("renders the Eye Detail button before the Aksi DropdownMenu", () => {
        const detailIdx = componentSource.indexOf('onClick={onDetail}')
        const aksiIdx = componentSource.indexOf("<DropdownMenu>")
        expect(detailIdx).toBeGreaterThan(-1)
        expect(aksiIdx).toBeGreaterThan(detailIdx)
    })

    it("uses onEdit and onDelete callbacks in menu items", () => {
        expect(componentSource).toContain("onSelect={onEdit}")
        expect(componentSource).toContain("onSelect={onDelete}")
    })

    it("hides Aksi when isViewer is true", () => {
        expect(componentSource).toContain("{!isViewer && (")
    })

    it("does not create a navigation link to /dashboard/units/[id]", () => {
        // Exclude import lines which naturally contain "/dashboard/units/page"
        const codeLines = componentSource.split("\n").filter(l => !l.startsWith("import "))
        const codeBody = codeLines.join("\n")
        expect(codeBody).not.toContain("/dashboard/units/")
    })
})
