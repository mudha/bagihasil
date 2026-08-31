import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { formatOdometer } from "../../../lib/odometer-format"

const page = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const desktop = page.match(/\{\/\* Desktop Table View \*\/\}([\s\S]*?)<\/Table>/)?.[1] ?? ""

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
    it("places Odometer after No. Polisi and before Pemilik", () => {
        const plate = desktop.indexOf("No. Polisi")
        const odometer = desktop.indexOf("Odometer")
        const owner = desktop.indexOf("Pemilik")
        expect(plate).toBeGreaterThanOrEqual(0)
        expect(odometer).toBeGreaterThan(plate)
        expect(owner).toBeGreaterThan(odometer)
    })

    it("binds the formatted value to the same Unit row without changing mobile/detail wiring", () => {
        expect(desktop).toContain("formatOdometer(unit.kilometer)")
        expect(desktop).toContain("whitespace-nowrap")
        expect(desktop).toContain("title={formatOdometer(unit.kilometer)}")
        expect(page).toContain('import { UnitCardMobile } from "@/components/units/UnitCardMobile"')
        expect(page).toContain('import { AdminUnitDetailDialog } from "@/components/units/AdminUnitDetailDialog"')
        expect(page).toContain("unit={viewingUnit}")
        expect(page).toContain("min-w-[1260px]")
    })
})
