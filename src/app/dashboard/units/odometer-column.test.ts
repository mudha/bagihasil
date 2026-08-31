import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { formatOdometer } from "../../../lib/odometer-format"

const page = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const desktop = page.match(/\{\/\* Desktop Table View \*\/\}([\s\S]*?)<\/Table>/)?.[1] ?? ""
const header = desktop.match(/<TableHeader[\s\S]*?<\/TableHeader>/)?.[0] ?? ""
const body = desktop.match(/<TableBody>([\s\S]*?)<\/TableBody>/)?.[1] ?? ""
const mobile = page.match(/\{\/\* Mobile Card View \*\/\}([\s\S]*?)\{\/\* Desktop Table View \*\/\}/)?.[1] ?? ""

describe("formatOdometer", () => {
    it.each([
        [12345, "12.345 km"],
        [0, "0 km"],
        [null, "—"],
        [undefined, "—"],
        ["12345", "—"],
        [12.5, "—"],
        [-1, "—"],
        [Number.NaN, "—"],
        [Number.POSITIVE_INFINITY, "—"],
        [Number.MAX_SAFE_INTEGER + 1, "—"],
    ])("formats %s safely", (value, expected) => {
        expect(formatOdometer(value)).toBe(expected)
    })
})

describe("desktop Unit table Odometer column", () => {
    it("places exactly one Odometer header and row cell after No. Polisi and before Pemilik", () => {
        const headerPlate = header.indexOf("No. Polisi")
        const headerOdometer = header.indexOf("Odometer")
        const headerOwner = header.indexOf("Pemilik")
        expect(headerPlate).toBeGreaterThanOrEqual(0)
        expect(headerOdometer).toBeGreaterThan(headerPlate)
        expect(headerOwner).toBeGreaterThan(headerOdometer)
        expect(header.match(/>Odometer<\/TableHead>/g)).toHaveLength(1)

        const bodyPlate = body.indexOf("unit.plateNumber")
        const bodyOdometer = body.indexOf("title={formatOdometer(unit.kilometer)}")
        const bodyOwner = body.indexOf("getInvestorInitials(unit.investor.name)")
        expect(bodyPlate).toBeGreaterThanOrEqual(0)
        expect(bodyOdometer).toBeGreaterThan(bodyPlate)
        expect(bodyOwner).toBeGreaterThan(bodyOdometer)
        expect(body.match(/title=\{formatOdometer\(unit\.kilometer\)\}/g)).toHaveLength(1)
        expect(header.match(/<TableHead\b/g)).toHaveLength(10)
        expect(body.match(/<TableCell\b/g)).toHaveLength(10)
    })

    it("binds the formatted value to the same Unit row without changing mobile/detail wiring", () => {
        expect(desktop).toContain("formatOdometer(unit.kilometer)")
        expect(desktop).toContain("whitespace-nowrap")
        expect(desktop).toContain("title={formatOdometer(unit.kilometer)}")
        expect(page).toContain('import { UnitCardMobile } from "@/components/units/UnitCardMobile"')
        expect(mobile).toContain("unit={unit}")
        expect(mobile).toContain("onDetail=")
        expect(mobile).toContain("onEdit=")
        expect(mobile).toContain("onDelete=")
        expect(page).toContain('import { AdminUnitDetailDialog } from "@/components/units/AdminUnitDetailDialog"')
        expect(page).toContain("unit={viewingUnit}")
        expect(page).toContain("min-w-[1260px]")
    })
})
