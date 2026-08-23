import { describe, expect, it } from "vitest"
import { formatRupiah, formatRupiahOrNull } from "./rupiah-format"

describe("formatRupiah", () => {
    it("formats zero", () => {
        expect(formatRupiah("0")).toBe("Rp0")
    })

    it("formats positive values with dot separators", () => {
        expect(formatRupiah("5000000")).toBe("Rp5.000.000")
    })

    it("formats negative values with minus sign", () => {
        expect(formatRupiah("-500000")).toBe("-Rp500.000")
    })

    it("handles values above Number.MAX_SAFE_INTEGER exactly", () => {
        expect(formatRupiah("9007199254740993")).toBe("Rp9.007.199.254.740.993")
    })

    it("handles 18-digit Decimal(18,0) capacity values", () => {
        expect(formatRupiah("999999999999999999")).toBe("Rp999.999.999.999.999.999")
    })

    it("formats one rupiah", () => {
        expect(formatRupiah("1")).toBe("Rp1")
    })

    it("formats nine hundred ninety-nine", () => {
        expect(formatRupiah("999")).toBe("Rp999")
    })

    it("formats one thousand", () => {
        expect(formatRupiah("1000")).toBe("Rp1.000")
    })
})

describe("formatRupiahOrNull", () => {
    it("returns Belum diatur for null", () => {
        expect(formatRupiahOrNull(null)).toBe("Belum diatur")
    })

    it("formats value as rupiah", () => {
        expect(formatRupiahOrNull("5000000")).toBe("Rp5.000.000")
    })
})
