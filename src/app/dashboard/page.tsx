"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Car, CheckCircle, DollarSign, TrendingUp, Download, FileText, FileSpreadsheet, Wallet, Calendar } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { formatHijriFull } from "@/lib/date-utils"
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
    unitsSold: number
    totalRevenue: number
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

interface TaxReminder {
    id: string
    name: string
    plateNumber: string
    taxDueDate: string
    daysLeft: number
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
    monthlyStatsHijri: MonthlyStat[]
    unitStatusDistribution: UnitStatusStat[]
    recentTransactions: RecentTransaction[]
    taxReminders?: TaxReminder[]
}

export default function DashboardPage() {
    const router = useRouter()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [exportingReport, setExportingReport] = useState(false)
    const [monthsRange, setMonthsRange] = useState<string>("6")
    const [calendarMode, setCalendarMode] = useState<"gregorian" | "hijri">("gregorian")

    useEffect(() => {
        const fetchStats = async () => {
            try {
                let url = `/api/dashboard?months=${monthsRange}`
                if (selectedInvestorId && selectedInvestorId !== "all") {
                    url += `&investorId=${selectedInvestorId}`
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
                if (!data.monthlyStatsHijri) data.monthlyStatsHijri = [];
                if (!data.taxReminders) data.taxReminders = [];

                setStats(data)
                setError(null)
            } catch (err) {
                console.error("Error fetching dashboard stats:", err)
                setError("Gagal memuat data dashboard. Silakan coba lagi.")
                toast.error("Gagal memuat data dashboard")
            }
        }

        fetchStats()
    }, [selectedInvestorId, monthsRange])

    if (error) return <div className="p-8 text-center text-red-500">{error}</div>
    if (!stats) return <div className="p-8">Loading dashboard data...</div>

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
    }

    const formatXAxisDate = (val: string) => {
        const parts = val.split(' ')
        // Handle 2-word Hijri months (e.g., Jumadil Awal, Rabiul Akhir)
        if (parts.length >= 2 && ['Awal', 'Akhir'].includes(parts[1])) {
            return `${parts[0]} ${parts[1]}`
        }
        return parts[0]
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

    const currentMonthlyStats = calendarMode === 'hijri' ? (stats.monthlyStatsHijri || []) : (stats.monthlyStats || [])

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
                    <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                        <SelectTrigger className="w-full sm:w-[200px]">
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

                    <Tabs value={calendarMode} onValueChange={(val) => setCalendarMode(val as "gregorian" | "hijri")} className="w-[180px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="gregorian">Masehi</TabsTrigger>
                            <TabsTrigger value="hijri">Hijri</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Month Range Selector */}
                    <Select value={monthsRange} onValueChange={setMonthsRange}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="Rentang Waktu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="6">6 Bulan Terakhir</SelectItem>
                            <SelectItem value="12">1 Tahun Terakhir</SelectItem>
                            <SelectItem value="24">2 Tahun Terakhir</SelectItem>
                        </SelectContent>
                    </Select>


                    {selectedInvestorId !== "all" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={exportingReport}
                                    className="w-full sm:w-auto"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    {exportingReport ? "Exporting..." : "Ekspor"}
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
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
                <Link href="/dashboard/units?status=AVAILABLE">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Unit Aktif</CardTitle>
                            <Car className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold sm:text-xl truncate">{stats.activeUnits}</div>
                            <p className="text-xs text-muted-foreground">Unit tersedia untuk dijual</p>
                        </CardContent>
                    </Card>
                </Link>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Modal Diputar</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold sm:text-xl truncate" title={formatCurrency(stats.totalCapitalDeployed)}>
                            {formatCurrency(stats.totalCapitalDeployed)}
                        </div>
                        <p className="text-xs text-muted-foreground">Modal di unit aktif</p>
                    </CardContent>
                </Card>
                <Link href="/dashboard/transactions?status=COMPLETED">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Unit Terjual</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold sm:text-xl truncate">{stats.completedTransactions}</div>
                            <p className="text-xs text-muted-foreground">Unit sudah lunas / selesai</p>
                        </CardContent>
                    </Card>
                </Link>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Margin</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold sm:text-xl truncate" title={formatCurrency(stats.totalMargin)}>
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
                        <div className="text-lg font-bold sm:text-xl truncate" title={formatCurrency(stats.totalInvestorProfit)}>
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
                        <div className="text-lg font-bold sm:text-xl truncate" title={formatCurrency(stats.totalManagerProfit)}>
                            {formatCurrency(stats.totalManagerProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total hak pengelola</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tax Reminders */}
            {stats.taxReminders && stats.taxReminders.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                            <TrendingUp className="h-4 w-4" />
                            Pengingat Pajak Kendaraan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {stats.taxReminders.map((reminder) => (
                                <div key={reminder.id} className="flex items-center justify-between p-2 rounded-lg border bg-white shadow-sm">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold">{reminder.plateNumber}</p>
                                        <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{reminder.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={reminder.daysLeft <= 7 ? "destructive" : "outline"} className="text-[10px]">
                                            {reminder.daysLeft <= 0 ? "Lewat Tempo" : `${reminder.daysLeft} Hari Lagi`}
                                        </Badge>
                                        <p className="text-[10px] mt-1 text-muted-foreground">
                                            {format(new Date(reminder.taxDueDate), 'dd/MM/yy')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Total Omset Bulanan</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={currentMonthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#888888"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatXAxisDate}
                                        interval={0}
                                        height={60}
                                        tick={{ dy: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelStyle={{ color: 'black' }}
                                    />
                                    <Bar dataKey="totalRevenue" name="Omset" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Monthly Profit Chart (NEW) */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Total Profit Bulanan</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={currentMonthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#888888"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatXAxisDate}
                                        interval={0}
                                        height={60}
                                        tick={{ dy: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelStyle={{ color: 'black' }}
                                    />
                                    <Bar dataKey="totalMargin" name="Total Profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Monthly Profit Breakdown Chart */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>
                            Pembagian Profit
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={currentMonthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#888888"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatXAxisDate}
                                        interval={0}
                                        height={60}
                                        tick={{ dy: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis
                                        hide
                                    />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelStyle={{ color: 'black' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                    <Bar dataKey="investorShare" name="Pemodal" stackId="a" fill="#adfa1d" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="managerShare" name="Pengelola" stackId="a" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Monthly Units Sold Chart */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Unit Terjual</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={currentMonthlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#888888"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatXAxisDate}
                                        interval={0}
                                        height={60}
                                        tick={{ dy: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis
                                        hide
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [`${value} Unit`, "Terjual"]}
                                        labelStyle={{ color: 'black' }}
                                    />
                                    <Bar dataKey="unitsSold" name="Unit" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
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
                                            {formatHijriFull(new Date(tx.date))} • {tx.type}
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
        </div >
    )
}
