import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"

const userSchema = z.object({
    name: z.string().min(1),
    username: z.string().min(3),
    email: z.string().email().optional().or(z.literal("")),
    password: z.string().min(6),
    role: z.enum(["ADMIN", "INVESTOR", "VIEWER"]).default("VIEWER")
})

export async function GET(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const users = await db.user.findMany({
        select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            createdAt: true,
            investor: {
                select: {
                    id: true,
                    name: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(users)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const body = await req.json()
        const validatedData = userSchema.parse(body)

        // Check if username already exists
        const existingUsername = await db.user.findUnique({
            where: { username: validatedData.username }
        })

        if (existingUsername) {
            return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 })
        }

        // Check if email already exists (if provided)
        if (validatedData.email && validatedData.email !== "") {
            const existingEmail = await db.user.findUnique({
                where: { email: validatedData.email }
            })

            if (existingEmail) {
                return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 })
            }
        }

        const hashedPassword = await bcrypt.hash(validatedData.password, 10)

        const user = await db.user.create({
            data: {
                name: validatedData.name,
                username: validatedData.username,
                email: validatedData.email && validatedData.email !== "" ? validatedData.email : null,
                passwordHash: hashedPassword,
                role: validatedData.role,
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true
            }
        })

        return NextResponse.json(user)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
