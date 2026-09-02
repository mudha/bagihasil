import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/api-auth"
import { CREATE_COST_TYPE_VALUES } from "@/lib/cost-types"

const costSchema = z.object({
    costType: z.enum(CREATE_COST_TYPE_VALUES),
    payer: z.enum(["INVESTOR", "MANAGER"]),
    amount: z.number().positive(),
    description: z.string().optional(),
    date: z.string().transform((str) => new Date(str)).optional(),
    proofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional()
})

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = costSchema.parse(body)

        const { proofs, ...costData } = validatedData

        const cost = await prisma.cost.create({
            data: {
                transactionId: id,
                ...costData,
                proofs: {
                    create: proofs
                }
            }
        })

        return NextResponse.json(cost)
    } catch (error) {
        console.error("Error creating cost:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
