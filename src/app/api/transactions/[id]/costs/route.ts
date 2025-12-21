import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const costSchema = z.object({
    costType: z.enum([
        "INSPECTION", "TRANSPORT", "MEAL", "TOLL", "ADS",
        "REPAIR", "GAS", "PARKING", "STAMP_DUTY", "BROKER", "OTHER"
    ]),
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
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
