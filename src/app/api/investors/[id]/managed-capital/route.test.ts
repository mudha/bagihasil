import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    prisma: {
        $transaction: vi.fn(),
    },
}))

vi.mock("@/lib/api-auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }))

import { PATCH } from "./route"

const adminSession = {
    user: { id: "admin-user", role: "ADMIN", name: "Admin" },
    expires: "2099-01-01T00:00:00.000Z",
}

function requestWithJson(body: unknown) {
    const json = vi.fn().mockResolvedValue(body)
    return { json } as unknown as Request & { json: ReturnType<typeof vi.fn> }
}

function params() {
    return { params: Promise.resolve({ id: "investor-1" }) }
}

function transactionClient(overrides: Record<string, unknown> = {}) {
    return {
        investor: {
            findUnique: vi.fn().mockResolvedValue({
                id: "investor-1",
                managedCapitalBalance: null,
                managedCapitalBalanceUpdatedAt: null,
            }),
            update: vi.fn().mockResolvedValue({
                id: "investor-1",
                managedCapitalBalance: "5000000",
                managedCapitalBalanceUpdatedAt: new Date("2026-08-24T00:00:00.000Z"),
            }),
        },
        activityLog: {
            create: vi.fn().mockResolvedValue({ id: "log-1" }),
        },
        ...overrides,
    }
}

describe("PATCH /api/investors/[id]/managed-capital", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAdmin.mockResolvedValue({ session: adminSession })
        mocks.prisma.$transaction.mockImplementation(async (callback: (tx: ReturnType<typeof transactionClient>) => unknown) => callback(transactionClient()))
    })

    it("rejects unauthenticated requests before parsing body or opening a transaction", async () => {
        mocks.requireAdmin.mockResolvedValue({ response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) })
        const request = requestWithJson({ action: "set", managedCapitalBalance: "5000000" })

        const response = await PATCH(request, params())

        expect(response.status).toBe(401)
        expect(request.json).not.toHaveBeenCalled()
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("rejects non-admin requests before parsing body or opening a transaction", async () => {
        mocks.requireAdmin.mockResolvedValue({ response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) })
        const request = requestWithJson({ action: "set", managedCapitalBalance: "5000000" })

        const response = await PATCH(request, params())

        expect(response.status).toBe(403)
        expect(request.json).not.toHaveBeenCalled()
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("sets an exact string balance and serializes the Decimal response", async () => {
        const tx = transactionClient()
        mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => {
            tx.investor.update.mockResolvedValueOnce({
                id: "investor-1",
                managedCapitalBalance: { toString: () => "5000000" },
                managedCapitalBalanceUpdatedAt: new Date("2026-08-24T00:00:00.000Z"),
            })
            return callback(tx)
        })
        const response = await PATCH(requestWithJson({ action: "set", managedCapitalBalance: "5000000" }), params())

        expect(response.status).toBe(200)
        expect(tx.investor.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "investor-1" },
            data: { managedCapitalBalance: "5000000", managedCapitalBalanceUpdatedAt: expect.any(Date) },
        }))
        expect(tx.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: "UPDATE",
                entity: "INVESTOR",
                entityId: "investor-1",
                details: expect.stringContaining('"action":"set"'),
                userId: "admin-user",
            }),
        }))
        await expect(response.json()).resolves.toEqual({
            ok: true,
            investor: {
                id: "investor-1",
                managedCapitalBalance: "5000000",
                managedCapitalBalanceUpdatedAt: "2026-08-24T00:00:00.000Z",
            },
        })
    })

    it("distinguishes zero from explicit clear", async () => {
        const zeroResponse = await PATCH(requestWithJson({ action: "set", managedCapitalBalance: "0" }), params())
        expect(zeroResponse.status).toBe(200)

        const clearTx = transactionClient()
        clearTx.investor.update.mockResolvedValueOnce({
            id: "investor-1",
            managedCapitalBalance: null,
            managedCapitalBalanceUpdatedAt: new Date("2026-08-24T00:00:00.000Z"),
        })
        mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof clearTx) => unknown) => callback(clearTx))
        const clearResponse = await PATCH(requestWithJson({ action: "clear" }), params())
        expect(clearResponse.status).toBe(200)
        expect(clearTx.investor.update).toHaveBeenCalledWith(expect.objectContaining({
            data: { managedCapitalBalance: null, managedCapitalBalanceUpdatedAt: expect.any(Date) },
        }))
        await expect(clearResponse.json()).resolves.toMatchObject({
            ok: true,
            investor: { managedCapitalBalance: null },
        })
    })

    it.each([
        { action: "set" },
        { action: "set", managedCapitalBalance: null },
        { action: "set", managedCapitalBalance: 5000000 },
        { action: "set", managedCapitalBalance: "" },
        { action: "set", managedCapitalBalance: " 5000000" },
        { action: "set", managedCapitalBalance: "5000000 " },
        { action: "set", managedCapitalBalance: "-1" },
        { action: "set", managedCapitalBalance: "+1" },
        { action: "set", managedCapitalBalance: "1.5" },
        { action: "set", managedCapitalBalance: "1e3" },
        { action: "set", managedCapitalBalance: "1,000" },
        { action: "set", managedCapitalBalance: "NaN" },
        { action: "set", managedCapitalBalance: "Infinity" },
        { action: "set", managedCapitalBalance: "0001" },
        { action: "set", managedCapitalBalance: "1234567890123456789" },
        { action: "clear", managedCapitalBalance: "0" },
        { action: "other" },
    ])("rejects invalid body %# without mutation", async (body) => {
        const request = requestWithJson(body)
        const response = await PATCH(request, params())

        expect(response.status).toBe(400)
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("returns 404 inside the transaction for a missing investor", async () => {
        const tx = transactionClient()
        tx.investor.findUnique.mockResolvedValueOnce(null)
        mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx))

        const response = await PATCH(requestWithJson({ action: "clear" }), params())

        expect(response.status).toBe(404)
        expect(tx.investor.update).not.toHaveBeenCalled()
        expect(tx.activityLog.create).not.toHaveBeenCalled()
    })

    it("rolls back the update when the audit log fails", async () => {
        const tx = transactionClient()
        tx.activityLog.create.mockRejectedValueOnce(new Error("log failed"))
        mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx))

        const response = await PATCH(requestWithJson({ action: "clear" }), params())

        expect(response.status).toBe(500)
        expect(tx.investor.update).toHaveBeenCalledTimes(1)
        expect(tx.activityLog.create).toHaveBeenCalledTimes(1)
    })

    it("retries a serialization conflict and logs the fresh committed before value", async () => {
        const conflict = Object.assign(new Error("write conflict"), { code: "P2034" })
        const staleTx = transactionClient()
        const freshTx = transactionClient()
        freshTx.investor.findUnique.mockResolvedValueOnce({
            id: "investor-1",
            managedCapitalBalance: { toString: () => "100" },
            managedCapitalBalanceUpdatedAt: new Date("2026-08-24T00:00:00.000Z"),
        })
        freshTx.investor.update.mockResolvedValueOnce({
            id: "investor-1",
            managedCapitalBalance: { toString: () => "200" },
            managedCapitalBalanceUpdatedAt: new Date("2026-08-24T00:01:00.000Z"),
        })

        mocks.prisma.$transaction
            .mockImplementationOnce(async (callback: (client: typeof staleTx) => unknown) => {
                await callback(staleTx)
                throw conflict
            })
            .mockImplementationOnce(async (callback: (client: typeof freshTx) => unknown) => callback(freshTx))

        const response = await PATCH(requestWithJson({ action: "set", managedCapitalBalance: "200" }), params())

        expect(response.status).toBe(200)
        expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2)
        expect(mocks.prisma.$transaction).toHaveBeenNthCalledWith(1, expect.any(Function), {
            isolationLevel: "Serializable",
        })
        expect(freshTx.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                details: JSON.stringify({
                    action: "set",
                    managedCapitalBalanceBefore: "100",
                    managedCapitalBalanceAfter: "200",
                }),
            }),
        }))
    })
})
