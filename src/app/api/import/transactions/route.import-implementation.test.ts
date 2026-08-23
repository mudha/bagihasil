import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Import route source characterization tests.
 * After fix: import MUST call calculateProfitSharing from shared helper.
 */

const routeSource = readFileSync(
    new URL("./route.ts", import.meta.url),
    "utf8"
)

describe("import route implementation — parity with shared helper", () => {
    it("import calls calculateProfitSharing from shared helper", () => {
        expect(routeSource).toContain("calculateProfitSharing")
        expect(routeSource).toContain('from "@/lib/profit-sharing"')
    })

    it("import does NOT use inline netMargin formula", () => {
        expect(routeSource).not.toContain("netMargin = parsedSellPrice - totalCapital")
    })

    it("import does NOT use inline percentage formula", () => {
        expect(routeSource).not.toContain("netMargin * (investorSharePercentage / 100)")
        expect(routeSource).not.toContain("netMargin * (managerSharePercentage / 100)")
    })

    it("import uses calculation.output for persistence", () => {
        expect(routeSource).toContain("calculation.netMargin")
        expect(routeSource).toContain("calculation.investorProfitAmount")
        expect(routeSource).toContain("calculation.managerProfitAmount")
        expect(routeSource).toContain("calculation.profitStatus")
    })
})
