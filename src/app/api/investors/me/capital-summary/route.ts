import { auth } from "@/lib/auth"
import { getInvestorForSession } from "@/lib/api-auth"
import { getManagedCapitalSummary } from "@/lib/managed-capital-read-query"
import { NextResponse } from "next/server"

const privateHeaders = { "Cache-Control": "private, no-store" }

export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders })

    if (session.user.role !== "INVESTOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders })
    }

    const investor = await getInvestorForSession(session)
    if (!investor) return NextResponse.json({ error: "Not found" }, { status: 404, headers: privateHeaders })

    const summary = await getManagedCapitalSummary(investor.id)
    if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404, headers: privateHeaders })

    return NextResponse.json({ investor: summary }, { headers: privateHeaders })
}

export const dynamic = "force-dynamic"
