import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"

const unitSchema = z.object({
    investorId: z.string(),
    name: z.string().min(1),
    plateNumber: z.string().min(1),
    code: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
    taxDueDate: z.coerce.date().optional().nullable(),
    status: z.enum(["AVAILABLE", "SOLD", "MAINTENANCE"]).optional().default("AVAILABLE"),
})

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const units = await prisma.unit.findMany({
        include: { investor: true },
        orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(units)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const validatedData = unitSchema.parse(body)

        const unit = await db.unit.create({
            data: {
                ...validatedData,
                taxDueDate: validatedData.taxDueDate ? new Date(validatedData.taxDueDate) : null
            },
        })

        // Log Activity
        await logActivity(
            "CREATE",
            "UNIT",
            unit.id,
            `Created unit: ${unit.name} (${unit.code})`
        )

        return NextResponse.json(unit)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const { ids } = body

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        await prisma.unit.deleteMany({
            where: {
                id: { in: ids }
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

