import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
    prisma: { investor: { findMany: mocks.findMany, findUnique: mocks.findUnique } },
}))

import { getManagedCapitalSummaries, getManagedCapitalSummary } from "./managed-capital-read-query"

describe("managed capital read query", () => {
    beforeEach(() => vi.clearAllMocks())

    it("uses one nested investor query with ON_PROCESS transaction filtering", async () => {
        mocks.findMany.mockResolvedValue([])

        await getManagedCapitalSummaries()

        expect(mocks.findMany).toHaveBeenCalledOnce()
        expect(mocks.findMany.mock.calls[0][0]).toMatchObject({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                managedCapitalBalance: true,
                managedCapitalBalanceUpdatedAt: true,
                units: {
                    select: {
                        id: true,
                        transactions: {
                            where: { status: "ON_PROCESS" },
                            select: {
                                status: true,
                                buyPrice: true,
                                initialInvestorCapital: true,
                            },
                        },
                    },
                },
            },
        })
    })

    it("uses one targeted query for self summary", async () => {
        mocks.findUnique.mockResolvedValue(null)

        await getManagedCapitalSummary("inv-1")

        expect(mocks.findUnique).toHaveBeenCalledOnce()
        expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "inv-1" } }))
    })
})
