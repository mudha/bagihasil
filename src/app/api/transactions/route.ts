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
    const investorStatus = searchParams.get('investorStatus')

    const where: any = {}
    if (status) {
        where.status = status
    }

    if (investorStatus === 'active') {
        where.unit = { investor: { isActive: true } }
    } else if (investorStatus === 'inactive') {
        where.unit = { investor: { isActive: false } }
    }

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
            paymentHistories: true,
            _count: {
                select: {
                    paymentHistories: true
                }
            }
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

            // Validate data consistency before DB call
            if (proofs && proofs.length > 0) {
                fs.appendFileSync('debug_log.txt', `Proofs to create: ${JSON.stringify(proofs)}\n`);
            }
        } catch (e) { }

        let transaction;
        try {
            const createData = {
                ...transactionData,
                status: "ON_PROCESS"
            };

            try {
                const fs = require('fs');
                fs.appendFileSync('debug_log.txt', `Creating Transaction Base with: ${JSON.stringify(createData)}\n`);
            } catch (e) { }

            transaction = await db.transaction.create({
                data: createData,
            })

            try {
                const fs = require('fs');
                fs.appendFileSync('debug_log.txt', `Transaction Base Created. ID: ${transaction.id}\n`);
            } catch (e) { }

            if (proofs && proofs.length > 0) {
                try {
                    const fs = require('fs');
                    fs.appendFileSync('debug_log.txt', `Creating ${proofs.length} proofs...\n`);
                } catch (e) { }

                await db.transactionProof.createMany({
                    data: proofs.map(p => ({
                        transactionId: transaction.id,
                        proofType: 'BUY',
                        imageUrl: p.imageUrl,
                        description: p.description
                    }))
                })
                try {
                    const fs = require('fs');
                    fs.appendFileSync('debug_log.txt', `Proofs created successfully.\n`);
                } catch (e) { }
            }

        } catch (dbError: any) {
            try {
                const fs = require('fs');
                // Use a safer error logging to avoid source-map crashes
                const safeMsg = dbError.code ? `Code: ${dbError.code}, Message: ${dbError.message}` : String(dbError);
                fs.appendFileSync('debug_log.txt', `CRITICAL DB ERROR: ${safeMsg}\n`);
            } catch (e) { }

            // If transaction was created but proofs failed, we might want to delete the transaction? 
            // For now, just let it throw, but user might end up with partial state. 
            // Ideally we use interactive transaction, but let's debug first.
            throw dbError;
        }

        try {
            const fs = require('fs');
            fs.appendFileSync('debug_log.txt', `Transaction completed process: ${transaction.id}\n`);
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
            // DO NOT use console.error - source map crash
            // Don't fail the request if activity logging fails
        }

        return NextResponse.json(transaction)
    } catch (error: any) {
        // DO NOT use console.error - it triggers source map crash
        try {
            const fs = require('fs');
            const errorMsg = `Message: ${error?.message || 'Unknown'}, Code: ${error?.code || 'N/A'}`;
            fs.appendFileSync('debug_log.txt', `Outer Error: ${errorMsg}\n`);
        } catch (e) {
            // Logging failed, continue
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
