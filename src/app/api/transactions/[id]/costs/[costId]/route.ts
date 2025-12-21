import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const costSchema = z.object({
    costType: z.string(),
    payer: z.enum(["INVESTOR", "MANAGER"]),
    amount: z.number().positive(),
    description: z.string().optional(),
    proofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional()
})

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string; costId: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { costId } = await params
        const body = await req.json()
        const validatedData = costSchema.parse(body)

        const { proofs, ...data } = validatedData

        const updateData: any = { ...data }
        if (proofs) {
            updateData.proofs = {
                deleteMany: {},
                create: proofs
            }
        }

        const cost = await prisma.cost.update({
            where: { id: costId },
            data: updateData
        })

        return NextResponse.json(cost)
    } catch (error) {
        console.error("Error updating cost:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Failed to update cost" }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string; costId: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { costId } = await params

        await prisma.cost.delete({
            where: { id: costId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting cost:", error)
        return NextResponse.json({ error: "Failed to delete cost" }, { status: 500 })
    }
}
