import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

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

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const investors = await prisma.investor.findMany({
        orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(investors)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const validatedData = investorSchema.parse(body)

        const investor = await prisma.investor.create({
            data: validatedData
        })

        return NextResponse.json(investor)
    } catch (error) {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }
}
