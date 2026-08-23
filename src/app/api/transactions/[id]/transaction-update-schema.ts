import { z } from "zod"

const percentage = z.union([z.string(), z.number()])
    .transform((val: string | number) => typeof val === "string" ? Number(val) : val)
    .refine(Number.isFinite, "Persentase harus berupa angka finite")
    .optional()

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
    investorSharePercentage: percentage,
    managerSharePercentage: percentage,
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
}).superRefine((data, ctx) => {
    const isFinalization = data.status === "COMPLETED"
    const hasInvestor = data.investorSharePercentage !== undefined
    const hasManager = data.managerSharePercentage !== undefined

    if (isFinalization && (!hasInvestor || !hasManager)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Kedua persentase nisbah wajib diisi saat finalisasi",
            path: [!hasInvestor ? "investorSharePercentage" : "managerSharePercentage"],
        })
        return
    }

    if (hasInvestor && hasManager) {
        const total = data.investorSharePercentage! + data.managerSharePercentage!
        const tolerance = Number.EPSILON * Math.max(1, Math.abs(total)) * 4
        if (Math.abs(total - 100) > tolerance) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Total nisbah investor dan pengelola harus 100%",
                path: ["managerSharePercentage"],
            })
        }
    }
})
