import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { calculateProfitSharing } from "./profit-sharing"
import { COST_TYPE_OPTIONS, COST_TYPE_VALUES, getCostTypeLabel } from "./cost-types"

const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("Pajak operational cost category contract", () => {
  it("defines one canonical TAX option with the Pajak label", () => {
    const source = read("src/lib/cost-types.ts")
    expect(source).toContain('value: "TAX", label: "Pajak"')
    expect(source.match(/value: "TAX"/g)).toHaveLength(1)
  })

  it("maps canonical values to labels and preserves unknown legacy values", () => {
    expect(COST_TYPE_OPTIONS).toHaveLength(13)
    expect(COST_TYPE_VALUES).toContain("TAX")
    expect(getCostTypeLabel("TAX")).toBe("Pajak")
    expect(getCostTypeLabel("Inspector")).toBe("Inspector")
    expect(getCostTypeLabel("UNKNOWN_LEGACY")).toBe("UNKNOWN_LEGACY")
  })

  it("accepts TAX and rejects arbitrary values through the canonical server allowlist", () => {
    const schema = z.object({ costType: z.enum(COST_TYPE_VALUES) })
    expect(schema.safeParse({ costType: "TAX" }).success).toBe(true)
    expect(schema.safeParse({ costType: "NOT_A_COST" }).success).toBe(false)
  })

  it("keeps TAX accounting identical to another cost category", () => {
    const input = {
      buyPrice: 100_000_000,
      sellPrice: 120_000_000,
      initialInvestorCapital: 100_000_000,
      initialManagerCapital: 0,
      investorSharePercentage: 50,
      managerSharePercentage: 50,
    }
    const tax = calculateProfitSharing({ ...input, costs: [{ amount: 2_000_000, payer: "MANAGER" }] })
    const repair = calculateProfitSharing({ ...input, costs: [{ amount: 2_000_000, payer: "MANAGER" }] })
    expect(tax).toEqual(repair)
  })

  it("uses the shared category list in Add/Edit Cost and POST validation", () => {
    expect(read("src/components/transactions/AddCostDialog.tsx")).toContain("COST_TYPE_OPTIONS.map")
    expect(read("src/app/api/transactions/[id]/costs/route.ts")).toContain("COST_TYPE_VALUES")
    expect(read("src/app/api/transactions/[id]/costs/[costId]/route.ts")).toContain("costType: z.string()")
  })

  it("keeps TAX in the OCR/AI vocabulary and import mapping", () => {
    expect(read("src/lib/ocr-parser.ts")).toContain('costType = "TAX"')
    expect(read("src/lib/gemini.ts")).toContain("- TAX:")
    expect(read("src/app/api/import/transactions/route.ts")).toContain("biayaPajak")
    expect(read("src/components/import/ImportTransactionsDialog.tsx")).toContain("biayaPajak")
  })

  it("renders the user-facing label for TAX while preserving unknown legacy values", () => {
    const source = read("src/lib/cost-types.ts")
    expect(source).toContain("export function getCostTypeLabel")
    expect(read("src/app/dashboard/transactions/[id]/page.tsx")).toContain("getCostTypeLabel(cost.costType)")
    expect(read("src/lib/export-utils.ts")).toContain("getCostTypeLabel(cost.costType)")
  })

  it("keeps accounting category-agnostic and does not add Unit tax metadata behavior", () => {
    const profit = read("src/lib/profit-sharing.ts")
    expect(profit).not.toMatch(/costType|taxDueDate/)
    expect(read("src/components/transactions/AddCostDialog.tsx")).not.toMatch(/taxDueDate|unit\.update/)
  })
})
