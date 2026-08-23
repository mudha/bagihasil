import { requireAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { runSerializableTransaction } from "../../../../../lib/serializable-transaction"
import { NextResponse } from "next/server"
import { z } from "zod"

const rupiahString = z.string()
    .regex(/^(0|[1-9][0-9]{0,17})$/, "Saldo harus berupa string integer rupiah non-negatif")

const managedCapitalRequest = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("set"),
        managedCapitalBalance: rupiahString,
    }).strict(),
    z.object({
        action: z.literal("clear"),
    }).strict(),
])

type ManagedCapitalRequest = z.infer<typeof managedCapitalRequest>

function serializeBalance(value: unknown): string | null {
    if (value === null || value === undefined) return null
    return value.toString()
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    const authResult = await requireAdmin()
    if ("response" in authResult && authResult.response) return authResult.response

    try {
        const body = await request.json()
        const input: ManagedCapitalRequest = managedCapitalRequest.parse(body)
        const { id } = await params
        const changedAt = new Date()

        const result = await runSerializableTransaction(prisma, async (tx) => {
            const existing = await tx.investor.findUnique({
                where: { id },
                select: { id: true, managedCapitalBalance: true },
            })

            if (!existing) return { notFound: true as const }

            const nextBalance = input.action === "set"
                ? input.managedCapitalBalance
                : null

            const investor = await tx.investor.update({
                where: { id },
                data: {
                    managedCapitalBalance: nextBalance,
                    managedCapitalBalanceUpdatedAt: changedAt,
                },
                select: {
                    id: true,
                    managedCapitalBalance: true,
                    managedCapitalBalanceUpdatedAt: true,
                },
            })

            await tx.activityLog.create({
                data: {
                    action: "UPDATE",
                    entity: "INVESTOR",
                    entityId: id,
                    details: JSON.stringify({
                        action: input.action,
                        managedCapitalBalanceBefore: serializeBalance(existing.managedCapitalBalance),
                        managedCapitalBalanceAfter: serializeBalance(investor.managedCapitalBalance),
                    }),
                    userId: authResult.session.user.id || "SYSTEM",
                    userName: authResult.session.user.name || "System",
                },
            })

            return { notFound: false as const, investor }
        })

        if (result.notFound) {
            return NextResponse.json({ error: "Investor tidak ditemukan" }, { status: 404 })
        }

        return NextResponse.json({
            ok: true,
            investor: {
                id: result.investor.id,
                managedCapitalBalance: serializeBalance(result.investor.managedCapitalBalance),
                managedCapitalBalanceUpdatedAt: result.investor.managedCapitalBalanceUpdatedAt?.toISOString() ?? null,
            },
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Data tidak valid", details: error.issues }, { status: 400 })
        }

        console.error("Error updating managed capital:", error)
        return NextResponse.json({ error: "Gagal mengubah saldo modal kelolaan" }, { status: 500 })
    }
}
