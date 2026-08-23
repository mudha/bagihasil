import { auth } from "@/lib/auth"
import { canReadAdminData } from "@/lib/api-auth"
import { getManagedCapitalSummaries } from "@/lib/managed-capital-read-query"
import { NextResponse } from "next/server"

const privateHeaders = { "Cache-Control": "private, no-store" }

export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders })
    if (!canReadAdminData(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders })

    const investors = await getManagedCapitalSummaries()
    return NextResponse.json({ investors }, { headers: privateHeaders })
}

export const dynamic = "force-dynamic"
