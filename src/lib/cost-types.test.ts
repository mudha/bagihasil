import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { calculateProfitSharing } from "./profit-sharing"
import { CREATE_COST_TYPE_VALUES, getCostTypeLabel } from "./cost-types"
import { extractDataFromText } from "./ocr-parser"

const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("Pajak operational cost category contract", () => {
  it("defines one canonical TAX option with the Pajak label", () => {
    const source = read("src/lib/cost-types.ts")
    expect(source).toContain('value: "TAX", label: "Pajak"')
    expect(source.match(/value: "TAX"/g)).toHaveLength(1)
  })

  it("preserves base display/export tokens for every existing category", () => {
    const baseValues = [
      "INSPECTION", "TRANSPORT", "MEAL", "TOLL", "ADS", "REPAIR",
      "GAS", "PARKING", "STAMP_DUTY", "BROKER", "SALES", "OTHER",
    ]
    expect(baseValues.map(getCostTypeLabel)).toEqual(baseValues)
    expect(getCostTypeLabel("TAX")).toBe("Pajak")
    expect(getCostTypeLabel("Inspector")).toBe("Inspector")
    expect(getCostTypeLabel("UNKNOWN_LEGACY")).toBe("UNKNOWN_LEGACY")
  })

  it("accepts TAX and rejects arbitrary values through the exact base-compatible server allowlist", () => {
    expect(CREATE_COST_TYPE_VALUES).toEqual([
      "INSPECTION", "TRANSPORT", "MEAL", "TOLL", "ADS", "REPAIR",
      "GAS", "PARKING", "STAMP_DUTY", "BROKER", "TAX", "OTHER",
    ])
    const schema = z.object({ costType: z.enum(CREATE_COST_TYPE_VALUES) })
    expect(schema.safeParse({ costType: "TAX" }).success).toBe(true)
    expect(schema.safeParse({ costType: "NOT_A_COST" }).success).toBe(false)
    expect(schema.safeParse({ costType: "SALES" }).success).toBe(false)
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
    const postRoute = read("src/app/api/transactions/[id]/costs/route.ts")
    expect(postRoute).toContain("CREATE_COST_TYPE_VALUES")
    expect(postRoute).not.toContain("z.enum(COST_TYPE_VALUES)")
    expect(read("src/app/api/transactions/[id]/costs/[costId]/route.ts")).toContain("costType: z.string()")
  })

  it("classifies Pajak deterministically and keeps ambiguous OCR fallback", () => {
    expect(extractDataFromText("SAMSAT pembayaran PKB Rp 125.000").costType).toBe("TAX")
    expect(extractDataFromText("catatan umum Rp 125.000").costType).toBe("OTHER")
  })

  it("preserves deterministic OCR classification for existing categories", () => {
    const cases: Array<[string, string]> = [
      ["struk bensin Pertamina", "GAS"],
      ["gerbang tol", "TOLL"],
      ["makan warung", "MEAL"],
      ["karcis parkir", "PARKING"],
      ["servis bengkel", "REPAIR"],
      ["iklan OLX", "ADS"],
      ["materai", "STAMP_DUTY"],
      ["biaya towing", "TRANSPORT"],
      ["inspeksi kendaraan", "INSPECTION"],
    ]
    for (const [text, expected] of cases) {
      expect(extractDataFromText(text).costType).toBe(expected)
    }
  })

  it("keeps every existing Gemini category token and adds TAX exactly once", () => {
    const prompt = read("src/lib/gemini.ts")
    const tokens = ["TRANSPORT", "GAS", "MEAL", "TOLL", "PARKING", "REPAIR", "INSPECTION", "ADS", "STAMP_DUTY", "BROKER", "SALES", "OTHER"]
    for (const token of tokens) expect(prompt).toContain(`- ${token}:`)
    expect(prompt.match(/- TAX:/g)).toHaveLength(1)
  })

  it("keeps TAX in the OCR/AI vocabulary and import mapping", () => {
    expect(read("src/lib/ocr-parser.ts")).toContain('costType = "TAX"')
    expect(read("src/lib/gemini.ts")).toContain("- TAX:")
    expect(read("src/app/api/import/transactions/route.ts")).toContain("biayaPajak")
    expect(read("src/components/import/ImportTransactionsDialog.tsx")).toContain("biayaPajak")
  })

  it("maps biayaPajak import once with the existing manager-payer convention", () => {
    const route = read("src/app/api/import/transactions/route.ts")
    const block = route.split("if (biayaPajak", 2)[1].split("if (biayaLainLainPemodal", 1)[0]
    expect(block).toContain('parseImportNumber(biayaPajak, "biayaPajak", { min: 0 })! > 0')
    expect(block.match(/costs\.push/g)).toHaveLength(1)
    expect(block).toContain('costType: "TAX"')
    expect(block).toContain('payer: "MANAGER"')

    const dialog = read("src/components/import/ImportTransactionsDialog.tsx")
    const headersBlock = dialog.split("const headers = [", 2)[1].split("]", 1)[0]
    const sampleBlock = dialog.split("const sample = [", 2)[1].split("]", 1)[0]
    const values = (block: string) => [...block.matchAll(/"([^"]*)"/g)].map(match => match[1])
    const headers = values(headersBlock)
    expect(headers.at(-1)).toBe("biayaPajak")
    expect(values(sampleBlock)).toHaveLength(headers.length)
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
