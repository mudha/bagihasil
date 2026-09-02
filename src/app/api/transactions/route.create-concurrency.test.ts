import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
    legacyTransactionScalarSelect,
    transactionCreateActiveCheckSelect,
    transactionCreateResponseSelect,
} from "../../../lib/legacy-read-selects"

const mocks = vi.hoisted(() => {
    let committedActive = false
    let activeCount = 0
    let proofCount = 0
    let activityLogCount = 0
    let readCount = 0
    let concurrentChecks = false
    let failCreate = false
    let failUnexpected = false
    let failProof = false
    let createArgs: Record<string, unknown> | null = null
    let lastError: unknown = null
    let releaseReads!: () => void
    let readsReleased: Promise<void>

    const reset = () => {
        committedActive = false
        activeCount = 0
        proofCount = 0
        activityLogCount = 0
        readCount = 0
        concurrentChecks = false
        failCreate = false
        failUnexpected = false
        failProof = false
        createArgs = null
        lastError = null
        readsReleased = new Promise(resolve => { releaseReads = resolve })
    }

    const activeCheck = vi.fn(async () => {
        readCount += 1
        if (concurrentChecks && readCount === 2) releaseReads()
        if (concurrentChecks && readCount <= 2) await readsReleased
        return committedActive ? { id: "committed-active" } : null
    })

    const outsideActiveCheck = vi.fn((...args: Parameters<typeof activeCheck>) => activeCheck(...args))

    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => {
        let createdInAttempt = false
        let proofsInAttempt = 0
        const tx = {
            transaction: {
                findFirst: activeCheck,
                create: async (args: { data: Record<string, unknown>; select: Record<string, unknown> }) => {
                    createArgs = args
                    if ("finalizationVersion" in args.select) {
                        throw new Error("selection requested pending finalizationVersion")
                    }
                    if (failCreate) {
                        throw Object.assign(new Error("create failed"), { code: "P2002" })
                    }
                    if (failUnexpected) {
                        throw Object.assign(new Error("The column finalizationVersion does not exist"), { code: "P2022" })
                    }
                    createdInAttempt = true
                    return {
                        id: `transaction-${activeCount + 1}`,
                        ...args.data,
                        transactionCode: args.data.transactionCode,
                        unitId: args.data.unitId,
                    }
                },
            },
            transactionProof: {
                createMany: async ({ data }: { data: unknown[] }) => {
                    if (failProof) throw new Error("proof failed")
                    proofsInAttempt += data.length
                },
            },
        }
        let result: unknown
        try {
            result = await operation(tx)
        } catch (error) {
            lastError = error
            throw error
        }
        if (createdInAttempt) {
            if (committedActive) {
                throw Object.assign(new Error("serialization conflict"), { code: "P2034" })
            }
            committedActive = true
            activeCount += 1
            proofCount += proofsInAttempt
        }
        return result
    })

    return {
        auth: vi.fn(),
        transactionFindFirst: outsideActiveCheck,
        prisma: {
            $transaction: transaction,
            transaction: { findFirst: outsideActiveCheck },
        },
        logActivity: vi.fn(async () => { activityLogCount += 1 }),
        reset,
        enableConcurrency: () => { concurrentChecks = true },
        failCreate: () => { failCreate = true },
        failUnexpected: () => { failUnexpected = true },
        failProof: () => { failProof = true },
        counts: () => ({ activeCount, proofCount, activityLogCount, createArgs, lastError }),
    }
})

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.logActivity }))
vi.mock("@/lib/api-auth", () => ({ canReadAdminData: () => false }))

import { POST } from "./route"

const validBody = (transactionCode: string) => ({
    unitId: "unit-1",
    transactionCode,
    buyDate: "2026-08-31T00:00:00.000Z",
    buyPrice: 100_000_000,
    initialInvestorCapital: 50_000_000,
    initialManagerCapital: 50_000_000,
    proofs: [{ imageUrl: `https://example.test/${transactionCode}.jpg`, description: "BUY" }],
})

const readSource = (relativePath: string) =>
    readFileSync(resolve(__dirname, relativePath), "utf8")

