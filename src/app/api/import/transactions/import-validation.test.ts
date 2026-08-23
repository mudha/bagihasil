import { describe, expect, it } from "vitest"
import { parseImportNumber, validateImportProfitShares } from "./import-validation"

describe("import financial input validation", () => {
    it.each(["NaN", "Infinity", "-Infinity", "", "   ", "123abc"])('rejects malformed/non-finite value %s', (value) => {
        expect(() => parseImportNumber(value, "sellPrice", { required: true, min: 0 })).toThrow()
    })

    it.each([-1, 101])("rejects out-of-range percentage %s", (value) => {
        expect(() => parseImportNumber(value, "percentage", { min: 0, max: 100 })).toThrow()
    })

    it("rejects nisbah totals below or above 100", () => {
        expect(() => validateImportProfitShares(40, 40)).toThrow("100%")
        expect(() => validateImportProfitShares(70, 70)).toThrow("100%")
    })

    it("accepts valid boundary nisbah values", () => {
        expect(() => validateImportProfitShares(60, 40)).not.toThrow()
        expect(() => validateImportProfitShares(0, 100)).not.toThrow()
        expect(() => validateImportProfitShares(100, 0)).not.toThrow()
    })

    it("accepts strict decimal CSV values without prefix parsing", () => {
        expect(parseImportNumber("33.3", "percentage", { min: 0, max: 100 })).toBe(33.3)
        expect(() => parseImportNumber("33.3abc", "percentage", { min: 0, max: 100 })).toThrow()
    })
})
