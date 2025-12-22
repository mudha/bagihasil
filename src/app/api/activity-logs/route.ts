import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const limit = parseInt(searchParams.get("limit") || "50")

        const logs = await db.activityLog.findMany({
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
