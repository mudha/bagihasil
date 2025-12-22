import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvestmentsTable } from "./InvestmentsTable"

export default async function InvestorInvestmentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    // Get Investor
    const investor = await db.investor.findUnique({
        where: { userId: session.user.id }
    })

    if (!investor) return <div>Data Investor tidak ditemukan</div>

    // Get Active Investments
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

    const formattedData = units.map(unit => {
        const trx = unit.transactions[0]
        const capital = trx ? (trx.initialInvestorCapital ?? trx.buyPrice) : 0
        const transactionStatus = trx?.status === "ON_PROCESS" ? "Sedang Berjalan" :
            trx?.status === "COMPLETED" ? "Terjual" : "Belum Transaksi"

        return {
            id: unit.id,
            name: unit.name,
            plateNumber: unit.plateNumber,
            status: unit.status,
            capital,
            transactionStatus
        }
    })

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Investasi Saya</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Unit Didanai</CardTitle>
                </CardHeader>
                <CardContent>
                    <InvestmentsTable data={formattedData} />
                </CardContent>
            </Card>
        </div>
    )
}

