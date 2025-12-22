import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity-logger"

const transactionSchema = z.object({
    unitId: z.string(),
    transactionCode: z.string().min(1),
    buyDate: z.string().transform((str) => new Date(str)),
    buyPrice: z.number().positive(),
    initialInvestorCapital: z.union([z.string(), z.number()]).transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }).optional(),
    initialManagerCapital: z.union([z.string(), z.number()]).transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }).optional(),
    notes: z.string().optional(),
    buyProofImageUrl: z.string().optional(),
    buyProofDescription: z.string().optional(),
})

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where = status ? { status } : {}

    const transactions = await prisma.transaction.findMany({
        where,
        include: {
            unit: {
                include: {
                    investor: true
                }
            },
            costs: true,
            profitSharing: true,
            paymentHistories: true
        },
        orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(transactions)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const validatedData = transactionSchema.parse(body)

        // Check for active transaction
        const activeTransaction = await prisma.transaction.findFirst({
            where: {
                unitId: validatedData.unitId,
                status: "ON_PROCESS"
            }
        })

        if (activeTransaction) {
            return NextResponse.json({ error: "Unit has an active transaction" }, { status: 400 })
        }

        const transaction = await db.transaction.create({
            data: {
                ...validatedData,
                status: "ON_PROCESS",
            },
        })

        // Log Activity
        await logActivity(
            "CREATE",
            "TRANSACTION",
            transaction.id,
            `Created transaction ${transaction.transactionCode} for unit ${transaction.unitId}`
        )

        return NextResponse.json(transaction)
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

        await prisma.transaction.deleteMany({
            where: {
                id: { in: ids }
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const { ids, paymentStatus } = body

        if (!ids || !Array.isArray(ids) || !paymentStatus) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        await prisma.transaction.updateMany({
            where: {
                id: { in: ids }
            },
            data: {
                paymentStatus
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
