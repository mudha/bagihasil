import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getInvestorDashboardData } from "@/lib/investor-data"
import { redirect } from "next/navigation"
import { InvestorTabs } from "./InvestorTabs"

export default async function InvestorDashboardPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const data = await getInvestorDashboardData(session.user.id!)

    if (!data) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold text-red-500">Akun Investor Tidak Ditemukan</h1>
                <p>Akun Anda terdaftar sebagai User, namun belum dihubungkan ke data Investor oleh Admin.</p>
            </div>
        )
    }

    const { investor, stats } = data

    // Fetch Investments Data
    const units = await db.unit.findMany({
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
    const payments = await db.paymentHistory.findMany({
        where: { investorId: investor.id },
        include: { transaction: { include: { unit: true } } },
        orderBy: { paymentDate: "desc" }
    })

    return (
        <InvestorTabs
            investorName={investor.name}
            stats={stats}
            monthlyChartData={data.monthlyChartData}
            monthlySalesTrend={data.monthlySalesTrend}
            investmentsData={investmentsData}
            paymentsData={payments}
        />
    )
}
