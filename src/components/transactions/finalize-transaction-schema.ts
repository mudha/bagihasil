import { z } from "zod"

export const sellSchema = z.object({
    sellDate: z.string().min(1, "Tanggal jual harus diisi"),
    sellPrice: z.number().min(0, "Harga laku harus lebih dari 0"),
    investorSharePercentage: z.number().min(0).max(100),
    managerSharePercentage: z.number().min(0).max(100),
    notes: z.string().optional(),
}).refine(
    (data) => {
        const total = data.investorSharePercentage + data.managerSharePercentage
        const tolerance = Number.EPSILON * Math.max(1, Math.abs(total)) * 4
        return Math.abs(total - 100) <= tolerance
    },
    {
        message: "Total nisbah investor dan pengelola harus 100%",
        path: ["managerSharePercentage"],
    }
)
