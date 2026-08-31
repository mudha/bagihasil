import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

import {
    transactionDeleteBulkPreReadSelect,
    transactionDeleteRemainingSelect,
    unitDeleteMutationSelect,
} from "../../../lib/legacy-read-selects"

const mocks = vi.hoisted(() => {
    type State = {
        transactions: Record<string, { id: string; unitId: string; status: string }>
        costs: Record<string, number>
        units: Record<string, string>
    }
    let state: State
    let failDelete = false
    let failUnit = false
    let failRemainingLookup = false
    let readArgs: unknown[] = []
    let deleteArgs: unknown[] = []
    let unitArgs: unknown[] = []
    let remainingArgs: unknown[] = []

    const reset = () => {
        state = {
            transactions: {
                "tx-1": { id: "tx-1", unitId: "unit-1", status: "COMPLETED" },
                "tx-2": { id: "tx-2", unitId: "unit-2", status: "ON_PROCESS" },
                "tx-3": { id: "tx-3", unitId: "unit-1", status: "COMPLETED" },
            },
            costs: { "tx-1": 1, "tx-2": 2, "tx-3": 1 },
            units: { "unit-1": "SOLD", "unit-2": "SOLD", "unit-unrelated": "SOLD" },
        }
        failDelete = false
        failUnit = false
        failRemainingLookup = false
        readArgs = []
        deleteArgs = []
        unitArgs = []
        remainingArgs = []
    }

    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const staged: State = structuredClone(state)
        const tx = {
            transaction: {
                findMany: vi.fn(async (args: unknown) => {
                    readArgs.push(args)
                    const ids = (args as { where: { id: { in: string[] } } }).where.id.in
                    return ids.flatMap(id => staged.transactions[id] ? [staged.transactions[id]] : [])
                }),
                deleteMany: vi.fn(async (args: unknown) => {
                    deleteArgs.push(args)
                    if (failDelete) throw new Error("foreign key restriction")
                    const ids = (args as { where: { id: { in: string[] } } }).where.id.in
                    ids.forEach(id => { delete staged.transactions[id] })
                }),
                findFirst: vi.fn(async (args: { where: { unitId: string; status: string }; select: unknown }) => {
                    remainingArgs.push(args)
                    if (failRemainingLookup) throw new Error("remaining lookup failed")
                    const item = Object.values(staged.transactions).find(transaction => transaction.unitId === args.where.unitId && transaction.status === args.where.status)
                    return item ? { id: item.id } : null
                }),
            },
            cost: {
                deleteMany: vi.fn(async ({ where }: { where: { transactionId: string } }) => {
                    delete staged.costs[where.transactionId]
                }),
            },
            unit: {
                update: vi.fn(async (args: { where: { id: string }; data: { status: string }; select: unknown }) => {
                    unitArgs.push(args)
                    if (failUnit) throw new Error("unit update failed")
                    staged.units[args.where.id] = args.data.status
                    return { id: args.where.id }
                }),
            },
        }
        const result = await callback(tx)
        state = staged
        return result
    })

    return {
        auth: vi.fn(),
        prisma: { $transaction: transaction },
        logActivity: vi.fn(),
        reset,
        failDelete: () => { failDelete = true },
        failUnit: () => { failUnit = true },
        failRemainingLookup: () => { failRemainingLookup = true },
        counts: () => ({ ...state, readArgs, deleteArgs, unitArgs, remainingArgs }),
    }
})

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.logActivity }))
vi.mock("@/lib/api-auth", () => ({ canReadAdminData: vi.fn() }))

import { DELETE } from "./route"

const source = () => readFileSync(new URL("./route.ts", import.meta.url), "utf8")
const request = (ids: unknown) => new Request("http://localhost/api/transactions", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
})

beforeEach(() => {
    mocks.reset()
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } })
})

