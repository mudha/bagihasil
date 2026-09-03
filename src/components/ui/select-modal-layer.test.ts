import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const selectSource = readFileSync("src/components/ui/select.tsx", "utf8")
const dialogSource = readFileSync("src/components/ui/dialog.tsx", "utf8")
const paymentSource = readFileSync("src/components/transactions/AddPaymentDialog.tsx", "utf8")
const costSource = readFileSync("src/components/transactions/AddCostDialog.tsx", "utf8")
const layerSource = readFileSync("src/components/ui/portal-layer.tsx", "utf8")

describe("modal Select portal-layer contract", () => {
  it("provides modal context through DialogContent and keeps Select default non-modal", () => {
    expect(dialogSource).toContain("<PortalLayerProvider>{children}</PortalLayerProvider>")
    expect(layerSource).toContain('createContext<PortalLayer>("base")')
    expect(selectSource).toContain('portalLayer === "modal" ? "z-[110]" : "z-50"')
    expect(selectSource).toContain("const portalLayer = usePortalLayer()")
  })

  it("preserves consumer class override after the default layer", () => {
    const contentSlice = selectSource.slice(selectSource.indexOf("function SelectContent"), selectSource.indexOf("function SelectLabel"))
    expect(contentSlice.indexOf("portalLayer === \"modal\" ? \"z-[110]\" : \"z-50\""))
      .toBeLessThan(contentSlice.lastIndexOf("className"))
  })

  it("does not introduce brittle focus restoration or DOM lookup", () => {
    expect(selectSource).not.toContain("onCloseAutoFocus")
    expect(selectSource).not.toContain("querySelector")
    expect(selectSource).not.toContain("setTimeout")
    expect(selectSource).not.toContain("requestAnimationFrame")
  })

  it("preserves Payment method values and AddCost layering contract", () => {
    expect(paymentSource).toContain("z.enum(['TRANSFER', 'CASH'])")
    expect(paymentSource).toContain("defaultValues")
    expect(paymentSource).toContain("method: 'TRANSFER'")
    expect(costSource.match(/<SelectContent className=\"z-\[110\]\">/g)).toHaveLength(2)
  })
})
