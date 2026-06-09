import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Role = "ADMIN" | "INVESTOR" | "VIEWER"

export type AuthorizedSession = Session

export function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function forbidden() {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function requireAuth() {
    const session = await auth()
    if (!session?.user) {
        return { response: unauthorized() }
    }

    return { session }
}

export async function requireRole(roles: Role[]) {
    const result = await requireAuth()
    if ("response" in result) return result

    const role = result.session.user.role as Role | undefined
    if (!role || !roles.includes(role)) {
        return { response: forbidden() }
    }

    return { session: result.session }
}

export async function requireAdmin() {
    return requireRole(["ADMIN"])
}

export function canReadAdminData(session: AuthorizedSession) {
    return session.user.role === "ADMIN" || session.user.role === "VIEWER"
}

export async function getInvestorForSession(session: AuthorizedSession) {
    if (!session.user.id) return null

    return prisma.investor.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
    })
}

export async function canAccessInvestor(session: AuthorizedSession, investorId: string) {
    if (canReadAdminData(session)) return true
    if (session.user.role !== "INVESTOR") return false

    const investor = await getInvestorForSession(session)
    return investor?.id === investorId
}

export async function canAccessTransaction(session: AuthorizedSession, transactionId: string) {
    if (canReadAdminData(session)) return true
    if (session.user.role !== "INVESTOR") return false

    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
            unit: {
                select: {
                    investor: {
                        select: { userId: true },
                    },
                },
            },
        },
    })

    return transaction?.unit.investor.userId === session.user.id
}
