/**
 * Characterization tests for getPaymentStatusBadge extraction.
 * Verifies executable render output and the one-way extraction contract.
 */
import { describe, it, expect, vi } from "vitest"
import React from "react"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../components/ui/badge", () => ({
    Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
        React.createElement("span", props, children),
}))

import { getPaymentStatusBadge } from "../../../components/transactions/getPaymentStatusBadge"

const page = readFileSync(
    `${process.cwd()}/src/app/dashboard/transactions/page.tsx`, "utf-8"
)
const mod = readFileSync(
    `${process.cwd()}/src/components/transactions/getPaymentStatusBadge.tsx`, "utf-8"
)

type BadgeInput = Parameters<typeof getPaymentStatusBadge>[0]
const tx = (overrides: Partial<BadgeInput> = {}): BadgeInput => ({
    status: "COMPLETED",
    sellDate: null,
    _count: { paymentHistories: 0 },
    ...overrides,
})
const markup = (input: BadgeInput) => renderToStaticMarkup(getPaymentStatusBadge(input))

describe("getPaymentStatusBadge executable behavior", () => {
    it("returns a dash for every non-COMPLETED status", () => {
        expect(markup(tx({ status: "PENDING", _count: { paymentHistories: 9 } }))).toContain(">-</span>")
    })

    it("returns Lunas immediately before the 2026 cutoff", () => {
        expect(markup(tx({ sellDate: "2025-12-31" }))).toContain("Lunas")
    })

    it("does not treat the exact cutoff date as legacy", () => {
        expect(markup(tx({ sellDate: "2026-01-01" }))).toContain("Belum Bayar")
    })

    it("does not treat a post-cutoff date as legacy", () => {
        expect(markup(tx({ sellDate: "2026-01-02" }))).toContain("Belum Bayar")
    })

    it("uses payment history for current completed transactions", () => {
        expect(markup(tx({ _count: { paymentHistories: 1 } }))).toContain("Lunas")
        expect(markup(tx({ _count: { paymentHistories: 0 } }))).toContain("Belum Bayar")
    })

    it("handles missing, null, and invalid sell dates like baseline", () => {
        expect(markup(tx())).toContain("Belum Bayar")
        expect(markup(tx({ sellDate: undefined }))).toContain("Belum Bayar")
        expect(markup(tx({ sellDate: "not-a-date" }))).toContain("Belum Bayar")
    })

    it("preserves timezone-offset parsing through the baseline Date logic", () => {
        expect(markup(tx({ sellDate: "2026-01-01T00:30:00+07:00" }))).toContain("Belum Bayar")
    })

    it("renders the paid and unpaid icon/class contracts", () => {
        const paid = markup(tx({ _count: { paymentHistories: 2 } }))
        const unpaid = markup(tx())
        expect(paid).toContain("bg-emerald-600")
        expect(paid).toContain("lucide-circle-check")
        expect(unpaid).toContain("border-orange-500")
        expect(unpaid).toContain("lucide-circle-alert")
    })
})

describe("getPaymentStatusBadge module boundary", () => {
    it("exports a minimal interface and function without hooks or network", () => {
        expect(mod).toContain("export interface PaymentStatusTx")
        expect(mod).toContain("export function getPaymentStatusBadge")
        expect(mod).not.toContain("useState")
        expect(mod).not.toContain("useEffect")
        expect(mod).not.toContain("fetch(")
        expect(mod).not.toContain('"use client"')
    })

    it("page imports the helper and retains the mobile call site", () => {
        expect(page).toContain(
            'import { getPaymentStatusBadge } from "@/components/transactions/getPaymentStatusBadge"'
        )
        expect(page).not.toMatch(/^const getPaymentStatusBadge\s*=/m)
        expect(page).toContain("getPaymentStatusBadge(trx)")
    })
})
