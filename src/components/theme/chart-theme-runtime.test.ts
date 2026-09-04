import { describe, expect, it } from "vitest"
import { chartBarAltFill, chartBarFill, chartInvestorIncomeFill, chartInvestorRevenueFill, chartInvestorSalesFill, chartInvestorShareFill, chartManagerShareFill, chartProfitFill, chartUnitsSoldFill, getChartColors } from "../../lib/chart-theme"

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
function luminance(color: [number, number, number]) {
  return color.map((channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4 })
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}
function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

describe("chart theme runtime", () => {
  it("selects exact deterministic Light and Dark palettes", () => {
    expect(getChartColors(false)).toMatchObject({ bar: "#0d9488", barAlt: "#22c55e", grid: "#e2e8f0", axis: "#64748b", tooltipLabel: "#0f172a", tooltipBackground: "#ffffff", tooltipBorder: "#e2e8f0", legendText: "#0f172a" })
    expect(getChartColors(true)).toMatchObject({ bar: "#2dd4bf", barAlt: "#4ade80", grid: "#1e3a37", axis: "#94a3b8", tooltipLabel: "#f1f5f9", tooltipBackground: "#10211f", tooltipBorder: "#29413e", legendText: "#f1f5f9" })
    expect(getChartColors(false).pie).toHaveLength(6)
    expect(getChartColors(true).pie).toHaveLength(6)
  })

  it("keeps helper fills aligned with the corresponding palette", () => {
    expect(chartBarFill(false)).toBe(getChartColors(false).bar)
    expect(chartBarFill(true)).toBe(getChartColors(true).bar)
    expect(chartBarAltFill(false)).toBe(getChartColors(false).barAlt)
    expect(chartBarAltFill(true)).toBe(getChartColors(true).barAlt)
    expect(chartProfitFill(true)).toBe("#4ade80")
    expect(chartInvestorShareFill(true)).toBe("#a3e635")
    expect(chartManagerShareFill(true)).toBe("#38bdf8")
    expect(chartUnitsSoldFill(true)).toBe("#fbbf24")
    expect(chartInvestorIncomeFill(false)).toBe("#10b981")
    expect(chartInvestorRevenueFill(false)).toBe("#0f9b8e")
    expect(chartInvestorSalesFill(false)).toBe("#0ea5e9")
    expect(chartInvestorIncomeFill(true)).toBe("#34d399")
    expect(chartInvestorRevenueFill(true)).toBe("#2dd4bf")
    expect(chartInvestorSalesFill(true)).toBe("#38bdf8")
  })

  it("keeps axis, tooltip, and legend text AA-readable on actual parents", () => {
    const light = getChartColors(false)
    const dark = getChartColors(true)
    expect(contrast(light.axis, "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light.tooltipLabel, "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light.legendText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark.axis, "#10211F")).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark.tooltipLabel, "#10211F")).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark.legendText, "#10211F")).toBeGreaterThanOrEqual(4.5)
  })
})
