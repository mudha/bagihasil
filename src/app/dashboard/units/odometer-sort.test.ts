import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { compareOdometer } from "../../../lib/odometer-format"

const page = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const desktop = page.match(/\{\/\* Desktop Table View \*\/\}([\s\S]*?)<\/Table>/)?.[1] ?? ""
const header = desktop.match(/<TableHeader[\s\S]*?<\/TableHeader>/)?.[0] ?? ""
const tableHeads = header.match(/<TableHead\b[\s\S]*?<\/TableHead>/g) ?? []
const plateHeader = tableHeads.find((tableHead) => tableHead.includes("No. Polisi")) ?? ""
const odometerHeader = tableHeads.find((tableHead) => tableHead.includes("Odometer")) ?? ""

describe("compareOdometer", () => {
    it.each([
        [[6000, 13600, 36000, 0], "asc", [0, 6000, 13600, 36000]],
        [[6000, 13600, 36000, 0], "desc", [36000, 13600, 6000, 0]],
        [[null, 6000, undefined, 0, -1, 13600], "asc", [0, 6000, 13600, null, undefined, -1]],
        [[null, 6000, undefined, 0, -1, 13600], "desc", [13600, 6000, 0, null, undefined, -1]],
    ])("sorts numeric and empty values (%s, %s)", (values, order, expected) => {
        const rows = values.map((value, index) => ({ value, index }))
        const result = rows.sort((a, b) => compareOdometer(a.value, b.value, order as "asc" | "desc")).map((row) => row.value)
        expect(result).toEqual(expected)
    })

    it("keeps equal values stable through a zero comparator", () => {
        expect(compareOdometer(6000, 6000, "asc")).toBe(0)
        expect(compareOdometer(null, undefined, "desc")).toBe(0)
    })
})

describe("desktop Unit odometer sorting contract", () => {
    it("removes sorting controls from No. Polisi and makes Odometer sortable", () => {
        expect(plateHeader).toContain("No. Polisi")
        expect(plateHeader).not.toContain("<Button")
        expect(plateHeader).not.toContain("ArrowUp")
        expect(plateHeader).not.toContain("ArrowDown")
        expect(plateHeader).not.toContain("ArrowUpDown")
        expect(plateHeader).not.toContain("setSortBy")

        expect(odometerHeader).toContain("Odometer")
        expect(odometerHeader.match(/Odometer/g)).toHaveLength(2)
        expect(odometerHeader).toContain("<Button")
        expect(odometerHeader).toContain("aria-label=\"Urutkan berdasarkan Odometer\"")
        expect(odometerHeader).toContain("setSortBy(\"kilometer\")")
        expect(odometerHeader).toContain("sortBy === \"kilometer\"")
        expect(page).toContain('case "kilometer":')
        expect(page).toContain("compareOdometer(a.kilometer, b.kilometer, sortOrder)")
    })

    it("preserves filter-before-sort-before-pagination semantics and other header sorting", () => {
        expect(page.indexOf("const filteredAndSortedUnits")).toBeLessThan(page.indexOf("const paginatedUnits"))
        expect(page.indexOf("}).sort((a, b) =>")).toBeGreaterThan(page.indexOf("const filteredAndSortedUnits"))
        expect(page.indexOf("const paginatedUnits")).toBeLessThan(page.indexOf("<UnitCardMobile"))
        expect(header).toContain("sortBy === \"code\"")
        expect(header).toContain("sortBy === \"name\"")
        expect(header).toContain("sortBy === \"investor\"")
        expect(header).toContain("sortBy === \"status\"")
        expect(page).toContain('case "plateNumber":')
        expect(page).toContain('case "PLATE_ASC":')
    })
})
