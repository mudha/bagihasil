import { z } from "zod"

export const transactionUpdateSchema = z.object({
    unitId: z.string().optional(),
    transactionCode: z.string().min(1).optional(),
    buyDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
    buyPrice: z.union([z.string(), z.number()]).transform((val) => typeof val === "string" ? Number(val) : val).optional(),
    initialInvestorCapital: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === "string" ? Number(val) : val
    }),
    initialManagerCapital: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === "string" ? Number(val) : val
    }),
    notes: z.string().optional(),
    status: z.enum(["ON_PROCESS", "COMPLETED"]).optional(),
    sellDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
    sellPrice: z.union([z.string(), z.number()]).transform((val) => typeof val === "string" ? Number(val) : val).optional(),
    investorSharePercentage: z.union([z.string(), z.number()]).transform((val) => typeof val === "string" ? Number(val) : val).optional(),
    managerSharePercentage: z.union([z.string(), z.number()]).transform((val) => typeof val === "string" ? Number(val) : val).optional(),
    buyProofImageUrl: z.string().nullable().optional(),
    buyProofDescription: z.string().nullable().optional(),
    sellProofImageUrl: z.string().nullable().optional(),
    sellProofDescription: z.string().nullable().optional(),
    buyProofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional(),
    sellProofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional(),
}).refine(
    (data) => {
        const hasBoth =
            data.investorSharePercentage !== undefined
            && data.managerSharePercentage !== undefined
        if (!hasBoth) return true
        return data.investorSharePercentage! + data.managerSharePercentage! === 100
    },
    {
        message: "Total nisbah investor dan pengelola harus 100%",
        path: ["managerSharePercentage"],
    }
)
