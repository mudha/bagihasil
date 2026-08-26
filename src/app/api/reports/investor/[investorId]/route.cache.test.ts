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

const session = { user: { id: "investor-1", role: "INVESTOR" }, expires: "2099-01-01T00:00:00.000Z" }

function requestAndParams() {
    return [new Request("http://localhost/api/reports/investor/investor-1") as unknown as NextRequest, { params: Promise.resolve({ investorId: "investor-1" }) }] as const
}

function investorFixture() {
    return {
        id: "investor-1",
        name: "Investor One",
        contactInfo: null,
        bankAccountDetails: null,
        notes: null,
        units: [{ name: "Unit", plateNumber: "AA-1", status: "SOLD", transactions: [] }],
    }
}

describe("GET investor JSON report cache contract", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ session })
        mocks.canAccessInvestor.mockResolvedValue(true)
        mocks.findUnique.mockResolvedValue(investorFixture())
    })

    it("marks success as private no-store", async () => {
        const response = (await GET(...requestAndParams()))!

        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    })

    it("marks unauthorized response and does not query financial data", async () => {
        mocks.requireAuth.mockResolvedValue({ response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) })

        const response = (await GET(...requestAndParams()))!

        expect(response.status).toBe(401)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
        expect(mocks.findUnique).not.toHaveBeenCalled()
    })

    it("marks forbidden response and does not query financial data", async () => {
        mocks.canAccessInvestor.mockResolvedValue(false)

        const response = (await GET(...requestAndParams()))!

        expect(response.status).toBe(403)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
        expect(mocks.findUnique).not.toHaveBeenCalled()
    })

    it("marks not-found response as private no-store", async () => {
        mocks.findUnique.mockResolvedValue(null)

        const response = (await GET(...requestAndParams()))!

        expect(response.status).toBe(404)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    })

    it("marks internal error response as private no-store", async () => {
        mocks.findUnique.mockRejectedValue(new Error("database unavailable"))

        const response = (await GET(...requestAndParams()))!

        expect(response.status).toBe(500)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    })
})
