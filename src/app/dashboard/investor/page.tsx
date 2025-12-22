import { auth } from "@/lib/auth"
import { getInvestorDashboardData } from "@/lib/investor-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, Package } from "lucide-react"
import { redirect } from "next/navigation"

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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Halo, {investor.name}</h2>
                <p className="text-muted-foreground">Ringkasan performa investasi Anda.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Investasi</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalInvested)}</div>
                        <p className="text-xs text-muted-foreground">Estimasi modal tertanam di seluruh unit</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Profit Bersih</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalProfit)}</div>
                        <p className="text-xs text-muted-foreground">Keuntungan bagi hasil yang didapat</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unit Aktif</CardTitle>
                        <Package className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeUnitsCount} Unit</div>
                        <p className="text-xs text-muted-foreground">Dari total {stats.totalUnitsCount} unit didanai</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity or List can go here */}
        </div>
    )
}
