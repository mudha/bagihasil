import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const investorSchema = z.object({
    name: z.string().min(1),
    contactInfo: z.string().optional(),
    notes: z.string().optional(),
    bankAccountDetails: z.string().optional(),
    marginPercentage: z.coerce.number().min(0).max(100).optional(),
})

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = investorSchema.parse(body)

        const investor = await prisma.investor.update({
            where: { id },
            data: validatedData
        })

        return NextResponse.json(investor)
    } catch (error) {
        console.error("Error updating investor:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Data tidak valid", details: error.issues }, { status: 400 })
        }
        // Return actual error message for debugging
        return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengupdate pemodal" }, { status: 500 })
    }
}
