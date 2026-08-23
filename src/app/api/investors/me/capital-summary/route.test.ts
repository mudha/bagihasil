import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    getInvestorForSession: vi.fn(),
    getManagedCapitalSummary: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/api-auth", () => ({ getInvestorForSession: mocks.getInvestorForSession }))
vi.mock("@/lib/managed-capital-read-query", () => ({ getManagedCapitalSummary: mocks.getManagedCapitalSummary }))

import { GET } from "./route"

const investorSession = { user: { id: "user-1", role: "INVESTOR" } }
const summary = {
    investorId: "inv-1",
    managedCapitalBalance: null,
    managedCapitalBalanceUpdatedAt: null,
    activeAllocatedInvestorCapital: "100",
    availableManagedCapital: null,
    managedCapitalStatus: "UNSET",
    warnings: [],
}

describe("GET /api/investors/me/capital-summary", () => {
    beforeEach(() => vi.clearAllMocks())

    it("resolves the investor from the authenticated session and returns no-store", async () => {
        mocks.auth.mockResolvedValue(investorSession)
        mocks.getInvestorForSession.mockResolvedValue({ id: "inv-1" })
        mocks.getManagedCapitalSummary.mockResolvedValue(summary)

        const response = await GET()

        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
        expect(await response.json()).toEqual({ investor: summary })
        expect(mocks.getInvestorForSession).toHaveBeenCalledWith(investorSession)
        expect(mocks.getManagedCapitalSummary).toHaveBeenCalledWith("inv-1")
    })

    it("does not query summary when the session has no investor mapping", async () => {
        mocks.auth.mockResolvedValue(investorSession)
        mocks.getInvestorForSession.mockResolvedValue(null)

        expect((await GET()).status).toBe(404)
        expect(mocks.getManagedCapitalSummary).not.toHaveBeenCalled()
    })

    it("rejects unauthenticated before identity or summary lookup", async () => {
        mocks.auth.mockResolvedValue(null)

        expect((await GET()).status).toBe(401)
        expect(mocks.getInvestorForSession).not.toHaveBeenCalled()
        expect(mocks.getManagedCapitalSummary).not.toHaveBeenCalled()
    })
})
