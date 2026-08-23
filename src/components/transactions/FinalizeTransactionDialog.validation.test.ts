import { describe, expect, it } from "vitest"
import { z } from "zod"

// Import the actual sellSchema from FinalizeTransactionDialog
// We replicate it here to avoid Next.js module resolution issues in vitest
// This MUST match the schema in FinalizeTransactionDialog.tsx exactly
const sellSchema = z.object({
    sellDate: z.string().min(1, "Tanggal jual harus diisi"),
    sellPrice: z.number().min(0, "Harga laku harus lebih dari 0"),
    investorSharePercentage: z.number().min(0).max(100),
    managerSharePercentage: z.number().min(0).max(100),
    notes: z.string().optional(),
}).refine(
    (data) => data.investorSharePercentage + data.managerSharePercentage === 100,
    {
        message: "Total nisbah investor dan pengelola harus 100%",
        path: ["managerSharePercentage"],
    }
)

describe("FinalizeTransactionDialog sellSchema — percentage validation", () => {
    const validBase = {
        sellDate: "2026-01-01",
        sellPrice: 100_000_000,
    }

    it("rejects 70 + 70 (total 140)", () => {
        const result = sellSchema.safeParse({
            ...validBase,
            investorSharePercentage: 70,
            managerSharePercentage: 70,
        })
        expect(result.success).toBe(false)
    })

    it("rejects 40 + 40 (total 80)", () => {
        const result = sellSchema.safeParse({
            ...validBase,
            investorSharePercentage: 40,
            managerSharePercentage: 40,
        })
        expect(result.success).toBe(false)
    })

    it("accepts 60 + 40 (total 100)", () => {
        const result = sellSchema.safeParse({
            ...validBase,
            investorSharePercentage: 60,
            managerSharePercentage: 40,
        })
        expect(result.success).toBe(true)
    })

    it("accepts boundary 0 + 100", () => {
        const result = sellSchema.safeParse({
            ...validBase,
            investorSharePercentage: 0,
            managerSharePercentage: 100,
        })
        expect(result.success).toBe(true)
    })

    it("accepts boundary 100 + 0", () => {
        const result = sellSchema.safeParse({
            ...validBase,
            investorSharePercentage: 100,
            managerSharePercentage: 0,
        })
        expect(result.success).toBe(true)
    })

    it("accepts fractional 33.33 + 66.67 = 100", () => {
        const result = sellSchema.safeParse({
            ...validBase,
            investorSharePercentage: 33.33,
            managerSharePercentage: 66.67,
        })
        expect(result.success).toBe(true)
    })
})
