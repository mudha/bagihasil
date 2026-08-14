import { describe, expect, it } from "vitest"
import { getInvestorTone } from "./investor-tone"

const tones = [
    { accent: "#2563eb", rowBg: "#eff6ff", chipBg: "#dbeafe", chipText: "#1e3a8a", stripe: "linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)" },
    { accent: "#16a34a", rowBg: "#f0fdf4", chipBg: "#dcfce7", chipText: "#14532d", stripe: "linear-gradient(90deg, #16a34a 0%, #84cc16 100%)" },
    { accent: "#f59e0b", rowBg: "#fffbeb", chipBg: "#fef3c7", chipText: "#78350f", stripe: "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)" },
    { accent: "#dc2626", rowBg: "#fef2f2", chipBg: "#fee2e2", chipText: "#7f1d1d", stripe: "linear-gradient(90deg, #dc2626 0%, #fb7185 100%)" },
    { accent: "#4f46e5", rowBg: "#eef2ff", chipBg: "#e0e7ff", chipText: "#312e81", stripe: "linear-gradient(90deg, #4f46e5 0%, #818cf8 100%)" },
    { accent: "#db2777", rowBg: "#fdf2f8", chipBg: "#fce7f3", chipText: "#831843", stripe: "linear-gradient(90deg, #db2777 0%, #f472b6 100%)" },
    { accent: "#0f766e", rowBg: "#f0fdfa", chipBg: "#ccfbf1", chipText: "#134e4a", stripe: "linear-gradient(90deg, #0f766e 0%, #2dd4bf 100%)" },
    { accent: "#475569", rowBg: "#f8fafc", chipBg: "#e2e8f0", chipText: "#0f172a", stripe: "linear-gradient(90deg, #475569 0%, #94a3b8 100%)" },
] as const

describe("getInvestorTone", () => {
    it.each([
        ["Wahyu Prasetyo Adi", tones[0]],
        ["Achmad Firmansyah", tones[2]],
        ["Wiwin Yuli Widiastuti", tones[5]],
    ])("preserves the override for %s", (name, expected) => {
        expect(getInvestorTone(name)).toEqual(expected)
    })

    it("normalizes case and repeated surrounding whitespace", () => {
        expect(getInvestorTone("  WAHYU   PRASETYO ADI  ")).toEqual(tones[0])
    })

    it.each([undefined, null, "", "   "])("uses the unknown-investor fallback for %j", (value) => {
        expect(getInvestorTone(value)).toEqual(getInvestorTone("unknown-investor"))
    })

    it.each([
        ["investor bucket 6", tones[0]],
        ["investor bucket 7", tones[1]],
        ["investor bucket 0", tones[2]],
        ["investor bucket 1", tones[3]],
        ["investor bucket 2", tones[4]],
        ["investor bucket 3", tones[5]],
        ["investor bucket 4", tones[6]],
        ["investor bucket 5", tones[7]],
    ])("preserves the complete palette for hash fixture %s", (name, expected) => {
        expect(getInvestorTone(name)).toEqual(expected)
        expect(getInvestorTone(name)).toEqual(getInvestorTone(name))
    })
})
