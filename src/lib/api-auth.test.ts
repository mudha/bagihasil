import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    investorFindUnique: vi.fn(),
    transactionFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        investor: { findUnique: mocks.investorFindUnique },
        transaction: { findUnique: mocks.transactionFindUnique },
    },
}))

import {
    canAccessInvestor,
    canAccessTransaction,
    canReadAdminData,
    requireAdmin,
    requireRole,
} from "./api-auth"

const session = (role: "ADMIN" | "VIEWER" | "INVESTOR", id = "user-1") => ({
    user: { id, role },
    expires: "2099-01-01T00:00:00.000Z",
})

describe("API role access helpers", () => {
    beforeEach(() => vi.clearAllMocks())

    it.each(["ADMIN", "VIEWER"] as const)("allows %s to read admin-side data", (role) => {
        expect(canReadAdminData(session(role))).toBe(true)
    })

    it("does not allow INVESTOR to read admin-side data", () => {
        expect(canReadAdminData(session("INVESTOR"))).toBe(false)
    })

    it("returns 401 when authentication is absent", async () => {
        mocks.auth.mockResolvedValue(null)

        const result = await requireRole(["ADMIN", "VIEWER"])

        expect("response" in result).toBe(true)
        if ("response" in result && result.response) {
            expect(result.response.status).toBe(401)
        }
    })

    it("returns 403 when VIEWER requests an ADMIN-only operation", async () => {
        mocks.auth.mockResolvedValue(session("VIEWER"))

        const result = await requireAdmin()

        expect("response" in result).toBe(true)
        if ("response" in result && result.response) {
            expect(result.response.status).toBe(403)
        }
    })

    it("allows ADMIN through an ADMIN-only guard", async () => {
        const admin = session("ADMIN")
        mocks.auth.mockResolvedValue(admin)

        await expect(requireAdmin()).resolves.toEqual({ session: admin })
    })

    it("allows an INVESTOR to access only their own investor record", async () => {
        const investorSession = session("INVESTOR", "owner-user")
        mocks.investorFindUnique.mockResolvedValue({ id: "investor-own" })

        await expect(canAccessInvestor(investorSession, "investor-own")).resolves.toBe(true)
        await expect(canAccessInvestor(investorSession, "investor-other")).resolves.toBe(false)
    })

    it("allows an INVESTOR to access only transactions owned by their user", async () => {
        const investorSession = session("INVESTOR", "owner-user")
        mocks.transactionFindUnique
            .mockResolvedValueOnce({ unit: { investor: { userId: "owner-user" } } })
            .mockResolvedValueOnce({ unit: { investor: { userId: "other-user" } } })

        await expect(canAccessTransaction(investorSession, "tx-own")).resolves.toBe(true)
        await expect(canAccessTransaction(investorSession, "tx-other")).resolves.toBe(false)
    })

    it("does not grant unknown roles access to another investor or transaction", async () => {
        const unknown = session("INVESTOR") as ReturnType<typeof session>
        unknown.user.role = "UNKNOWN" as "INVESTOR"

        await expect(canAccessInvestor(unknown, "investor-1")).resolves.toBe(false)
        await expect(canAccessTransaction(unknown, "tx-1")).resolves.toBe(false)
        expect(mocks.investorFindUnique).not.toHaveBeenCalled()
        expect(mocks.transactionFindUnique).not.toHaveBeenCalled()
    })
})
