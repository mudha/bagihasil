import { beforeEach, describe, expect, it, vi } from "vitest"
import { withVerifiedE2EDatabase } from "../src/lib/e2e-database-collector"
import {
    cleanupE2EFinancialFixtures,
    countE2EFinancialFixtures,
    getE2EUnitByCode,
    seedE2EFinancialFixtures,
} from "./unit-fixtures"

vi.mock("../src/lib/e2e-database-collector", () => ({
    withVerifiedE2EDatabase: vi.fn(),
}))
vi.mock("./test-env", () => ({
    loadE2EEnvironment: vi.fn(() => ({ E2E_DATABASE_URL: "[TEST]", E2E_DIRECT_URL: "[TEST]" })),
}))

function deferred<T = unknown>() {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

function fakeClient() {
    return {
        activityLog: {
            deleteMany: vi.fn(),
            count: vi.fn(),
        },
        unit: {
            deleteMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
        },
        investor: {
            deleteMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
        },
    }
}

const verifiedCollector = vi.mocked(withVerifiedE2EDatabase)

function routeCollectorTo(client: ReturnType<typeof fakeClient>) {
    verifiedCollector.mockImplementation(async (_env, callback) => (
        callback({ direct: client } as never)
    ))
}

describe("E2E financial fixture safety", () => {
    beforeEach(() => vi.clearAllMocks())

    it("rejects a non-E2E code before invoking the verified collector", async () => {
        await expect(getE2EUnitByCode("UNIT-PRODUCTION-001"))
            .rejects.toThrow("refusing to inspect a non-E2E unit code")
        expect(verifiedCollector).not.toHaveBeenCalled()
    })

    it("awaits scoped ActivityLog, Unit, then Investor cleanup serially", async () => {
        const client = fakeClient()
        const logs = deferred()
        const units = deferred()
        const investors = deferred()
        client.activityLog.deleteMany.mockReturnValueOnce(logs.promise)
        client.unit.deleteMany.mockReturnValueOnce(units.promise)
        client.investor.deleteMany.mockReturnValueOnce(investors.promise)
        routeCollectorTo(client)

        const cleanup = cleanupE2EFinancialFixtures()
        await vi.waitFor(() => expect(client.activityLog.deleteMany).toHaveBeenCalledOnce())
        expect(client.unit.deleteMany).not.toHaveBeenCalled()
        logs.resolve(undefined)

        await vi.waitFor(() => expect(client.unit.deleteMany).toHaveBeenCalledOnce())
        expect(client.investor.deleteMany).not.toHaveBeenCalled()
        units.resolve(undefined)

        await vi.waitFor(() => expect(client.investor.deleteMany).toHaveBeenCalledOnce())
        investors.resolve(undefined)
        await cleanup

        expect(client.activityLog.deleteMany).toHaveBeenCalledWith({
            where: { entity: "UNIT", details: { contains: "E2E-UNIT-001" } },
        })
        expect(client.unit.deleteMany).toHaveBeenCalledWith({
            where: { code: { startsWith: "E2E-" } },
        })
        expect(client.investor.deleteMany).toHaveBeenCalledWith({
            where: { name: "E2E Investor Unit Flow" },
        })
    })

    it("does not start investor creation until every cleanup operation settles", async () => {
        const client = fakeClient()
        const logs = deferred()
        const units = deferred()
        const investors = deferred()
        client.activityLog.deleteMany.mockReturnValueOnce(logs.promise)
        client.unit.deleteMany.mockReturnValueOnce(units.promise)
        client.investor.deleteMany.mockReturnValueOnce(investors.promise)
        client.investor.create.mockRejectedValueOnce(new Error("seed failed"))
        routeCollectorTo(client)

        const seed = seedE2EFinancialFixtures()
        await vi.waitFor(() => expect(client.activityLog.deleteMany).toHaveBeenCalledOnce())
        expect(client.investor.create).not.toHaveBeenCalled()
        logs.resolve(undefined)
        await vi.waitFor(() => expect(client.unit.deleteMany).toHaveBeenCalledOnce())
        expect(client.investor.create).not.toHaveBeenCalled()
        units.resolve(undefined)
        await vi.waitFor(() => expect(client.investor.deleteMany).toHaveBeenCalledOnce())
        expect(client.investor.create).not.toHaveBeenCalled()
        investors.resolve(undefined)

        await expect(seed).rejects.toThrow("seed failed")
        expect(client.investor.create).toHaveBeenCalledOnce()
        expect(verifiedCollector).toHaveBeenCalledOnce()
    })

    it("counts ActivityLog, Unit, and exact Investor fixtures through the collector", async () => {
        const client = fakeClient()
        client.activityLog.count.mockResolvedValueOnce(2)
        client.unit.count.mockResolvedValueOnce(3)
        client.investor.count.mockResolvedValueOnce(4)
        routeCollectorTo(client)

        await expect(countE2EFinancialFixtures()).resolves.toBe(9)
        expect(client.activityLog.count).toHaveBeenCalledWith({
            where: { entity: "UNIT", details: { contains: "E2E-UNIT-001" } },
        })
        expect(client.unit.count).toHaveBeenCalledWith({
            where: { code: { startsWith: "E2E-" } },
        })
        expect(client.investor.count).toHaveBeenCalledWith({
            where: { name: "E2E Investor Unit Flow" },
        })
    })
})
