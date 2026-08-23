import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"

/**
 * @deprecated This endpoint has been decommissioned.
 * Use PUT /api/transactions/[id] for transaction finalization.
 * Kept as 410 Gone to surface any external callers before full removal.
 */
export async function POST(
    _req: Request,
    _ctx: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdmin()
    if ("response" in authResult) return authResult.response

    return NextResponse.json(
        { error: "Endpoint finalisasi ini sudah tidak digunakan. Gunakan jalur finalisasi terbaru." },
        { status: 410 }
    )
}
