import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

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

    const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val)

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Investasi Saya</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Unit Didanai</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Unit</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Modal Awal</TableHead>
                                <TableHead>Kondisi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {units.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">Belum ada investasi</TableCell>
                                </TableRow>
                            ) : (
                                units.map(unit => {
                                    const trx = unit.transactions[0]
                                    const capital = trx ? (trx.initialInvestorCapital ?? trx.buyPrice) : 0

                                    return (
                                        <TableRow key={unit.id}>
                                            <TableCell className="font-medium">
                                                {unit.name} <br />
                                                <span className="text-xs text-muted-foreground">{unit.plateNumber}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={unit.status === "SOLD" ? "secondary" : "default"}>
                                                    {unit.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {trx ? formatCurrency(capital) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                {trx?.status === "ON_PROCESS" ? "Sedang Berjalan" :
                                                    trx?.status === "COMPLETED" ? "Terjual" : "Belum Transaksi"}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
