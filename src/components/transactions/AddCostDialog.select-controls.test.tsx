import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("src/components/transactions/AddCostDialog.tsx", "utf8")
const selectPrimitive = readFileSync("src/components/ui/select.tsx", "utf8")
const dialogPrimitive = readFileSync("src/components/ui/dialog.tsx", "utf8")

function fieldBlock(fieldName: string) {
  const start = source.indexOf(`name="${fieldName}"`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = source.indexOf("<FormField", start + 1)
  return source.slice(start, end === -1 ? undefined : end)
}

describe("AddCostDialog select layering contract", () => {
  it("puts Jenis Biaya portal content above the dialog", () => {
    expect(fieldBlock("costType")).toContain('<SelectContent className="z-[110]">')
  })

  it("puts Dibayar Oleh portal content above the dialog", () => {
    expect(fieldBlock("payer")).toContain('<SelectContent className="z-[110]">')
  })

  it("documents the modal stacking gap and exact local override", () => {
    expect(dialogPrimitive).toContain("fixed inset-0 z-[100]")
    expect(dialogPrimitive).toContain("fixed top-[50%] left-[50%] z-[100]")
    expect(selectPrimitive).toContain("relative z-50")
    expect(source.match(/<SelectContent className=\"z-\[110\]\">/g)).toHaveLength(2)
  })

  it("keeps both controls enabled and wired to existing form state", () => {
    expect(fieldBlock("costType")).toContain("<Select onValueChange={field.onChange} value={field.value}>")
    expect(fieldBlock("costType")).not.toMatch(/<SelectTrigger[^>]*disabled/)
    expect(fieldBlock("payer")).toContain("<Select onValueChange={field.onChange} value={field.value}>")
    expect(fieldBlock("payer")).not.toMatch(/<SelectTrigger[^>]*disabled/)
  })
})
