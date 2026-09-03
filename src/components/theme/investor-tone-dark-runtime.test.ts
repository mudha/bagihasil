import { describe, expect, it } from "vitest"
import { getInvestorTone, getInvestorToneIndex, getInvestorToneTheme } from "../../lib/investor-tone"

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function parseRgba(value: string): [number, number, number, number] {
  const match = value.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/)
  if (!match) throw new Error(`Invalid rgba: ${value}`)
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
}

function composite(foreground: [number, number, number, number], background: [number, number, number]): [number, number, number] {
  const [r, g, b, alpha] = foreground
  return [r * alpha + background[0] * (1 - alpha), g * alpha + background[1] * (1 - alpha), b * alpha + background[2] * (1 - alpha)]
}

function luminance(rgb: [number, number, number]): number {
  const channels = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

function keysForEveryTone(): string[] {
  const keys = new Map<number, string>()
  for (let index = 0; index < 2000 && keys.size < 8; index += 1) {
    const key = `synthetic-investor-${index}`
    keys.set(getInvestorToneIndex(key), key)
  }
  return [...keys.entries()].sort(([a], [b]) => a - b).map(([, key]) => key)
}

describe("investor tone runtime invariants", () => {
  const keys = keysForEveryTone()

  it("reaches all eight deterministic tone indices", () => {
    expect(keys).toHaveLength(8)
    expect(keys.map(getInvestorToneIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it("preserves exact Light objects and named overrides", () => {
    for (const key of [...keys, "wahyu prasetyo adi", "achmad firmansyah", "wiwin yuli widiastuti", null]) {
      expect(getInvestorToneTheme(key, false)).toBe(getInvestorTone(key))
    }
    expect(getInvestorTone("  WAHYU   PRASETYO ADI ").accent).toBe("#2563eb")
    expect(getInvestorTone("achmad firmansyah").accent).toBe("#f59e0b")
    expect(getInvestorTone("wiwin yuli widiastuti").accent).toBe("#db2777")
  })

  it("keeps Dark assignment stable for normalized keys", () => {
    for (const key of keys) {
      expect(getInvestorToneIndex(`  ${key.toUpperCase()}  `)).toBe(getInvestorToneIndex(key))
      expect(getInvestorToneTheme(key, true)).toEqual(getInvestorToneTheme(key, true))
    }
  })

  it("meets AA for every alpha-composited Dark chip on actual card and page parents", () => {
    const parents = [hexToRgb("#10211F"), hexToRgb("#0B1514")]
    for (const key of keys) {
      const tone = getInvestorToneTheme(key, true)
      for (const parent of parents) {
        const chip = composite(parseRgba(tone.chipBg), parent)
        expect(contrast(hexToRgb(tone.chipText), chip)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
