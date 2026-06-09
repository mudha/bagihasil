import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/api-auth"


export async function GET(req: Request) {
    try {
        const authResult = await requireRole(["ADMIN", "VIEWER"])
        if ("response" in authResult) return authResult.response

        const { searchParams } = new URL(req.url)
        const limit = parseInt(searchParams.get("limit") || "50")

        const logs = await prisma.activityLog.findMany({

            take: limit,
            orderBy: {
                createdAt: 'desc'
            }
        })

        return NextResponse.json(logs)
    } catch (error) {
        console.error("[ACTIVITY_LOGS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
