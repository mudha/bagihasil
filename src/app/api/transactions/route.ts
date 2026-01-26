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
    proofs: z.array(z.object({
        imageUrl: z.string(),
        description: z.string().optional()
    })).optional()
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
        try {
            const fs = require('fs');
            fs.appendFileSync('debug_log.txt', `Payload: ${JSON.stringify(body)}\n`);
        } catch (e) { }
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

        const { proofs, ...transactionData } = validatedData

        try {
            const fs = require('fs');
            fs.appendFileSync('debug_log.txt', `About to create transaction in DB...\n`);
        } catch (e) { }

        const transaction = await db.transaction.create({
            data: {
                ...transactionData,
                status: "ON_PROCESS",
                proofs: proofs && proofs.length > 0 ? {
                    create: proofs.map(p => ({
                        proofType: 'BUY',
                        imageUrl: p.imageUrl,
                        description: p.description
                    }))
                } : undefined
            },
        })

        try {
            const fs = require('fs');
            fs.appendFileSync('debug_log.txt', `Transaction created successfully: ${transaction.id}\n`);
        } catch (e) { }

        // Log Activity - wrap in try-catch to prevent blocking
        try {
            await logActivity(
                "CREATE",
                "TRANSACTION",
                transaction.id,
                `Created transaction ${transaction.transactionCode} for unit ${transaction.unitId}`
            )
        } catch (logError) {
            console.error("Activity logging failed:", logError)
            // Don't fail the request if activity logging fails
        }

        return NextResponse.json(transaction)
    } catch (error: any) {
        console.error("Error creating transaction:", error)
        try {
            const fs = require('fs');
            const errorMsg = error instanceof Error ? error.message + '\n' + error.stack : String(error);
            fs.appendFileSync('debug_log.txt', `Error Occurred: ${errorMsg}\n`);
        } catch (e) {
            console.error("Logger truly failed", e)
        }

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }

        // Handle Prisma unique constraint violation
        if (error.code === 'P2002') {
            return NextResponse.json({
                error: `Kode transaksi sudah digunakan. Silakan tutup dialog dan coba lagi untuk mendapatkan kode baru.`
            }, { status: 400 })
        }

        // Handle other Prisma errors
        if (error.code) {
            return NextResponse.json({
                error: `Database error: ${error.message || 'Unknown error'}`
            }, { status: 500 })
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
