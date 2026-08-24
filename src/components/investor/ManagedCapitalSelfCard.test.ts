import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync("src/components/investor/ManagedCapitalSelfCard.tsx", "utf8")

describe("ManagedCapitalSelfCard wiring", () => {
    it("uses only the session-bound self endpoint", () => {
        expect(source).toContain('fetch("/api/investors/me/capital-summary"')
        expect(source).not.toContain("/api/investors/capital-summary")
        expect(source).not.toMatch(/managed-capital\/(\$|\{)/)
    })

    it("has no mutation controls or browser financial storage", () => {
        expect(source).not.toMatch(/PATCH|DELETE|localStorage|sessionStorage|setManagedCapital|clearManagedCapital/)
        expect(source).not.toContain("investorId")
    })

    it("has distinct loading, error, missing, retry, and accessible warning paths", () => {
        expect(source).toContain('kind: "loading"')
        expect(source).toContain('kind: "error"')
        expect(source).toContain('kind: "missing"')
        expect(source).toContain("Coba Lagi")
        expect(source).toContain('role="alert"')
        expect(source).toContain("AbortController")
    })
})
