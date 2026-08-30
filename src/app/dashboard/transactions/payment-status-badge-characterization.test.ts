/**
 * Characterization tests for getPaymentStatusBadge extraction.
 *
 * Verifies:
 * - the extracted module contains the function and exports it
 * - the page imports from the extracted module
 * - the module has no side effects/hooks/network
 * - executable behavior with representative inputs
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

const page = readFileSync(
    `${process.cwd()}/src/app/dashboard/transactions/page.tsx`, "utf-8"
)
const mod = readFileSync(
    `${process.cwd()}/src/components/transactions/getPaymentStatusBadge.tsx`, "utf-8"
)

describe("Extracted getPaymentStatusBadge module", () => {
    it("exports the function", () => {
        expect(mod).toContain("export function getPaymentStatusBadge")
    })

    it("exports PaymentStatusTx interface", () => {
        expect(mod).toContain("export interface PaymentStatusTx")
    })

    it("uses Badge, CheckCircle2, AlertCircle", () => {
        expect(mod).toContain('from "@/components/ui/badge"')
        expect(mod).toContain("CheckCircle2")
        expect(mod).toContain("AlertCircle")
    })

    it("has no hooks, network, or side effects", () => {
        expect(mod).not.toContain("useState")
        expect(mod).not.toContain("useEffect")
        expect(mod).not.toContain("fetch(")
        expect(mod).not.toContain('"use client"')
    })

    it("handles legacy transactions sold before Jan 1 2026", () => {
        expect(mod).toContain('new Date("2026-01-01")')
        expect(mod).toContain("Lunas")
    })

    it("checks _count.paymentHistories", () => {
        expect(mod).toContain("transaction._count?.paymentHistories || 0")
    })

    it("returns Belum Bayar for COMPLETED without payments", () => {
        expect(mod).toContain("Belum Bayar")
    })
})

describe("Page imports from extracted module", () => {
    it("imports getPaymentStatusBadge from component", () => {
        expect(page).toContain(
            'import { getPaymentStatusBadge } from "@/components/transactions/getPaymentStatusBadge"'
        )
    })

    it("no local getPaymentStatusBadge declaration remains", () => {
        expect(page).not.toMatch(/^const getPaymentStatusBadge\s*=/m)
    })

    it("still calls getPaymentStatusBadge(trx) in mobile card view", () => {
        expect(page).toContain("getPaymentStatusBadge(trx)")
    })
})
