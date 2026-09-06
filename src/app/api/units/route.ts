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
    code: z.string().min(1).optional(), // client hint; server is authoritative
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

// ─── Authoritative code generation (server-side) ──────────────

const MAX_RETRY = 5

function isUnitCodeConflict(error: unknown): boolean {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false

    const target = "meta" in error && error.meta && typeof error.meta === "object" && "target" in error.meta
        ? error.meta.target
        : undefined

    if (Array.isArray(target)) return target.includes("code")
    return typeof target === "string" && /(^|[^a-z])code([^a-z]|$)/i.test(target)
}

/**
 * Generate the next unique unit code for a given investor prefix.
 * Reads existing codes, finds the max suffix, and increments.
 * Returns the code string; does NOT create the unit.
 */
async function generateNextCode(investorId?: string | null): Promise<string> {
    let prefix = "UNT"

    if (investorId && investorId !== "all") {
        const investor = await prisma.investor.findUnique({
            where: { id: investorId },
            select: { name: true },
        })
        if (investor?.name) {
            const rawPrefix = investor.name.split(" ")[0].substring(0, 3).toUpperCase()
            prefix = `UNT-${rawPrefix}`
        }
    }

    const existingUnits = await prisma.unit.findMany({
        where: { code: { startsWith: prefix } },
        select: { code: true },
    })

    let maxSuffix = 0
    for (const unit of existingUnits) {
        if (unit.code) {
            const match = unit.code.match(/(\d+)$/)
            if (match) {
                const num = parseInt(match[1])
                if (!isNaN(num) && num > maxSuffix) maxSuffix = num
            }
        }
    }

    const suffix = String(maxSuffix + 1).padStart(4, "0")
    return `${prefix}-${suffix}`
}

// ─── Routes ───────────────────────────────────────────────────

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

        // Server is authoritative for code allocation.
        // Client-provided code is ignored — the server generates it.
        let lastError: any = null

        for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
            const code = await generateNextCode(validatedData.investorId)

            try {
                const unit = await prisma.unit.create({
                    data: {
                        ...validatedData,
                        code, // always server-generated
                        taxDueDate: validatedData.taxDueDate ? new Date(validatedData.taxDueDate) : null
                    },
                })

                await logActivity(
                    "CREATE",
                    "UNIT",
                    unit.id,
                    `Created unit: ${unit.name} (${unit.code})`
                )

                return NextResponse.json(unit)
            } catch (err: any) {
                lastError = err

                // P2002 = unique constraint violation → race lost, retry with next code
                if (isUnitCodeConflict(err) && attempt < MAX_RETRY) {
                    continue
                }

                if (isUnitCodeConflict(err)) {
                    break
                }

                // Non-code conflicts and all other errors are not retryable.
                console.error("Error creating unit:", err)
                return NextResponse.json(
                    { error: "Internal Server Error" },
                    { status: 500, headers: { "Cache-Control": "private, no-store" } }
                )
            }
        }

        // Exhausted all retries
        console.error("Unit code allocation exhausted after retries:", lastError)
        return NextResponse.json(
            { error: "Kode unit sedang digunakan oleh proses lain. Silakan coba lagi." },
            { status: 409, headers: { "Cache-Control": "private, no-store" } }
        )
    } catch (error: any) {
        console.error("Error creating unit:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({
            error: error.message || "Internal Server Error",
            details: error.code
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
