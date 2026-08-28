/**
 * Source-characterization tests for Calculator page.
 *
 * Locks down the exact formula contract, input fields, defaults,
 * formatting, layout structure, and UI labels of the existing
 * Calculator implementation.
 *
 * These are structural/source-characterization tests — they prove
 * what the source contains, not runtime DOM interaction.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

const pagePath = resolve(__dirname, "page.tsx")
const source = readFileSync(pagePath, "utf-8")

// ── Parity Matrix: exact formula contract ────────────────────────
//
// Inputs:
//   buyPrice (Harga Beli Unit)        — number, default 0
//   repairCost (Estimasi Perbaikan)    — number, default 0
//   otherCost (Biaya Lainnya)          — number, default 0
//   targetSellPrice (Target Harga Jual)— number, default 0
//   investorSharePct (Bagi Hasil)      — slider 0–100, step 1, default 40%
//
// Derived (all recalculated on every input change via useEffect):
//   totalCapital = buyPrice + repairCost + otherCost
//   grossProfit  = targetSellPrice − totalCapital
//   roi          = totalCapital > 0 ? (grossProfit / totalCapital) × 100 : 0
//   investorShare = grossProfit > 0 ? grossProfit × (investorSharePct / 100) : 0
//   managerShare  = grossProfit > 0 ? grossProfit × ((100 − investorSharePct) / 100) : 0
//   netProfit     = grossProfit (alias, always equal)
//
// Rounding:
//   roi.toFixed(1) — one decimal for percentage display
//   formatCurrency uses Intl.NumberFormat("id-ID", IDR, 0 digits)
//
// Edge cases:
//   • All zeros: totalCapital=0, grossProfit=0, roi=0, shares=0
//   • Loss: grossProfit < 0 → investorShare=0, managerShare=0, warning shown
//   • Break-even: grossProfit=0 → shares=0
//   • Negative investorSharePct (slider won't allow, but formula handles)
//   • Large values (>Rp100M): no truncation, full IDR format

describe("Calculator formula parity", () => {
  it("uses correct totalCapital formula: buyPrice + repairCost + otherCost", () => {
    expect(source).toContain("const totalCapital = buyPrice + repairCost + otherCost")
  })

  it("uses correct grossProfit formula: targetSellPrice − totalCapital", () => {
    expect(source).toContain("const grossProfit = targetSellPrice - totalCapital")
  })

  it("uses correct roi formula with division-by-zero guard", () => {
    expect(source).toContain("const roi = totalCapital > 0 ? (grossProfit / totalCapital) * 100 : 0")
  })

  it("uses correct investorShare formula: grossProfit × (pct/100) with zero-floor", () => {
    expect(source).toContain("const investorShare = grossProfit > 0 ? grossProfit * (investorSharePct / 100) : 0")
  })

  it("uses correct managerShare formula: grossProfit × ((100−pct)/100) with zero-floor", () => {
    expect(source).toContain("const managerShare = grossProfit > 0 ? grossProfit * ((100 - investorSharePct) / 100) : 0")
  })

  it("aliases netProfit to grossProfit", () => {
    expect(source).toContain("netProfit: grossProfit")
  })

  it("displays ROI with one decimal place", () => {
    expect(source).toContain("results.roi.toFixed(1)")
  })

  it("renders loss warning when grossProfit is negative", () => {
    expect(source).toContain("results.grossProfit < 0")
    expect(source).toContain("Peringatan:")
    expect(source).toContain("Math.abs(results.grossProfit)")
  })

  it("profit colors change by sign: emerald for positive, red for negative", () => {
    // TrendingUp icon color
    expect(source).toContain('results.grossProfit >= 0 ? "h-4 w-4 text-emerald-500" : "h-4 w-4 text-red-500"')
    // Profit value text color
    expect(source).toContain('results.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"')
    // ROI text color
    expect(source).toContain('results.roi >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"')
  })
})

describe("Calculator input fields", () => {
  it("has 5 input state variables with correct defaults", () => {
    expect(source).toContain("useState<number>(0)")
    // buyPrice, repairCost, otherCost, targetSellPrice all default 0
    expect(source).toContain("const [buyPrice, setBuyPrice] = useState<number>(0)")
    expect(source).toContain("const [repairCost, setRepairCost] = useState<number>(0)")
    expect(source).toContain("const [otherCost, setOtherCost] = useState<number>(0)")
    expect(source).toContain("const [targetSellPrice, setTargetSellPrice] = useState<number>(0)")
    expect(source).toContain("const [investorSharePct, setInvestorSharePct] = useState<number>(40)")
  })

  it("uses number input type for price/cost fields", () => {
    expect(source).toContain('type="number"')
  })

  it("parses input values with parseFloat fallback to 0", () => {
    expect(source).toContain("parseFloat(e.target.value) || 0")
  })

  it("renders label 'Harga Beli Unit' for buyPrice", () => {
    expect(source).toContain("Harga Beli Unit")
  })

  it("renders label 'Estimasi Perbaikan' for repairCost", () => {
    expect(source).toContain("Estimasi Perbaikan")
  })

  it("renders label 'Biaya Lainnya' for otherCost", () => {
    expect(source).toContain("Biaya Lainnya")
  })

  it("renders label 'Target Harga Jual' for targetSellPrice", () => {
    expect(source).toContain("Target Harga Jual")
  })

  it("renders label 'Bagi Hasil Pemodal' for slider", () => {
    expect(source).toContain("Bagi Hasil Pemodal")
  })

  it("slider has min=0, max=100, step=1", () => {
    expect(source).toContain("min={0}")
    expect(source).toContain("max={100}")
    expect(source).toContain("step={1}")
  })

  it("displays current slider percentage", () => {
    expect(source).toContain("{investorSharePct}%")
  })

  it("shows manager share percentage below slider", () => {
    expect(source).toContain("Pengelola:")
    expect(source).toContain("{100 - investorSharePct}%")
  })

  it("input values are empty when 0 via conditional (buyPrice || '')", () => {
    expect(source).toContain("buyPrice || ''")
    expect(source).toContain("repairCost || ''")
    expect(source).toContain("otherCost || ''")
    expect(source).toContain("targetSellPrice || ''")
  })
})

describe("Calculator outputs and labels", () => {
  it("displays Total Modal as first result card", () => {
    expect(source).toContain("Total Modal")
    expect(source).toContain("results.totalCapital")
    expect(source).toContain("Beli + Perbaikan + Lainnya")
  })

  it("displays Estimasi Profit Bersih as second result card", () => {
    expect(source).toContain("Estimasi Profit Bersih")
    expect(source).toContain("results.grossProfit")
  })

  it("displays ROI percentage inside profit card", () => {
    expect(source).toContain("ROI:")
  })

  it("displays Estimasi Pembagian Profit section", () => {
    expect(source).toContain("Estimasi Pembagian Profit")
  })

  it("displays investor share with percentage label", () => {
    expect(source).toContain("Bagian Pemodal")
    expect(source).toContain("results.investorShare")
  })

  it("displays manager share with percentage label", () => {
    expect(source).toContain("Bagian Pengelola")
    expect(source).toContain("results.managerShare")
  })
})

describe("Calculator reset behavior", () => {
  it("reset function sets all price inputs to 0 and slider to 40", () => {
    expect(source).toContain("const resetCalculator = () => {")
    expect(source).toContain("setBuyPrice(0)")
    expect(source).toContain("setRepairCost(0)")
    expect(source).toContain("setOtherCost(0)")
    expect(source).toContain("setTargetSellPrice(0)")
    expect(source).toContain("setInvestorSharePct(40)")
  })

  it("reset button labeled 'Reset Kalkulator'", () => {
    expect(source).toContain("Reset Kalkulator")
  })

  it("reset button uses outline variant to avoid accidental click", () => {
    expect(source).toContain('variant="outline"')
  })
})

describe("Calculator currency formatting", () => {
  it("uses Intl.NumberFormat with id-ID locale and IDR currency", () => {
    expect(source).toContain('new Intl.NumberFormat("id-ID"')
    expect(source).toContain('currency: "IDR"')
  })

  it("formats with 0 minimum and 0 maximum fraction digits", () => {
    expect(source).toContain("minimumFractionDigits: 0")
    expect(source).toContain("maximumFractionDigits: 0")
  })

  it("has a local formatCurrency function (not imported)", () => {
    expect(source).toContain("const formatCurrency = (value: number) => {")
  })
})

describe("Calculator layout structure", () => {
  it("page title is 'Kalkulator Estimasi Profit'", () => {
    expect(source).toContain("Kalkulator Estimasi Profit")
  })

  it("uses 7-column grid for desktop layout (3 input + 4 result)", () => {
    expect(source).toContain('grid-cols-7')
    expect(source).toContain('lg:col-span-3')
    expect(source).toContain('lg:col-span-4')
  })

  it("input section has Calculator icon with muted color", () => {
    expect(source).toContain("Calculator className=\"h-5 w-5 text-[var(--mudha-text-muted)]\"")
  })

  it("input section title is 'Input Simulasi'", () => {
    expect(source).toContain("Input Simulasi")
  })

  it("result cards use TrendingUp and DollarSign icons", () => {
    expect(source).toContain("TrendingUp")
    expect(source).toContain("DollarSign")
  })

  it("result section uses PieChart icon for profit distribution", () => {
    expect(source).toContain("PieChart")
  })

  it("repairCost and otherCost are side by side in 2-column grid", () => {
    expect(source).toContain('grid-cols-1 gap-4 sm:grid-cols-2')
  })

  it("target sell price is separated with border-top", () => {
    expect(source).toContain("border-t")
  })
})

describe("Calculator page contract", () => {
  it("is a client component", () => {
    expect(source).toContain('"use client"')
  })

  it("has no API calls (local-only calculator)", () => {
    expect(source).not.toMatch(/fetch\(/)
    expect(source).not.toMatch(/\/api\//)
  })

  it("has no exports other than default", () => {
    const lines = source.split("\n")
    const exportLines = lines.filter(l => l.match(/^export\s/) && !l.match(/^export\s+default/))
    expect(exportLines).toHaveLength(0)
  })

  it("recalculates via useEffect dependency array", () => {
    expect(source).toContain("}, [buyPrice, repairCost, otherCost, targetSellPrice, investorSharePct])")
  })

  it("has no form submission handler (not a form, just inputs)", () => {
    expect(source).not.toContain("onSubmit")
  })

  it("result grid for top cards uses 2 columns", () => {
    expect(source).toContain('gap-4 md:grid-cols-2')
  })
})

describe("Calculator mudha operational tokens (post-refinement)", () => {
  it("uses OperationalPageHeader instead of bare h2", () => {
    expect(source).toContain('import { OperationalPageHeader } from "@/components/mudha/OperationalPageHeader"')
    expect(source).toContain("<OperationalPageHeader")
    expect(source).toContain('title="Kalkulator Estimasi Profit"')
    expect(source).toContain('description="Masukkan estimasi harga beli dan biaya untuk melihat potensi profit."')
  })

  it("input section card uses mudha surface tokens", () => {
    expect(source).toContain('bg-[var(--mudha-surface-primary)]')
    expect(source).toContain('border-[var(--mudha-border-default)]')
    expect(source).toContain('shadow-[var(--mudha-shadow-xs)]')
  })

  it("input section title text uses mudha text token", () => {
    expect(source).toContain('CardTitle className="flex items-center gap-2 text-[var(--mudha-text)]"')
  })

  it("result cards use mudha surface tokens", () => {
    // At least 4 cards should use surface-primary
    const matches = source.split("--mudha-surface-primary").length - 1
    expect(matches).toBeGreaterThanOrEqual(4)
  })

  it("profit distribution section uses surface-subtle", () => {
    expect(source).toContain('bg-[var(--mudha-surface-subtle)]')
  })

  it("labels use mudha text token", () => {
    expect(source).toContain('Label className="text-sm font-medium text-[var(--mudha-text)]"')
  })

  it("input fields have min-h-[44px] for touch targets", () => {
    const minHMatches = source.match(/min-h-\[44px\]/g)
    expect(minHMatches).toBeTruthy()
    expect(minHMatches!.length).toBeGreaterThanOrEqual(4)
  })

  it("input fields use mudha background and border tokens", () => {
    expect(source).toContain('bg-[var(--mudha-surface-primary)] border-[var(--mudha-border-default)]')
  })

  it("has helper text below input fields for accessibility", () => {
    expect(source).toContain("Harga pembelian unit kendaraan")
    expect(source).toContain("Biaya servis/pemulihan")
    expect(source).toContain("Biaya admin, pajek, dll")
    expect(source).toContain("Harga jual yang diharapkan")
  })

  it("reset button has min-h-[44px] touch target", () => {
    expect(source).toContain("min-h-[44px]")
  })

  it("dividers use mudha border-subtle token", () => {
    expect(source).toContain('border-[var(--mudha-border-subtle)]')
  })

  it("result subtitle text uses mudha text-muted token", () => {
    expect(source).toContain('text-[var(--mudha-text-muted)]')
  })

  it("has no hardcoded marketing hero, gradients, or decorative blobs", () => {
    expect(source).not.toContain("font-black")
    expect(source).not.toContain("blur-3xl")
    expect(source).not.toContain("backdrop-blur")
    expect(source).not.toContain("from-emerald")
    expect(source).not.toContain("to-teal")
  })
})
