import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { getInvestorDashboardData } from "@/lib/investor-data"
import { legacyTransactionWithUnitSelect, legacyUnitWithInvestorSelect } from "../../../../lib/legacy-read-selects"
import { getTopSellingUnits } from "../../../../lib/top-selling"

const ALLOWED_MONTH_RANGES = new Set([6, 12, 24])

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "INVESTOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const monthsParam = searchParams.get("months")
    const requestedMonths = monthsParam ? Number.parseInt(monthsParam, 10) : 6
    const months = ALLOWED_MONTH_RANGES.has(requestedMonths) && String(requestedMonths) === (monthsParam ?? "6")
        ? requestedMonths
        : 6

    try {
        const data = await getInvestorDashboardData(session.user.id!, months)

        if (!data) {
            return NextResponse.json({ error: "Investor not found" }, { status: 404 })
        }

        const { investor, stats } = data

        // Fetch Investments Data
        const units = await prisma.unit.findMany({

            where: { investorId: investor.id },
            select: {
                ...legacyUnitWithInvestorSelect,
                transactions: {
                    where: { OR: [{ status: "ON_PROCESS" }, { status: "COMPLETED" }] },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: legacyTransactionWithUnitSelect,
                },
            },
            orderBy: { createdAt: "desc" }
        })

        const investmentsData = units.map(unit => {
            const trx = unit.transactions[0]
            const capital = trx ? (trx.initialInvestorCapital ?? trx.buyPrice) : 0
            const sellPrice = trx?.status === "COMPLETED" ? (trx.sellPrice ?? 0) : 0
            const transactionStatus = trx?.status === "ON_PROCESS" ? "Sedang Berjalan" :
                trx?.status === "COMPLETED" ? "Terjual" : "Belum Transaksi"

            return {
                id: unit.id,
                name: unit.name,
                plateNumber: unit.plateNumber,
                status: unit.status,
                imageUrl: unit.imageUrl,
                capital,
                sellPrice,
                transactionStatus,
                transactionId: trx?.id ?? ""
            }
        })

        // Fetch Payments Data
        const payments = await prisma.paymentHistory.findMany({

            where: { investorId: investor.id },
            select: {
                id: true,
                transactionId: true,
                investorId: true,
                idempotencyKey: true,
                idempotencyFingerprint: true,
                amount: true,
                paymentDate: true,
                method: true,
                proofImageUrl: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                transaction: { select: legacyTransactionWithUnitSelect },
            },
            orderBy: { paymentDate: "desc" }
        })

        const topSellingUnits = await getTopSellingUnits(months, investor.id)

        return NextResponse.json({
            investor,
            stats,
            topSellingUnits,
            monthlyChartData: data.monthlyChartData,
            monthlySalesTrend: data.monthlySalesTrend,
            monthlyRevenueData: data.monthlyRevenueData,
            monthlyChartDataHijri: data.monthlyChartDataHijri,
            monthlySalesTrendHijri: data.monthlySalesTrendHijri,
            monthlyRevenueDataHijri: data.monthlyRevenueDataHijri,
            investmentsData,
            paymentsData: payments
        })
    } catch (error) {
        console.error("Error fetching investor dashboard:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
