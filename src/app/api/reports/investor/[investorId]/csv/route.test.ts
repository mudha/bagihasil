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

const activeTransaction = {
    id: "tx-active",
    transactionCode: "TX-ACTIVE",
    status: "ON_PROCESS",
    buyDate: new Date("2026-08-01T00:00:00.000Z"),
    sellDate: null,
    buyPrice: 900_000,
    sellPrice: null,
    initialInvestorCapital: 0,
    initialManagerCapital: 0,
    costs: [],
    profitSharing: null,
    paymentHistories: [],
}

const completedTransaction = {
    id: "tx-completed",
    transactionCode: "TX-COMPLETED",
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
    paymentHistories: [{ amount: 40_000, paymentDate: new Date("2026-07-11T00:00:00.000Z"), method: "TRANSFER", notes: null }],
}

function requestAndParams() {
    return [new Request("http://localhost/api/reports/investor/investor-1/csv") as unknown as NextRequest, { params: Promise.resolve({ investorId: "investor-1" }) }] as const
}

function investorFixture() {
    return {
        id: "investor-1",
        name: "Investor One",
        contactInfo: null,
        bankAccountDetails: null,
        notes: null,
        units: [
            { name: "Unit Active", plateNumber: "AA-1", status: "AVAILABLE", transactions: [activeTransaction] },
            { name: "Unit Completed", plateNumber: "BB-2", status: "SOLD", transactions: [completedTransaction] },
        ],
    }
}

describe("GET investor CSV report", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ session })
        mocks.canAccessInvestor.mockResolvedValue(true)
        mocks.findUnique.mockResolvedValue(investorFixture())
    })

    it("reports active investor capital separately while listing completed transactions only", async () => {
        const response = (await GET(...requestAndParams()))!
        const csv = await response.text()

        expect(response.status).toBe(200)
        expect(csv).toContain("Total Unit Aktif,1")
        expect(csv).toContain("Total Transaksi Selesai,1")
        expect(csv).toContain("Total Modal Tertanam,Rp\u00a00")
        expect(csv).not.toContain("Total Modal Tertanam,Rp\u00a0900.000")
        expect(csv).toContain("TX-COMPLETED")
        expect(csv).not.toContain("TX-ACTIVE")
        expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "investor-1" },
        }))
        const query = mocks.findUnique.mock.calls[0][0]
        expect(query).not.toHaveProperty("include")
        expect(query.select.units.select.transactions.orderBy).toEqual({ sellDate: "desc" })
        expect(query.select.units.select.transactions.select).toEqual(expect.objectContaining({
            costs: expect.any(Object),
            profitSharing: expect.any(Object),
            paymentHistories: expect.any(Object),
        }))
    })

    it("denies unauthenticated access before querying investor financial data", async () => {
        mocks.requireAuth.mockResolvedValue({ response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) })

        const response = (await GET(...requestAndParams()))!

        expect(response.status).toBe(401)
        expect(mocks.canAccessInvestor).not.toHaveBeenCalled()
        expect(mocks.findUnique).not.toHaveBeenCalled()
    })

    it("denies foreign investor access before querying investor financial data", async () => {
        mocks.canAccessInvestor.mockResolvedValue(false)

        const response = (await GET(...requestAndParams()))!

        expect(response.status).toBe(403)
        expect(mocks.findUnique).not.toHaveBeenCalled()
    })
})
