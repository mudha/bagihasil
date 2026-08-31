import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { legacyProfitSharingSelect } from "../../../../../lib/legacy-read-selects"

const mocks = vi.hoisted(() => {
    type State = {
        profitSharing: Record<string, unknown>
        transaction: Record<string, unknown>
        payments: Array<{ amount: number }>
        logCount: number
    }

    type AuthResult = { user: { id: string; role: string } } | { response: Response }
    const authResult: AuthResult = { user: { id: "admin", role: "ADMIN" } }
    let state: State
    let failTransactionUpdate = false
    let failProfitUpdate = false
    let p2034Once = false
    let transactionCalls = 0

    const reset = () => {
        state = {
            profitSharing: {
                id: "ps-1",
                transactionId: "tx-1",
                totalCapitalInvestor: 50_000_000,
                totalCapitalManager: 50_000_000,
                totalCapital: 100_000_000,
                netMargin: 10_001,
                investorSharePercentage: 50,
                managerSharePercentage: 50,
                investorProfitAmount: 5_001,
                managerProfitAmount: 5_000,
                calculatedAt: new Date("2026-01-01"),
            },
            transaction: { id: "tx-1", paymentStatus: "UNPAID" },
            payments: [{ amount: 4_901 }],
            logCount: 0,
        }
        failTransactionUpdate = false
        failProfitUpdate = false
        p2034Once = false
        transactionCalls = 0
    }

    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => {
        const callNumber = ++transactionCalls
        const local = structuredClone(state)
        const tx = {
            profitSharing: {
                findUnique: vi.fn(async () => local.profitSharing),
                update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
                    if (failProfitUpdate) throw new Error("profit update failed")
                    local.profitSharing = { ...local.profitSharing, ...data }
                    return local.profitSharing
                }),
            },
            transaction: {
                findUnique: vi.fn(async () => ({
                    ...local.transaction,
                    paymentHistories: local.payments,
                })),
                update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
                    if (failTransactionUpdate) throw new Error("transaction update failed")
                    local.transaction = { ...local.transaction, ...data }
                    return { id: local.transaction.id }
                }),
            },
        }
        const result = await operation(tx)
        if (p2034Once && callNumber === 1) {
            throw Object.assign(new Error("serialization conflict"), { code: "P2034" })
        }
        state = local
        return result
    })

    return {
        authResult,
        requireAdmin: vi.fn(async (): Promise<AuthResult> => authResult),
        prisma: { $transaction: transaction },
        logActivity: vi.fn(async () => { state.logCount += 1 }),
        reset,
        failTransaction: () => { failTransactionUpdate = true },
        failProfit: () => { failProfitUpdate = true },
        enableSerializationConflict: () => { p2034Once = true },
        counts: () => ({
            investorSharePercentage: state.profitSharing.investorSharePercentage,
            managerSharePercentage: state.profitSharing.managerSharePercentage,
            investorProfitAmount: state.profitSharing.investorProfitAmount,
            managerProfitAmount: state.profitSharing.managerProfitAmount,
            paymentStatus: state.transaction.paymentStatus,
            logCount: state.logCount,
            transactionCalls,
        }),
    }
})

vi.mock("@/lib/api-auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.logActivity }))

import { PATCH } from "./route"

const request = (body: unknown) => new Request("http://localhost/api/transactions/tx-1/profit-sharing", {
    method: "PATCH",
    body: JSON.stringify(body),
})
const validBody = { investorSharePercentage: 60, managerSharePercentage: 40 }
const source = () => readFileSync(resolve(__dirname, "route.ts"), "utf8")

describe("PATCH profit-sharing atomicity and compatibility contract", () => {
    beforeEach(() => {
        mocks.reset()
        vi.clearAllMocks()
    })

    it("rolls back ProfitSharing when Transaction payment update fails", async () => {
        mocks.failTransaction()
        const response = (await PATCH(request(validBody), { params: Promise.resolve({ id: "tx-1" }) }))!
        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({
            investorSharePercentage: 50,
            managerSharePercentage: 50,
            investorProfitAmount: 5_001,
            managerProfitAmount: 5_000,
            paymentStatus: "UNPAID",
            logCount: 0,
        })
    })

    it("preserves formula, tolerance, response, and atomic transaction boundary", async () => {
        const response = (await PATCH(request(validBody), { params: Promise.resolve({ id: "tx-1" }) }))!
        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.investorProfitAmount).toBeCloseTo(6_000.6)
        expect(body.managerProfitAmount).toBeCloseTo(4_000.4)
        expect(mocks.counts()).toMatchObject({ paymentStatus: "PARTIAL", logCount: 0 })
        expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" })
    })

    it("does not change Transaction when ProfitSharing update fails", async () => {
        mocks.failProfit()
        const response = (await PATCH(request(validBody), { params: Promise.resolve({ id: "tx-1" }) }))!
        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({ investorSharePercentage: 50, paymentStatus: "UNPAID", logCount: 0 })
    })

    it("rejects invalid total before opening a transaction", async () => {
        const response = (await PATCH(request({ investorSharePercentage: 60, managerSharePercentage: 30 }), { params: Promise.resolve({ id: "tx-1" }) }))!
        expect(response.status).toBe(400)
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("stops unauthorized requests before sensitive queries", async () => {
        mocks.requireAdmin.mockResolvedValueOnce({ response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) })
        const response = (await PATCH(request(validBody), { params: Promise.resolve({ id: "tx-1" }) }))!
        expect(response.status).toBe(403)
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })

    it("retries concurrent PATCH attempts as complete serialized outcomes", async () => {
        mocks.enableSerializationConflict()
        const [first, second] = await Promise.all([
            PATCH(request(validBody), { params: Promise.resolve({ id: "tx-1" }) }),
            PATCH(request(validBody), { params: Promise.resolve({ id: "tx-1" }) }),
        ])
        expect(first!.status).toBe(200)
        expect(second!.status).toBe(200)
        expect(mocks.counts()).toMatchObject({
            investorSharePercentage: 60,
            managerSharePercentage: 40,
            paymentStatus: "PARTIAL",
            transactionCalls: 3,
        })
    })
    it("uses exact typed legacy selections and no pending field", () => {
        const text = source()
        expect(text).toContain('import { runSerializableTransaction } from "../../../../../lib/serializable-transaction"')
        expect(text).toContain("select: legacyProfitSharingSelect")
        expect(text).not.toContain("include: { paymentHistories: true }")
        expect(text).not.toContain("finalizationVersion")
        expect(Object.keys(legacyProfitSharingSelect)).toEqual([
            "id", "transactionId", "totalCapitalInvestor", "totalCapitalManager", "totalCapital",
            "netMargin", "investorSharePercentage", "managerSharePercentage",
            "investorProfitAmount", "managerProfitAmount", "calculatedAt",
        ])
    })
})
