import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    investorFindUnique: vi.fn(),
    transactionFindMany: vi.fn(),
    transactionFindFirst: vi.fn(),
    transactionCreate: vi.fn(),
    transactionDeleteMany: vi.fn(),
    transactionUpdateMany: vi.fn(),
    prismaTransaction: vi.fn(),
    logActivity: vi.fn(),
    canReadAdminData: vi.fn((session) =>
        session.user.role === "ADMIN" || session.user.role === "VIEWER"
    ),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.logActivity }))
vi.mock("@/lib/api-auth", () => ({ canReadAdminData: mocks.canReadAdminData }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        investor: { findUnique: mocks.investorFindUnique },
        transaction: {
            findMany: mocks.transactionFindMany,
            findFirst: mocks.transactionFindFirst,
            create: mocks.transactionCreate,
            deleteMany: mocks.transactionDeleteMany,
            updateMany: mocks.transactionUpdateMany,
        },
        $transaction: mocks.prismaTransaction,
    },
}))

import { GET, POST } from "./route"

const request = (method: string, body?: unknown) => new Request(
    "http://localhost/api/transactions",
    {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    }
)

describe("/api/transactions role access", () => {
    beforeEach(() => vi.clearAllMocks())

    it("returns 401 before reading transactions when no user is logged in", async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await GET(request("GET"))

        expect(response.status).toBe(401)
        expect(mocks.transactionFindMany).not.toHaveBeenCalled()
    })

    it("scopes an INVESTOR transaction list to the investor linked to their user", async () => {
        mocks.auth.mockResolvedValue({ user: { id: "user-own", role: "INVESTOR" } })
        mocks.investorFindUnique.mockResolvedValue({ id: "investor-own" })
        mocks.transactionFindMany.mockResolvedValue([])

        const response = await GET(request("GET"))

        expect(response.status).toBe(200)
        expect(mocks.transactionFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { unit: { investorId: "investor-own" } },
        }))
    })

    it("rejects VIEWER transaction creation before parsing or writing data", async () => {
        mocks.auth.mockResolvedValue({ user: { id: "viewer", role: "VIEWER" } })

        const response = await POST(request("POST", {}))

        expect(response.status).toBe(403)
        expect(mocks.transactionFindFirst).not.toHaveBeenCalled()
        expect(mocks.prismaTransaction).not.toHaveBeenCalled()
    })
})
