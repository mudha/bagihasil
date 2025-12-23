import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PaymentsTable } from "./PaymentsTable"

export default async function InvestorPaymentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    // Get Investor
    const investor = await db.investor.findUnique({
        where: { userId: session.user.id }
    })

    if (!investor) return <div>Data Investor tidak ditemukan</div>

    const payments = await db.paymentHistory.findMany({
        where: { investorId: investor.id },
        include: { transaction: { include: { unit: true } } },
        orderBy: { paymentDate: "desc" }
    })

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Riwayat Pembayaran</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Dana Masuk (Bagi Hasil & Pengembalian Modal)</CardTitle>
                </CardHeader>
                <CardContent>
                    <PaymentsTable data={payments} />
                </CardContent>
            </Card>
        </div>
    )
}
