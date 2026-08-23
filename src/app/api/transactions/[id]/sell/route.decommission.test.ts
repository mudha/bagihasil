import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    requireAdmin: vi.fn(),
    prisma: {
        $transaction: vi.fn(),
        transaction: { findUnique: vi.fn(), update: vi.fn() },
        unit: { update: vi.fn() },
        profitSharing: { create: vi.fn() },
    },
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/api-auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }))

import { POST } from "./route"

const adminSession = {
    user: { id: "admin-user", role: "ADMIN" },
    expires: "2099-01-01T00:00:00.000Z",
}

const viewerSession = {
    user: { id: "viewer-user", role: "VIEWER" },
    expires: "2099-01-01T00:00:00.000Z",
}

function makeSellRequest(body?: unknown): Request {
    return new Request("http://localhost:3100/api/transactions/test-tx-id/sell", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
}

async function callPost(body?: unknown): Promise<Response> {
    return POST(makeSellRequest(body), {
        params: Promise.resolve({ id: "test-tx-id" }),
    }) as Promise<Response>
}

describe("legacy /sell endpoint decommission", () => {
    beforeEach(() => vi.clearAllMocks())

    it("returns 401 when unauthenticated", async () => {
        mocks.auth.mockResolvedValue(null)
        mocks.requireAdmin.mockResolvedValue({
            response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
        })

        const response = await callPost({})
        expect(response.status).toBe(401)
        expect(mocks.prisma.transaction.findUnique).not.toHaveBeenCalled()
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("returns 403 when viewer role", async () => {
        mocks.auth.mockResolvedValue(viewerSession)
        mocks.requireAdmin.mockResolvedValue({
            response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
        })

        const response = await callPost({})
        expect(response.status).toBe(403)
        expect(mocks.prisma.transaction.findUnique).not.toHaveBeenCalled()
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("returns 410 Gone for admin without parsing body or querying data", async () => {
        mocks.auth.mockResolvedValue(adminSession)
        mocks.requireAdmin.mockResolvedValue({ session: adminSession })

        const response = await callPost({
            sellDate: "2026-01-01",
            sellPrice: 100_000_000,
            investorSharePercentage: 40,
            managerSharePercentage: 60,
        })

        expect(response.status).toBe(410)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
        const body = await response.json()
        expect(body.error).toContain("tidak digunakan")
        expect(mocks.prisma.transaction.findUnique).not.toHaveBeenCalled()
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
        expect(mocks.prisma.unit.update).not.toHaveBeenCalled()
        expect(mocks.prisma.profitSharing.create).not.toHaveBeenCalled()
    })

    it("returns 410 for admin with malformed JSON body", async () => {
        mocks.auth.mockResolvedValue(adminSession)
        mocks.requireAdmin.mockResolvedValue({ session: adminSession })

        const req = new Request("http://localhost:3100/api/transactions/test-tx-id/sell", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{malformed-json",
        })

        const response = await POST(req, {
            params: Promise.resolve({ id: "test-tx-id" }),
        }) as Response

        expect(response.status).toBe(410)
        expect(mocks.prisma.transaction.findUnique).not.toHaveBeenCalled()
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("returns 410 for admin with no body", async () => {
        mocks.auth.mockResolvedValue(adminSession)
        mocks.requireAdmin.mockResolvedValue({ session: adminSession })

        const response = await callPost(undefined)
        expect(response.status).toBe(410)
        expect(mocks.prisma.transaction.findUnique).not.toHaveBeenCalled()
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })
})
