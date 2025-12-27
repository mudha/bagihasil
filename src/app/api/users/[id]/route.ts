import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"

const userUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    username: z.string().min(3).optional(),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    password: z.string().min(6).optional().nullable(),
    role: z.enum(["ADMIN", "INVESTOR", "VIEWER"]).optional()
})

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const { id } = await params
        const body = await req.json()
        const validatedData = userUpdateSchema.parse(body)

        const updateData: any = {
            name: validatedData.name,
            username: validatedData.username,
            email: validatedData.email && validatedData.email !== "" ? validatedData.email : null,
            role: validatedData.role,
        }

        if (validatedData.password) {
            updateData.passwordHash = await bcrypt.hash(validatedData.password, 10)
        }

        const user = await db.user.update({
            where: { id },
            data: updateData,
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

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    try {
        const { id } = await params

        // Prevent deleting yourself
        if (!session?.user || id === session.user.id) {
            return NextResponse.json({ error: "Tidak dapat menghapus akun sendiri" }, { status: 400 })
        }

        await db.user.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
