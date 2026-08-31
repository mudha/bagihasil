import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

import {
    transactionDeleteMutationSelect,
    transactionDeletePreReadSelect,
    transactionDeleteRemainingSelect,
    unitDeleteMutationSelect,
} from "../../../../lib/legacy-read-selects"

const mocks = vi.hoisted(() => {
    type State = {
        transactions: Record<string, { id: string; transactionCode: string; unitId: string; status: string }>
        costs: Record<string, number>
        units: Record<string, string>
        paymentHistory: Record<string, number>
        logCount: number
    }
    let state: State
    let failUnit = false
    let failTransaction = false
    let failPaymentRestriction = false
    let p2034Once = false
    let failRemainingLookup = false
    let transactionCalls = 0
    let transactionReadArgs: unknown[] = []
    let costDeleteArgs: unknown[] = []
    let transactionDeleteArgs: unknown[] = []
    let unitUpdateArgs: unknown[] = []
    let remainingArgs: unknown[] = []

    const reset = () => {
        state = {
            transactions: { "tx-1": { id: "tx-1", transactionCode: "TRX-001", unitId: "unit-1", status: "COMPLETED" } },
            costs: { "tx-1": 2 },
            units: { "unit-1": "SOLD", "unit-unrelated": "SOLD" },
            paymentHistory: { "tx-1": 0 },
            logCount: 0,
        }
        failUnit = false
        failTransaction = false
        failPaymentRestriction = false
        p2034Once = false
        failRemainingLookup = false
        transactionCalls = 0
        transactionReadArgs = []
        costDeleteArgs = []
        transactionDeleteArgs = []
        unitUpdateArgs = []
        remainingArgs = []
    }

    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        transactionCalls += 1
        const staged: State = structuredClone(state)
        const tx = {
            transaction: {
                findUnique: vi.fn(async (args: unknown) => {
                    transactionReadArgs.push(args)
                    const item = staged.transactions[args && typeof args === "object" && "where" in args
                        ? ((args as { where: { id: string } }).where.id)
                        : ""]
                    if (!item) return null
                    if (staged.paymentHistory[item.id] > 0 || failPaymentRestriction) {
                        return { ...item }
                    }
                    return { ...item }
                }),
                findFirst: vi.fn(async (args: unknown) => {
                    remainingArgs.push(args)
                    if (failRemainingLookup) throw new Error("remaining lookup failed")
                    const { where } = args as { where: { unitId: string; status: string } }
                    const item = Object.values(staged.transactions).find(transaction => transaction.unitId === where.unitId && transaction.status === where.status)
                    return item ? { id: item.id } : null
                }),
                delete: vi.fn(async (args: unknown) => {
                    transactionDeleteArgs.push(args)
                    if (failTransaction || failPaymentRestriction) throw new Error("foreign key restriction")
                    const id = (args as { where: { id: string } }).where.id
                    delete staged.transactions[id]
                }),
            },
            cost: {
                deleteMany: vi.fn(async (args: unknown) => {
                    costDeleteArgs.push(args)
                    const id = (args as { where: { transactionId: string } }).where.transactionId
                    delete staged.costs[id]
                }),
            },
            unit: {
                update: vi.fn(async (args: unknown) => {
                    unitUpdateArgs.push(args)
                    if (failUnit) throw new Error("unit update failed")
                    const input = args as { where: { id: string }; data: { status: string } }
                    staged.units[input.where.id] = input.data.status
                    return { id: input.where.id }
                }),
            },
        }
        const result = await callback(tx)
        if (p2034Once) {
            p2034Once = false
            state.transactions["tx-remaining"] = { id: "tx-remaining", transactionCode: "TRX-002", unitId: "unit-1", status: "COMPLETED" }
            throw Object.assign(new Error("serialization conflict"), { code: "P2034" })
        }
        state = staged
        return result
    })

    return {
        auth: vi.fn(),
        prisma: {
            $transaction: transaction,
            transaction: { findUnique: vi.fn() },
        },
        logActivity: vi.fn(async () => { state.logCount += 1 }),
        reset,
        failUnit: () => { failUnit = true },
        failTransaction: () => { failTransaction = true },
        failPaymentRestriction: () => { failPaymentRestriction = true },
        failRemainingLookup: () => { failRemainingLookup = true },
        enableP2034: () => { p2034Once = true },
        addRemaining: (status: string) => { state.transactions["tx-remaining"] = { id: "tx-remaining", transactionCode: "TRX-002", unitId: "unit-1", status } },
        addUnrelated: () => { state.transactions["tx-unrelated"] = { id: "tx-unrelated", transactionCode: "TRX-999", unitId: "unit-unrelated", status: "ON_PROCESS" } },
        counts: () => ({ ...state, transactionCalls, transactionReadArgs, costDeleteArgs, transactionDeleteArgs, unitUpdateArgs, remainingArgs }),
    }
})

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.logActivity }))
vi.mock("@/lib/profit-sharing", () => ({ calculateProfitSharing: vi.fn() }))
vi.mock("@/lib/notifications", () => ({ notifyUnitSold: vi.fn() }))
vi.mock("@/lib/api-auth", () => ({ canAccessTransaction: vi.fn(async () => true) }))

import { DELETE } from "./route"

const source = () => readFileSync(new URL("./route.ts", import.meta.url), "utf8")
const params = Promise.resolve({ id: "tx-1" })

beforeEach(() => {
    mocks.reset()
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } })
})