describe("bulk Transaction DELETE atomicity", () => {
    it("uses one serializable boundary, typed pre-read, and preserves response contract", async () => {
        const route = source()
        expect(route).toContain("runSerializableTransaction(prisma")
        expect(route).toContain("await tx.transaction.findMany")
        expect(route).toContain("await tx.transaction.deleteMany")
        expect(route).toContain("await tx.unit.update")
        expect(route).not.toContain("finalizationVersion")
        expect(transactionDeleteBulkPreReadSelect).toEqual({ id: true, unitId: true })
        expect(transactionDeleteRemainingSelect).toEqual({ id: true })
        expect(unitDeleteMutationSelect).toEqual({ id: true })

        const response = await DELETE(request(["tx-1", "tx-2", "tx-1"]))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true })
        expect(mocks.counts()).toMatchObject({
            transactions: { "tx-3": expect.anything() },
            units: { "unit-1": "SOLD", "unit-2": "AVAILABLE", "unit-unrelated": "SOLD" },
        })
        expect(mocks.counts().readArgs[0]).toEqual({
            where: { id: { in: ["tx-1", "tx-2", "tx-1"] } },
            select: transactionDeleteBulkPreReadSelect,
        })
        expect(mocks.counts().deleteArgs).toEqual([
            { where: { id: { in: ["tx-1", "tx-2", "tx-1"] } } },
        ])
        expect(mocks.counts().remainingArgs).toEqual([
            { where: { unitId: "unit-1", status: "COMPLETED" }, select: transactionDeleteRemainingSelect },
            { where: { unitId: "unit-2", status: "COMPLETED" }, select: transactionDeleteRemainingSelect },
        ])
        expect(mocks.counts().unitArgs).toEqual([
            { where: { id: "unit-1" }, data: { status: "SOLD" }, select: unitDeleteMutationSelect },
            { where: { id: "unit-2" }, data: { status: "AVAILABLE" }, select: unitDeleteMutationSelect },
        ])
    })

    it("sets a shared Unit AVAILABLE after deleting its last COMPLETED target", async () => {
        const response = await DELETE(request(["tx-1", "tx-3"]))
        expect(response.status).toBe(200)
        expect(mocks.counts()).toMatchObject({
            transactions: { "tx-2": expect.anything() },
            units: { "unit-1": "AVAILABLE", "unit-2": "SOLD", "unit-unrelated": "SOLD" },
        })
        expect(mocks.counts().unitArgs).toEqual([
            { where: { id: "unit-1" }, data: { status: "AVAILABLE" }, select: unitDeleteMutationSelect },
        ])
    })
    it("rolls back every target and Unit when deleteMany is restricted", async () => {
        mocks.failDelete()
        const response = await DELETE(request(["tx-1", "tx-2"]))
        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({
            transactions: { "tx-1": expect.anything(), "tx-2": expect.anything() },
            costs: { "tx-1": 1, "tx-2": 2 },
            units: { "unit-1": "SOLD", "unit-2": "SOLD" },
        })
    })

    it("rolls back all deletions when one Unit reconciliation fails", async () => {
        mocks.failUnit()
        const response = await DELETE(request(["tx-1", "tx-2"]))
        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({
            transactions: { "tx-1": expect.anything(), "tx-2": expect.anything() },
            costs: { "tx-1": 1, "tx-2": 2 },
            units: { "unit-1": "SOLD", "unit-2": "SOLD" },
        })
    })

    it("rolls back all targets when remaining COMPLETED lookup fails", async () => {
        mocks.failRemainingLookup()
        const response = await DELETE(request(["tx-1", "tx-2"]))
        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({
            transactions: { "tx-1": expect.anything(), "tx-2": expect.anything(), "tx-3": expect.anything() },
            costs: { "tx-1": 1, "tx-2": 2 },
            units: { "unit-1": "SOLD", "unit-2": "SOLD", "unit-unrelated": "SOLD" },
        })
        expect(mocks.counts().unitArgs).toEqual([])
    })

    it("keeps bulk auth and body validation before opening a transaction", async () => {
        mocks.auth.mockResolvedValueOnce(null)
        expect((await DELETE(request([]))).status).toBe(401)
        mocks.auth.mockResolvedValueOnce({ user: { id: "viewer", role: "VIEWER" } })
        expect((await DELETE(request([]))).status).toBe(403)
        mocks.auth.mockResolvedValueOnce({ user: { id: "admin", role: "ADMIN" } })
        expect((await DELETE(request("tx-1"))).status).toBe(400)
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })
})
