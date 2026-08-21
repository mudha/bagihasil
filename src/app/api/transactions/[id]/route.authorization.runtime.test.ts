import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    canAccessTransaction: vi.fn(),
    transactionFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/api-auth", () => ({ canAccessTransaction: mocks.canAccessTransaction }))
vi.mock("@/lib/prisma", () => ({
    prisma: { transaction: { findUnique: mocks.transactionFindUnique } },
}))
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }))
vi.mock("@/lib/notifications", () => ({ notifyUnitSold: vi.fn() }))
vi.mock("@/lib/profit-sharing", () => ({ calculateProfitSharing: vi.fn() }))
vi.mock("@/lib/serializable-transaction", () => ({ runSerializableTransaction: vi.fn() }))

import { GET } from "./route"

const investorSession = {
    user: { id: "investor-user", role: "INVESTOR" },
    expires: "2099-01-01T00:00:00.000Z",
}

describe("transaction detail runtime authorization", () => {
    beforeEach(() => vi.clearAllMocks())

    it("returns 404 without loading sensitive relations when ownership is denied", async () => {
        mocks.auth.mockResolvedValue(investorSession)
        mocks.canAccessTransaction.mockResolvedValue(false)

        const response = await GET(
            new Request("http://localhost:3100/api/transactions/foreign-id"),
            { params: Promise.resolve({ id: "foreign-id" }) }
        )

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: "Transaction not found" })
        expect(mocks.canAccessTransaction).toHaveBeenCalledWith(investorSession, "foreign-id")
        expect(mocks.transactionFindUnique).not.toHaveBeenCalled()
    })

    it("loads the full transaction only after access is allowed", async () => {
        mocks.auth.mockResolvedValue(investorSession)
        mocks.canAccessTransaction.mockResolvedValue(true)
        mocks.transactionFindUnique.mockResolvedValue(null)

        const response = await GET(
            new Request("http://localhost:3100/api/transactions/own-but-missing"),
            { params: Promise.resolve({ id: "own-but-missing" }) }
        )

        expect(response.status).toBe(404)
        expect(mocks.canAccessTransaction.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.transactionFindUnique.mock.invocationCallOrder[0])
        expect(mocks.transactionFindUnique).toHaveBeenCalledOnce()
    })
})