describe("POST /api/transactions pre-migration and concurrency contract", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.reset()
        mocks.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } })
    })

    it("uses the serializable boundary and typed selections for the POST flow", () => {
        const route = readSource("route.ts")
        const helper = readSource("../../../lib/legacy-read-selects.ts")
        const post = route.slice(route.indexOf("export async function POST"))

        expect(route).toContain('import { runSerializableTransaction } from "../../../lib/serializable-transaction"')
        expect(post).toContain("runSerializableTransaction(prisma")
        expect(Object.keys(transactionCreateActiveCheckSelect)).toEqual(["id"])
        expect(transactionCreateResponseSelect).toEqual({
            id: true,
            unitId: true,
            transactionCode: true,
            buyDate: true,
            buyPrice: true,
            initialInvestorCapital: true,
            initialManagerCapital: true,
            sellDate: true,
            sellPrice: true,
            status: true,
            profitStatus: true,
            lossBearer: true,
            paymentStatus: true,
            notes: true,
            buyProofImageUrl: true,
            buyProofDescription: true,
            sellProofImageUrl: true,
            sellProofDescription: true,
            createdAt: true,
            updatedAt: true,
        })
        expect(Object.keys(transactionCreateResponseSelect)).toEqual(Object.keys(legacyTransactionScalarSelect))
        expect(Object.keys(transactionCreateResponseSelect)).not.toContain("finalizationVersion")
        expect(post).not.toMatch(/const activeTransaction = await prisma\.transaction\.findFirst/)
        expect(post).toContain("select: transactionCreateActiveCheckSelect")
        expect(post).toContain("select: transactionCreateResponseSelect")
        expect(post).not.toContain("finalizationVersion")
        const activeIndex = post.indexOf("tx.transaction.findFirst")
        const createIndex = post.indexOf("tx.transaction.create")
        const proofIndex = post.indexOf("tx.transactionProof.createMany")
        const activityIndex = post.indexOf("logActivity")
        expect(activeIndex).toBeGreaterThanOrEqual(0)
        expect(createIndex).toBeGreaterThan(activeIndex)
        expect(proofIndex).toBeGreaterThan(createIndex)
        expect(activityIndex).toBeGreaterThan(post.indexOf("runSerializableTransaction"))
        expect(helper).toContain("export const transactionCreateActiveCheckSelect")
        expect(helper).toContain("export const transactionCreateResponseSelect")
        expect(helper).not.toContain("finalizationVersion: true")
    })

    it("keeps auth and validation before any transaction or sensitive active check", () => {
        const route = readSource("route.ts")
        const post = route.slice(route.indexOf("export async function POST"))
        const authIndex = post.indexOf('if (!session)')
        const roleIndex = post.indexOf('if (session.user.role !== "ADMIN")')
        const parseIndex = post.indexOf("transactionSchema.parse(body)")
        const transactionIndex = post.indexOf("runSerializableTransaction")
        const activeCheckIndex = post.indexOf("transactionCreateActiveCheckSelect")

        expect(authIndex).toBeGreaterThanOrEqual(0)
        expect(roleIndex).toBeGreaterThan(authIndex)
        expect(parseIndex).toBeGreaterThan(roleIndex)
        expect(transactionIndex).toBeGreaterThan(parseIndex)
        expect(activeCheckIndex).toBeGreaterThan(transactionIndex)
    })

    it("allows exactly one active transaction and rolls no proof/log side effect into the conflict", async () => {
        mocks.enableConcurrency()
        const [first, second] = await Promise.all([
            POST(new Request("http://localhost/api/transactions", { method: "POST", body: JSON.stringify(validBody("TRX-1")) })),
            POST(new Request("http://localhost/api/transactions", { method: "POST", body: JSON.stringify(validBody("TRX-2")) })),
        ])
        const statuses = [first.status, second.status].sort()

        expect(statuses).toEqual([200, 400])
        expect(mocks.counts()).toMatchObject({ activeCount: 1, proofCount: 1, activityLogCount: 1 })
        expect(mocks.prisma.$transaction).toHaveBeenCalled()
        expect(mocks.transactionFindFirst).not.toHaveBeenCalled()
    })

    it("rolls back the transaction and proof when proof creation fails", async () => {
        mocks.failProof()

        const response = await POST(new Request("http://localhost/api/transactions", { method: "POST", body: JSON.stringify(validBody("TRX-PROOF-FAIL")) }))

        expect(response.status).toBe(500)
        expect(mocks.counts()).toMatchObject({ activeCount: 0, proofCount: 0, activityLogCount: 0 })
    })

    it("does not create a proof when transaction creation fails with P2002", async () => {
        mocks.failCreate()

        const response = await POST(new Request("http://localhost/api/transactions", { method: "POST", body: JSON.stringify(validBody("TRX-DUPLICATE")) }))
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error).toContain("Kode transaksi sudah digunakan")
        expect(mocks.counts()).toMatchObject({ activeCount: 0, proofCount: 0, activityLogCount: 0 })
    })

    it("passes the exact legacy selection to create and hides unexpected database details", async () => {
        mocks.failUnexpected()
        const response = await POST(new Request("http://localhost/api/transactions", { method: "POST", body: JSON.stringify(validBody("TRX-SCHEMA")) }))
        const body = await response.json()
        const createArgs = mocks.counts().createArgs as { select: Record<string, unknown> }

        expect(response.status).toBe(500)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
        expect(createArgs.select).toEqual(transactionCreateResponseSelect)
        expect(body).toEqual({ error: "Gagal membuat transaksi" })
        expect(JSON.stringify(body)).not.toMatch(/finalizationVersion|prisma|column|SQL|stack/i)
        expect(mocks.counts()).toMatchObject({ activeCount: 0, proofCount: 0, activityLogCount: 0 })
    })

    it("rejects auth and validation failures before opening a transaction", async () => {
        mocks.auth.mockResolvedValueOnce(null)
        const unauthorized = await POST(new Request("http://localhost/api/transactions", { method: "POST", body: "{}" }))
        expect(unauthorized.status).toBe(401)

        mocks.auth.mockResolvedValueOnce({ user: { id: "viewer", role: "VIEWER" } })
        const forbidden = await POST(new Request("http://localhost/api/transactions", { method: "POST", body: "{}" }))
        expect(forbidden.status).toBe(403)

        const invalid = await POST(new Request("http://localhost/api/transactions", { method: "POST", body: JSON.stringify({ unitId: "unit-1" }) }))
        expect(invalid.status).toBe(400)
        expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    })
})
