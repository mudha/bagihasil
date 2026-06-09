import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { requireRole } from "@/lib/api-auth"

export async function GET(req: Request) {
    const authResult = await requireRole(["ADMIN", "VIEWER"])
    if ("response" in authResult) return authResult.response

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Ensure we include today's due dates

    try {
        const units = await prisma.unit.findMany({
            where: {
                status: 'AVAILABLE', // Only track active units
                taxDueDate: {
                    gte: today,
                    lte: futureDate
                }
            },
            select: {
                id: true,
                name: true,
                plateNumber: true,
                taxDueDate: true,
                investor: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                taxDueDate: 'asc'
            }
        })

        return NextResponse.json(units)
    } catch (error) {
        console.error("Error fetching reminders:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
