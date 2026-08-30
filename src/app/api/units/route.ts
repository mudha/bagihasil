import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { logActivity } from "@/lib/activity-logger"
import { canReadAdminData, getInvestorForSession } from "@/lib/api-auth"
import { legacyUnitWithInvestorSelect } from "../../../lib/legacy-read-selects"


const unitSchema = z.object({
    investorId: z.string(),
    name: z.string().min(1),
    plateNumber: z.string().min(1),
    code: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
    taxDueDate: z.coerce.date().optional().nullable(),
    status: z.enum(["AVAILABLE", "SOLD", "MAINTENANCE"]).optional().default("AVAILABLE"),
    vehicleType: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    year: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    kilometer: z.number().optional().nullable(),
    stnkImageUrl: z.string().optional().nullable(),
    engineNumber: z.string().optional().nullable(),
    chassisNumber: z.string().optional().nullable(),
})

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const investorStatus = searchParams.get('investorStatus')

    const where: any = {}

    if (session.user.role === "INVESTOR") {
        const investor = await getInvestorForSession(session)
        if (!investor) return NextResponse.json([])
        where.investorId = investor.id
    } else if (canReadAdminData(session)) {
        if (investorStatus === 'active') {
            where.investor = { isActive: true }
        } else if (investorStatus === 'inactive') {
            where.investor = { isActive: false }
        }
    } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const units = await prisma.unit.findMany({
        where,
        select: legacyUnitWithInvestorSelect,
        orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(units)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const validatedData = unitSchema.parse(body)

        const unit = await prisma.unit.create({

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
    } catch (error: any) {
        console.error("Error creating unit:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }

        // Return actual error message for debugging (safe enough for admin internal app)
        return NextResponse.json({
            error: error.message || "Internal Server Error",
            details: error.code // Prisma error code if available
        }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

