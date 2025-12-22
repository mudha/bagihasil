import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { ViewImageDialog } from "@/components/ui/view-image-dialog"

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

    const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val)

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Riwayat Pembayaran</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Dana Masuk (Bagi Hasil & Pengembalian Modal)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Metode</TableHead>
                                <TableHead>Bukti</TableHead>
                                <TableHead>Catatan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">Belum ada riwayat pembayaran</TableCell>
                                </TableRow>
                            ) : (
                                payments.map(pay => (
                                    <TableRow key={pay.id}>
                                        <TableCell>
                                            {format(new Date(pay.paymentDate), "dd MMM yyyy", { locale: id })}
                                        </TableCell>
                                        <TableCell>
                                            {pay.transaction?.unit.name || "-"}
                                        </TableCell>
                                        <TableCell className="font-bold text-emerald-600">
                                            {formatCurrency(pay.amount)}
                                        </TableCell>
                                        <TableCell>{pay.method}</TableCell>
                                        <TableCell>
                                            <ViewImageDialog imageUrl={pay.proofImageUrl || ""} />
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={pay.notes || ""}>
                                            {pay.notes || "-"}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