describe("single Transaction DELETE atomicity", () => {
    it("uses one transaction with typed least-data reads and post-commit logging", async () => {
        const route = source()
        const body = route.slice(route.indexOf("export async function DELETE"))
        expect(body).toContain("runSerializableTransaction(prisma")
        expect(body).toContain("await tx.transaction.findUnique")
        expect(body).toContain("await tx.cost.deleteMany")
        expect(body).toContain("await tx.transaction.delete")
        expect(body).toContain("await tx.unit.update")
        expect(body).not.toContain("include: { costs: true }")
        expect(body).not.toContain("finalizationVersion")
        expect(body.indexOf("await logActivity")).toBeGreaterThan(body.indexOf("runSerializableTransaction"))
        expect(transactionDeletePreReadSelect).toEqual({ transactionCode: true, unitId: true })
        expect(transactionDeleteMutationSelect).toEqual({ id: true })
        expect(transactionDeleteRemainingSelect).toEqual({ id: true })
        expect(unitDeleteMutationSelect).toEqual({ id: true })

    })

    it("rolls back costs and Unit when Transaction delete is restricted", async () => {
        mocks.failPaymentRestriction()
        const response = await DELETE(new Request("http://localhost/api/transactions/tx-1", { method: "DELETE" }), { params })
        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({ costs: { "tx-1": 2 }, transactions: { "tx-1": expect.anything() }, units: { "unit-1": "SOLD" }, logCount: 0 })
    })

    it("rolls back all rows and does not log when Unit reconciliation fails", async () => {
        mocks.failUnit()
        const response = await DELETE(new Request("http://localhost/api/transactions/tx-1", { method: "DELETE" }), { params })
        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({ costs: { "tx-1": 2 }, transactions: { "tx-1": expect.anything() }, units: { "unit-1": "SOLD" }, logCount: 0 })
    })

    it("rolls back all rows when remaining COMPLETED lookup fails", async () => {
        mocks.failRemainingLookup()
        mocks.addUnrelated()
        const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params })
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: "Failed to delete transaction" })
        expect(mocks.counts()).toMatchObject({
            transactions: { "tx-1": expect.anything(), "tx-unrelated": { unitId: "unit-unrelated", status: "ON_PROCESS" } },
            costs: { "tx-1": 2 },
            units: { "unit-1": "SOLD", "unit-unrelated": "SOLD" },
            logCount: 0,
            transactionCalls: 1,
        })
    })
    it("returns the existing response and reconciles Unit only after commit", async () => {
        const response = await DELETE(new Request("http://localhost/api/transactions/tx-1", { method: "DELETE" }), { params })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true })
        expect(mocks.counts()).toMatchObject({ transactions: {}, costs: {}, units: { "unit-1": "AVAILABLE", "unit-unrelated": "SOLD" }, logCount: 1 })
        expect(mocks.counts().transactionReadArgs[0]).toEqual({ where: { id: "tx-1" }, select: transactionDeletePreReadSelect })
        expect(mocks.counts().transactionDeleteArgs[0]).toEqual({ where: { id: "tx-1" }, select: transactionDeleteMutationSelect })
        expect(mocks.counts().remainingArgs[0]).toEqual({ where: { unitId: "unit-1", status: "COMPLETED" }, select: transactionDeleteRemainingSelect })
        expect(mocks.counts().unitUpdateArgs[0]).toEqual({ where: { id: "unit-1" }, data: { status: "AVAILABLE" }, select: unitDeleteMutationSelect })
    })

    it("keeps Unit SOLD when a remaining COMPLETED Transaction exists", async () => {
        mocks.addRemaining("COMPLETED")
        const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params })
        expect(response.status).toBe(200)
        expect(mocks.counts()).toMatchObject({ units: { "unit-1": "SOLD" }, transactions: { "tx-remaining": expect.anything() } })
        expect(mocks.counts().unitUpdateArgs[0]).toEqual({ where: { id: "unit-1" }, data: { status: "SOLD" }, select: unitDeleteMutationSelect })
    })

    it("sets Unit AVAILABLE when remaining Transactions are only ON_PROCESS", async () => {
        mocks.addRemaining("ON_PROCESS")
        const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params })
        expect(response.status).toBe(200)
        expect(mocks.counts()).toMatchObject({ units: { "unit-1": "AVAILABLE" }, transactions: { "tx-remaining": expect.anything() } })
    })
    it("preserves auth and nonexistent response contracts", async () => {
        mocks.auth.mockResolvedValueOnce(null)
        expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), { params })).status).toBe(401)
        mocks.auth.mockResolvedValueOnce({ user: { id: "viewer", role: "VIEWER" } })
        expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), { params })).status).toBe(403)
        mocks.auth.mockResolvedValueOnce({ user: { id: "admin", role: "ADMIN" } })
        const missing = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: "missing" }) })
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({ error: "Transaction not found" })
    })

    it("retries commit conflict without publishing an incomplete delete", async () => {
        mocks.enableP2034()
        const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params })
        expect(response.status).toBe(200)
        expect(mocks.counts()).toMatchObject({
            transactions: { "tx-remaining": { status: "COMPLETED" } },
            costs: {},
            units: { "unit-1": "SOLD" },
            logCount: 1,
            transactionCalls: 2,
        })
        expect(mocks.counts().remainingArgs).toHaveLength(2)
        expect(mocks.counts().unitUpdateArgs.map((args) => (args as { data: { status: string } }).data.status)).toEqual(["AVAILABLE", "SOLD"])
    })
})
