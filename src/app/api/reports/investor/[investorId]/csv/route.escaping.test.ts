import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    canAccessInvestor: vi.fn(),
    findUnique: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
    requireAuth: mocks.requireAuth,
    canAccessInvestor: mocks.canAccessInvestor,
    forbidden: () => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
}))
vi.mock("@/lib/prisma", () => ({ prisma: { investor: { findUnique: mocks.findUnique } } }))

import { GET } from "./route"

const session = { user: { id: "admin-1", role: "ADMIN" }, expires: "2099-01-01T00:00:00.000Z" }

function requestAndParams() {
    return [new Request("http://localhost/api/reports/investor/investor-1/csv") as unknown as NextRequest, { params: Promise.resolve({ investorId: "investor-1" }) }] as const
}

function investorWithEscapingNeeds() {
    return {
        id: "investor-1",
        name: "Investor, One",
        contactInfo: "Has \"Quote\"",
        bankAccountDetails: null,
        notes: "Notes\nNew Line",
        units: [
            {
                name: "Unit \"X\"",
                plateNumber: "BB-2",
                status: "SOLD",
                transactions: [
                    {
                        id: "tx-1",
                        transactionCode: "TX-1,COMMA",
                        status: "COMPLETED",
                        buyDate: new Date("2026-07-01T00:00:00.000Z"),
                        sellDate: new Date("2026-07-10T00:00:00.000Z"),
                        buyPrice: 1_000_000,
                        sellPrice: 1_100_000,
                        initialInvestorCapital: 800_000,
                        initialManagerCapital: 200_000,
                        costs: [],
                        profitSharing: {
                            netMargin: 100_000,
                            investorProfitAmount: 40_000,
                            managerProfitAmount: 60_000,
                        },
                        paymentHistories: [
                            { amount: 40_000, paymentDate: new Date("2026-07-11T00:00:00.000Z"), method: "TRANSFER", notes: null },
                        ],
                    },
                ],
            },
        ],
    }
}

describe("GET investor CSV escaping", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ session })
        mocks.canAccessInvestor.mockResolvedValue(true)
        mocks.findUnique.mockResolvedValue(investorWithEscapingNeeds())
    })

    it("keeps comma, quote, and newline-containing values inside their expected CSV fields", async () => {
        const response = (await GET(...requestAndParams()))!
        const csv = await response.text()

        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")

        // Header row exists
        expect(csv).toContain("Nama,Kontak,Rekening,Catatan")

        // Comma in name: value must be double-quoted
        expect(csv).toContain('"Investor, One"')

        // Double quote in contact: internal quotes doubled
        expect(csv).toContain('"Has ""Quote""')

        // Newline in notes: the note value is wrapped in double-quotes,
        // followed by a newline (inside the quotes), then the closing quote
        expect(csv).toContain('"Notes\nNew Line"')

        // Comma in transaction code: must be quoted
        expect(csv).toContain('"TX-1,COMMA"')

        // Double quote in unit name
        expect(csv).toContain('"Unit ""X""')

        // Detail section header
        expect(csv).toContain('Kode,Unit,Plat Nomor,Tanggal Beli,Tanggal Jual,Harga Beli,Harga Jual,Modal Investor,Modal Manager,Total Biaya,Biaya Investor,Biaya Manager,Margin Bersih,Profit Investor,Profit Manager,Status Bayar,Total Terbayar')

        // Regression: PR #70 active-capital separation
        expect(csv).toContain("Total Transaksi Selesai,1")
    })
})
