import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canReadAdminData, getInvestorForSession } from "@/lib/api-auth"
import { legacyInvestorSelect } from "../../../lib/legacy-read-selects"

const investorSchema = z.object({
    name: z.string().min(1),
    contactInfo: z.string().optional(),
    notes: z.string().optional(),
    bankAccountDetails: z.string().optional(),
    marginPercentage: z.union([z.string(), z.number()])
        .transform(val => Number(val))
        .refine(val => val >= 0 && val <= 100, { message: "Persentase harus antara 0 - 100" })
        .default(50),
    userId: z.string().optional().nullable(),
})

export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role === "INVESTOR") {
        const investor = await getInvestorForSession(session)
        if (!investor) return NextResponse.json([])

        const ownInvestor = await prisma.investor.findMany({
            where: { id: investor.id },
            select: legacyInvestorSelect,
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(ownInvestor)
    }

    if (!canReadAdminData(session)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const investors = await prisma.investor.findMany({
        select: legacyInvestorSelect,
        orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(investors)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const validatedData = investorSchema.parse(body)

        const investor = await prisma.investor.create({
            data: validatedData
        })

        return NextResponse.json(investor)
    } catch {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }
}
