import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    canAccessTransaction: vi.fn(),
    transactionFindUnique: vi.fn(),
    transactionUpdate: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/api-auth", () => ({ canAccessTransaction: mocks.canAccessTransaction }))
vi.mock("@/lib/prisma", () => ({
    prisma: {
        transaction: {
            findUnique: mocks.transactionFindUnique,
            update: mocks.transactionUpdate,
        },
        $transaction: vi.fn((fn: (tx: Record<string, unknown>) => unknown) => fn({ transaction: { update: vi.fn() } })),
    },
}))
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }))
vi.mock("@/lib/notifications", () => ({ notifyUnitSold: vi.fn() }))
vi.mock("@/lib/profit-sharing", () => ({ calculateProfitSharing: vi.fn() }))
vi.mock("@/lib/serializable-transaction", () => ({ runSerializableTransaction: vi.fn() }))

import { transactionUpdateSchema } from "./transaction-update-schema"

describe("transactionUpdateSchema — finalization percentage validation", () => {
    const validBase = {
        status: "COMPLETED" as const,
        sellDate: "2026-01-01",
        sellPrice: 100_000_000,
    }

    it("rejects 70 + 70 (total 140)", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: 70,
            managerSharePercentage: 70,
        })
        expect(result.success).toBe(false)
    })

    it("rejects 40 + 40 (total 80)", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: 40,
            managerSharePercentage: 40,
        })
        expect(result.success).toBe(false)
    })

    it("accepts 60 + 40 (total 100)", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: 60,
            managerSharePercentage: 40,
        })
        expect(result.success).toBe(true)
    })

    it("accepts boundary 0 + 100", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: 0,
            managerSharePercentage: 100,
        })
        expect(result.success).toBe(true)
    })

    it("accepts boundary 100 + 0", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: 100,
            managerSharePercentage: 0,
        })
        expect(result.success).toBe(true)
    })

    it("accepts fractional 33.33 + 66.67 = 100", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: 33.33,
            managerSharePercentage: 66.67,
        })
        expect(result.success).toBe(true)
    })

    it("rejects finalization with only investorSharePercentage", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: 40,
        })
        expect(result.success).toBe(false)
    })

    it("rejects finalization with only managerSharePercentage", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            managerSharePercentage: 60,
        })
        expect(result.success).toBe(false)
    })

    it("rejects NaN percentage", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: NaN,
            managerSharePercentage: 60,
        })
        expect(result.success).toBe(false)
    })

    it("rejects Infinity percentage", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: Infinity,
            managerSharePercentage: 60,
        })
        expect(result.success).toBe(false)
    })

    it("rejects malformed numeric string percentage", () => {
        const result = transactionUpdateSchema.safeParse({
            ...validBase,
            investorSharePercentage: "not-a-number",
            managerSharePercentage: "60",
        })
        expect(result.success).toBe(false)
    })

    it("allows update without percentages (non-finalization)", () => {
        const result = transactionUpdateSchema.safeParse({
            notes: "just updating notes",
        })
        expect(result.success).toBe(true)
    })

    it("allows partial percentage update without finalization", () => {
        const result = transactionUpdateSchema.safeParse({
            investorSharePercentage: 60,
        })
        expect(result.success).toBe(true)
    })
})
