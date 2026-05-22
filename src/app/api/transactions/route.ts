import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
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

    // RBAC: Filter khusus untuk role INVESTOR
    // @ts-ignore
    const userRole = session.user?.role
    if (userRole === "INVESTOR") {
        // Cari ID investor berdasarkan user ID
        const investor = await prisma.investor.findUnique({
            where: { userId: session.user?.id }
        })
        
        if (investor) {
            // Tambahkan filter investorId
            where.unit = {
                investorId: investor.id
            }
        } else {
            // Jika data investor tidak ditemukan untuk user ini, return kosong untuk keamanan
            return NextResponse.json([])
        }
    }

    // Admin filter (hanya diproses jika bukan Investor yang melihat data mereka sendiri)
    if (userRole === "ADMIN" || !userRole) {
        if (investorStatus === 'active') {
            where.unit = { ...where.unit, investor: { isActive: true } }
        } else if (investorStatus === 'inactive') {
            where.unit = { ...where.unit, investor: { isActive: false } }
        }
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
        const validatedData = transactionSchema.parse(body)

        // Cek apakah unit sudah punya transaksi aktif
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

        // Atomic: buat transaction + proofs dalam satu DB transaction
        const transaction = await prisma.$transaction(async (tx) => {
            const created = await tx.transaction.create({
                data: {
                    ...transactionData,
                    status: "ON_PROCESS"
                },
            })

            if (proofs && proofs.length > 0) {
                await tx.transactionProof.createMany({
                    data: proofs.map(p => ({
                        transactionId: created.id,
                        proofType: 'BUY',
                        imageUrl: p.imageUrl,
                        description: p.description
                    }))
                })
            }

            return created
        })

        // Log Activity - jangan blokir response jika gagal
        try {
            await logActivity(
                "CREATE",
                "TRANSACTION",
                transaction.id,
                `Created transaction ${transaction.transactionCode} for unit ${transaction.unitId}`
            )
        } catch {
            // Activity log failure tidak membatalkan response
        }

        return NextResponse.json(transaction)
    } catch (error: any) {
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
