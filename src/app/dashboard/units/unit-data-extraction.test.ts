/**
 * Characterization tests for unit-data extraction.
 *
 * After extraction, these tests verify:
 * - the extracted module contains BRANDS, MODELS, COLORS, YEARS, getDuplicateInfo
 * - the page imports from the extracted module
 * - constants and helpers are correctly referenced in the page
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

const page = readFileSync(
    `${process.cwd()}/src/app/dashboard/units/page.tsx`, "utf-8"
)
const mod = readFileSync(
    `${process.cwd()}/src/components/units/unit-data.ts`, "utf-8"
)

describe("Extracted unit-data module", () => {
    it("exports VEHICLE_TYPES, BRANDS, MODELS, COLORS, YEARS, getDuplicateInfo", () => {
        expect(mod).toContain("export const VEHICLE_TYPES")
        expect(mod).toContain("export const BRANDS")
        expect(mod).toContain("export const MODELS")
        expect(mod).toContain("export const COLORS")
        expect(mod).toContain("export const YEARS")
        expect(mod).toContain("export const getDuplicateInfo")
    })

    it("exports UnitLike interface", () => {
        expect(mod).toContain("export interface UnitLike")
    })

    it("BRANDS has Mobil and Motor keys", () => {
        expect(mod).toContain("Mobil:")
        expect(mod).toContain("Motor:")
    })

    it("BRANDS.Mobil contains Toyota and Lainnya", () => {
        const mobilIdx = mod.indexOf("Mobil:")
        const motorIdx = mod.indexOf("Motor:")
        const mobilSection = mod.slice(mobilIdx, motorIdx)
        expect(mobilSection).toContain("Toyota")
        expect(mobilSection).toContain("Lainnya")
    })

    it("MODELS.Motor.Yamaha contains XMAX and NMAX", () => {
        const yamahaIdx = mod.indexOf('Yamaha: ["NMAX"')
        expect(yamahaIdx).toBeGreaterThan(-1)
        const section = mod.slice(yamahaIdx, yamahaIdx + 200)
        expect(section).toContain("XMAX")
        expect(section).toContain("NMAX")
    })

    it("COLORS has 12 entries ending with Lainnya", () => {
        expect(mod).toContain('"Hitam"')
        expect(mod).toContain('"Lainnya"')
    })

    it("YEARS is dynamically generated", () => {
        expect(mod).toContain("Array.from")
        expect(mod).toContain("new Date().getFullYear()")
    })

    it("getDuplicateInfo handles empty plateNumber", () => {
        expect(mod).toContain("!currentUnit.plateNumber || !currentUnit.plateNumber.trim()")
        expect(mod).toContain("isDuplicate: false, purchaseNumber: 1, totalDuplicates: 1, isBuyback: false")
    })

    it("getDuplicateInfo sorts by createdAt", () => {
        expect(mod).toContain("new Date(a.createdAt || 0).getTime()")
    })

    it("getDuplicateInfo returns correct shape", () => {
        expect(mod).toContain("isDuplicate: totalDuplicates > 1")
        expect(mod).toContain("const isBuyback = purchaseNumber > 1")
    })

    it("module has no side effects, hooks, or network", () => {
        expect(mod).not.toContain("useState")
        expect(mod).not.toContain("useEffect")
        expect(mod).not.toContain("fetch(")
        expect(mod).not.toContain("import \"use client\"")
    })
})

describe("Page imports from extracted module", () => {
    it("imports VEHICLE_TYPES, BRANDS, MODELS, COLORS, YEARS, getDuplicateInfo from unit-data", () => {
        expect(page).toContain('import { VEHICLE_TYPES, BRANDS, MODELS, COLORS, YEARS, getDuplicateInfo } from "@/components/units/unit-data"')
    })

    it("no local declarations of BRANDS, MODELS, COLORS, YEARS, getDuplicateInfo remain", () => {
        // After extraction, the page should not have these local declarations
        const lines = page.split("\n")
        const localDeclLines = lines.filter(l =>
            l.match(/^const (BRANDS|MODELS|COLORS|YEARS|getDuplicateInfo)\s*=/)
        )
        expect(localDeclLines).toHaveLength(0)
    })

    it("constants are still used in STNK scan flow", () => {
        expect(page).toContain("BRANDS[data.vehicleType]")
        expect(page).toContain("MODELS[data.vehicleType]")
        expect(page).toContain("COLORS.find")
    })

    it("getDuplicateInfo is still used in mobile card and desktop table", () => {
        expect(page).toContain("getDuplicateInfo(units, unit)")
    })

    it("@ts-expect-error is no longer needed for BRANDS indexing", () => {
        expect(page).not.toContain("@ts-expect-error")
    })

    it("BRANDS type annotation removed from page (now imported)", () => {
        expect(page).not.toMatch(/const BRANDS\s*[=:]/)
    })
})
