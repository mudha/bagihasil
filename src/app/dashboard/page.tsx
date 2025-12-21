"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Car, CheckCircle, DollarSign, TrendingUp, Download, FileText, FileSpreadsheet } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { exportInvestorReportXLSX, exportInvestorReportPDF } from "@/lib/export-utils"

interface InvestorStat {
    id: string
    name: string
    activeUnits: number
    completedTransactions: number
    totalProfit: number
    totalCapital: number
}

interface MonthlyStat {
    month: string
    totalMargin: number
    investorShare: number
    managerShare: number
}

interface UnitStatusStat {
    name: string
    value: number
    [key: string]: any
}

interface RecentTransaction {
    id: string
    code: string
    unitName: string
    type: string
    amount: number
    date: string
    status: string
}

interface DashboardStats {
    activeUnits: number
    completedTransactions: number
    totalMargin: number
    totalInvestorProfit: number
    totalManagerProfit: number
    totalCapitalDeployed: number
    investorStats: InvestorStat[]
    monthlyStats: MonthlyStat[]
    unitStatusDistribution: UnitStatusStat[]
    recentTransactions: RecentTransaction[]
}

export default function DashboardPage() {
    const router = useRouter()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [exportingReport, setExportingReport] = useState(false)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                let url = '/api/dashboard'
                if (selectedInvestorId && selectedInvestorId !== "all") {
                    url += `?investorId=${selectedInvestorId}`
                }
                const res = await fetch(url)
                if (res.status === 401) {
                    router.push('/login')
                    return
                }
                if (!res.ok) {
                    throw new Error('Failed to fetch dashboard data')
                }
                const data = await res.json()

                // Ensure array properties exist
                if (!data.investorStats) data.investorStats = [];
                if (!data.recentTransactions) data.recentTransactions = [];
                if (!data.unitStatusDistribution) data.unitStatusDistribution = [];
                if (!data.monthlyStats) data.monthlyStats = [];

                setStats(data)
                setError(null)
            } catch (err) {
                console.error("Error fetching dashboard stats:", err)
                setError("Gagal memuat data dashboard. Silakan coba lagi.")
                toast.error("Gagal memuat data dashboard")
            }
        }

        fetchStats()
    }, [selectedInvestorId])

    if (error) return <div className="p-8 text-center text-red-500">{error}</div>
    if (!stats) return <div className="p-8">Loading dashboard data...</div>

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
    }

    const handleExportXLSX = async () => {
        if (selectedInvestorId === "all") return
        const investor = stats?.investorStats.find(inv => inv.id === selectedInvestorId)
        if (!investor) return

        setExportingReport(true)
        toast.loading(`Mengekspor laporan Excel untuk ${investor.name}...`)

        const result = await exportInvestorReportXLSX(selectedInvestorId, investor.name)

        toast.dismiss()
        if (result.success) {
            toast.success("Laporan Excel berhasil diunduh!")
        } else {
            toast.error(result.error || "Gagal mengekspor laporan Excel")
        }
        setExportingReport(false)
    }

    const handleExportPDF = async () => {
        if (selectedInvestorId === "all") return
        const investor = stats?.investorStats.find(inv => inv.id === selectedInvestorId)
        if (!investor) return

        setExportingReport(true)
        toast.loading(`Mengekspor laporan PDF untuk ${investor.name}...`)

        const result = await exportInvestorReportPDF(selectedInvestorId, investor.name)

        toast.dismiss()
        if (result.success) {
            toast.success("Laporan PDF berhasil diunduh!")
        } else {
            toast.error(result.error || "Gagal mengekspor laporan PDF")
        }
        setExportingReport(false)
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex items-center space-x-2">
                    <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Pilih Investor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Investor</SelectItem>
                            {stats.investorStats?.map((investor) => (
                                <SelectItem key={investor.id} value={investor.id}>
                                    {investor.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedInvestorId !== "all" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={exportingReport}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    {exportingReport ? "Exporting..." : "Ekspor Laporan"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Format Laporan</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleExportXLSX}
                                    disabled={exportingReport}
                                >
                                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                                    <span>Ekspor Excel (XLSX)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleExportPDF}
                                    disabled={exportingReport}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>Ekspor PDF</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* General Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Unit Aktif</CardTitle>
                        <Car className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeUnits}</div>
                        <p className="text-xs text-muted-foreground">Unit tersedia untuk dijual</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Transaksi Selesai</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.completedTransactions}</div>
                        <p className="text-xs text-muted-foreground">Total unit terjual</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Margin</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.totalMargin)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total keuntungan bersih</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bagi Hasil Pemodal</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.totalInvestorProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total hak pemodal</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bagi Hasil Pengelola</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.totalManagerProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total hak pengelola</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Monthly Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>
                            Profit Bulanan {selectedInvestorId !== "all" ? `(${stats.investorStats.find(i => i.id === selectedInvestorId)?.name})` : "(Semua)"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.monthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}jt`}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelStyle={{ color: 'black' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="investorShare" name="Bagian Pemodal" stackId="a" fill="#adfa1d" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="managerShare" name="Bagian Pengelola" stackId="a" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Unit Status Pie Chart */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Status Unit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.unitStatusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.unitStatusDistribution?.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#00C49F', '#FFBB28', '#FF8042'][index % 3]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Transactions */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Aktivitas Terbaru</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {stats.recentTransactions?.map((tx) => (
                                <div key={tx.id} className="flex items-center">
                                    <div className="space-y-1 flex-1">
                                        <p className="text-sm font-medium leading-none">{tx.code} - {tx.unitName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(tx.date), 'dd MMM yyyy')} • {tx.type}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">{formatCurrency(tx.amount)}</div>
                                        <Badge variant={tx.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                            {tx.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                            {stats.recentTransactions.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">Belum ada transaksi.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Investor Stats */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Performa Pemodal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {stats.investorStats?.map((investor) => (
                                <div key={investor.id} className="flex items-center">
                                    <div className="space-y-1 flex-1">
                                        <p className="text-sm font-medium leading-none">{investor.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {investor.activeUnits} Unit Aktif • {investor.completedTransactions} Transaksi Selesai
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">{formatCurrency(investor.totalProfit)}</div>
                                        <p className="text-xs text-muted-foreground">Profit</p>
                                    </div>
                                </div>
                            ))}
                            {stats.investorStats.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">Belum ada data pemodal.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
