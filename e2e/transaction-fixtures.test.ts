import { beforeEach, describe, expect, it, vi } from "vitest"
import { withVerifiedE2EDatabase } from "../src/lib/e2e-database-collector"
import {
    cleanupE2ETransactionFixtures,
    countE2ETransactionFixtures,
    getE2ETransactionByCode,
} from "./transaction-fixtures"

vi.mock("../src/lib/e2e-database-collector", () => ({ withVerifiedE2EDatabase: vi.fn() }))
vi.mock("./test-env", () => ({
    loadE2EEnvironment: vi.fn(() => ({ E2E_DATABASE_URL: "[TEST]", E2E_DIRECT_URL: "[TEST]" })),
}))

function deferred() {
    let resolve!: (value?: unknown) => void
    const promise = new Promise((res) => { resolve = res })
    return { promise, resolve }
}

function fakeClient() {
    return {
        transaction: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
        paymentHistory: { deleteMany: vi.fn(), count: vi.fn() },
        profitSharing: { deleteMany: vi.fn(), count: vi.fn() },
        cost: { deleteMany: vi.fn(), count: vi.fn() },
        transactionProof: { deleteMany: vi.fn(), count: vi.fn() },
        activityLog: { deleteMany: vi.fn(), count: vi.fn() },
        unit: { deleteMany: vi.fn() },
        investor: { deleteMany: vi.fn() },
    }
}

const collector = vi.mocked(withVerifiedE2EDatabase)
function route(client: ReturnType<typeof fakeClient>) {
    collector.mockImplementation(async (_env, callback) => callback({ direct: client } as never))
}

describe("E2E transaction fixture safety", () => {
    beforeEach(() => vi.clearAllMocks())

    it("rejects a non-E2E transaction code before collector access", async () => {
        await expect(getE2ETransactionByCode("TRX-PRODUCTION-001"))
            .rejects.toThrow("refusing to inspect a non-E2E transaction code")
        expect(collector).not.toHaveBeenCalled()
    })

    it("awaits child records, logs, then transactions before returning", async () => {
        const client = fakeClient()
        client.transaction.findMany.mockResolvedValueOnce([{ id: "tx-e2e" }])
        const stages = [
            { call: client.paymentHistory.deleteMany, count: 1 },
            { call: client.profitSharing.deleteMany, count: 1 },
            { call: client.cost.deleteMany, count: 1 },
            { call: client.transactionProof.deleteMany, count: 1 },
            { call: client.activityLog.deleteMany, count: 1 },
            { call: client.transaction.deleteMany, count: 1 },
            { call: client.activityLog.deleteMany, count: 2 },
            { call: client.unit.deleteMany, count: 1 },
            { call: client.investor.deleteMany, count: 1 },
        ]
        const gates = stages.map(() => deferred())
        client.paymentHistory.deleteMany.mockReturnValueOnce(gates[0].promise)
        client.profitSharing.deleteMany.mockReturnValueOnce(gates[1].promise)
        client.cost.deleteMany.mockReturnValueOnce(gates[2].promise)
        client.transactionProof.deleteMany.mockReturnValueOnce(gates[3].promise)
        client.activityLog.deleteMany
            .mockReturnValueOnce(gates[4].promise)
            .mockReturnValueOnce(gates[6].promise)
        client.transaction.deleteMany.mockReturnValueOnce(gates[5].promise)
        client.unit.deleteMany.mockReturnValueOnce(gates[7].promise)
        client.investor.deleteMany.mockReturnValueOnce(gates[8].promise)
        route(client)

        const cleanup = cleanupE2ETransactionFixtures()
        for (let index = 0; index < stages.length; index += 1) {
            const stage = stages[index]
            await vi.waitFor(() => expect(stage.call).toHaveBeenCalledTimes(stage.count))
            const next = stages[index + 1]
            if (next) expect(next.call).toHaveBeenCalledTimes(next.count - 1)
            gates[index].resolve()
        }
        await cleanup

        expect(client.transaction.findMany).toHaveBeenCalledWith({
            where: { transactionCode: { startsWith: "E2E-TRX-" } },
            select: { id: true },
        })
        expect(client.activityLog.deleteMany).toHaveBeenCalledWith({
            where: { entity: "TRANSACTION", entityId: { in: ["tx-e2e"] } },
        })
        expect(client.transaction.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["tx-e2e"] } },
        })
    })

    it("counts transactions, all children, and activity logs", async () => {
        const client = fakeClient()
        client.transaction.findMany.mockResolvedValueOnce([{ id: "tx-e2e" }])
        client.transaction.count.mockResolvedValueOnce(1)
        client.paymentHistory.count.mockResolvedValueOnce(2)
        client.profitSharing.count.mockResolvedValueOnce(3)
        client.cost.count.mockResolvedValueOnce(4)
        client.transactionProof.count.mockResolvedValueOnce(5)
        client.activityLog.count.mockResolvedValueOnce(6)
        route(client)

        await expect(countE2ETransactionFixtures()).resolves.toBe(21)
    })
})
