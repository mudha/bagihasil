import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    getManagedCapitalSummaries: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/api-auth", () => ({ canReadAdminData: (session: { user: { role: string } }) => session.user.role === "ADMIN" || session.user.role === "VIEWER" }))
vi.mock("@/lib/managed-capital-read-query", () => ({
    getManagedCapitalSummaries: mocks.getManagedCapitalSummaries,
}))

import { GET } from "./route"

const admin = { user: { id: "admin-1", role: "ADMIN" } }
const viewer = { user: { id: "viewer-1", role: "VIEWER" } }
const investor = { user: { id: "investor-user-1", role: "INVESTOR" } }

const summary = {
    investorId: "inv-1",
    managedCapitalBalance: "0",
    managedCapitalBalanceUpdatedAt: null,
    activeAllocatedInvestorCapital: "100",
    availableManagedCapital: "-100",
    managedCapitalStatus: "SET",
    warnings: [{ code: "ALLOCATION_EXCEEDS_MANAGED_BALANCE", message: "warning" }],
}

describe("GET /api/investors/capital-summary", () => {
    beforeEach(() => vi.clearAllMocks())

    it("allows admin and returns private no-store read model", async () => {
        mocks.auth.mockResolvedValue(admin)
        mocks.getManagedCapitalSummaries.mockResolvedValue([summary])

        const response = await GET()

        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
        expect(await response.json()).toEqual({ investors: [summary] })
        expect(mocks.getManagedCapitalSummaries).toHaveBeenCalledOnce()
    })

    it("allows viewer using existing admin-data permission", async () => {
        mocks.auth.mockResolvedValue(viewer)
        mocks.getManagedCapitalSummaries.mockResolvedValue([])

        expect((await GET()).status).toBe(200)
        expect(mocks.getManagedCapitalSummaries).toHaveBeenCalledOnce()
    })

    it("rejects investor before sensitive query", async () => {
        mocks.auth.mockResolvedValue(investor)

        const response = await GET()

        expect(response.status).toBe(403)
        expect(mocks.getManagedCapitalSummaries).not.toHaveBeenCalled()
    })

    it("rejects unauthenticated before sensitive query", async () => {
        mocks.auth.mockResolvedValue(null)

        expect((await GET()).status).toBe(401)
        expect(mocks.getManagedCapitalSummaries).not.toHaveBeenCalled()
    })
})
