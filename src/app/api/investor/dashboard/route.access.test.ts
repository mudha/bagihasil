import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    getInvestorDashboardData: vi.fn(),
    unitFindMany: vi.fn(),
    paymentFindMany: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/investor-data", () => ({
    getInvestorDashboardData: mocks.getInvestorDashboardData,
}))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        unit: { findMany: mocks.unitFindMany },
        paymentHistory: { findMany: mocks.paymentFindMany },
    },
}))

import { GET } from "./route"

describe("GET /api/investor/dashboard access control", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("rejects an authenticated VIEWER before reading investor data", async () => {
        mocks.auth.mockResolvedValue({
            user: { id: "viewer-user", role: "VIEWER" },
        })

        const response = await GET(new NextRequest("http://localhost/api/investor/dashboard"))

        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: "Forbidden" })
        expect(mocks.getInvestorDashboardData).not.toHaveBeenCalled()
        expect(mocks.unitFindMany).not.toHaveBeenCalled()
        expect(mocks.paymentFindMany).not.toHaveBeenCalled()
    })
})
