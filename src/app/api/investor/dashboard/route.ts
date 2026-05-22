import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { getInvestorDashboardData } from "@/lib/investor-data"

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const months = parseInt(searchParams.get("months") || "6", 10)

    try {
        const data = await getInvestorDashboardData(session.user.id!, months)

        if (!data) {
            return NextResponse.json({ error: "Investor not found" }, { status: 404 })
        }

        const { investor, stats } = data

        // Fetch Investments Data
        const units = await prisma.unit.findMany({

            where: { investorId: investor.id },
            include: {
                transactions: {
                    where: { OR: [{ status: "ON_PROCESS" }, { status: "COMPLETED" }] },
                    orderBy: { createdAt: "desc" },
                    take: 1
                }
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
            include: { transaction: { include: { unit: true } } },
            orderBy: { paymentDate: "desc" }
        })

        return NextResponse.json({
            investor,
            stats,
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
