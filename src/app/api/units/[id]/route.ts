import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const unitSchema = z.object({
    investorId: z.string(),
    name: z.string().min(1),
    plateNumber: z.string().min(1),
    code: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
    taxDueDate: z.coerce.date().optional().nullable(),
    status: z.enum(["AVAILABLE", "SOLD", "MAINTENANCE"]).optional().default("AVAILABLE"),
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
        const validatedData = unitSchema.parse(body)

        const unit = await prisma.unit.update({
            where: { id },
            data: validatedData
        })

        return NextResponse.json(unit)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { id } = await params
        await prisma.unit.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
