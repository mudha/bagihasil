"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useRef, useState } from "react"
import { signOutToLogin } from "@/lib/sign-out"
import Link from "next/link"
import {
    ArrowUpRight,
    Banknote,
    BarChart3,
    Calendar,
    Car,
    CheckCircle2,
    Clock3,
    Download,
    FileSpreadsheet,
    FileText,
    Gauge,
    Landmark,
    PiggyBank,
    ReceiptText,
    TrendingUp,
    Wallet,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
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
import { LoadingState } from "@/components/mudha/LoadingState"
import { ErrorState } from "@/components/mudha/ErrorState"
import { useTheme } from "next-themes"
import {
    getChartColors,
    chartBarFill,
    chartBarAltFill,
} from "@/lib/chart-theme"


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

// statusColors is now chart.pie from getChartColors

function MetricCard({
    title,
    value,
    helper,
    icon: Icon,
    href,
    tone = "teal",
    titleFull,
}: {
    title: string
    value: string | number
    helper: string
    icon: LucideIcon
    href?: string
    tone?: "teal" | "lime" | "sky" | "amber"
    titleFull?: string
}) {
    const toneIcon = {
        teal: "text-[var(--mudha-primary-700)]",
        lime: "text-[var(--mudha-primary-700)]",
        sky: "text-[var(--mudha-info-text)]",
        amber: "text-[var(--mudha-status-warning-text)]",
    }[tone]

    const content = (
        <Card className="group h-full rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)] transition hover:shadow-[var(--mudha-shadow-sm)]">
            <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className={`grid size-9 place-items-center rounded-lg bg-[var(--mudha-surface-subtle)]`}>
                        <Icon className={`size-4 ${toneIcon}`} />
                    </div>
                    {href && <ArrowUpRight className="size-4 text-[var(--mudha-text-muted)] opacity-0 transition group-hover:opacity-100" />}
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--mudha-text-muted)]">{title}</p>
                    <p className="mt-1 truncate text-xl font-bold tracking-tight text-[var(--mudha-text-main)] sm:text-2xl" title={titleFull}>
                        {value}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--mudha-text-muted)]">{helper}</p>
                </div>
            </CardContent>
        </Card>
    )

    if (href) {
        return <Link href={href}>{content}</Link>
    }

    return content
}

function MeasuredChartBox({ className, children }: { className: string; children: ReactNode }) {
    const boxRef = useRef<HTMLDivElement>(null)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const update = () => {
            const width = boxRef.current?.clientWidth ?? 0
            setReady(width > 20)
        }

        update()
        const frame = window.requestAnimationFrame(update)
        const observer = new ResizeObserver(update)
        if (boxRef.current) observer.observe(boxRef.current)

        return () => {
            window.cancelAnimationFrame(frame)
            observer.disconnect()
        }
    }, [])

    return (
        <div ref={boxRef} className={className}>
            {ready ? children : <div className="h-full w-full rounded-lg bg-teal-50/60 dark:bg-teal-950/40" />}
        </div>
    )
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <Card className="min-w-0 rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)]">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-[var(--mudha-text-main)]">{title}</CardTitle>
                <p className="text-xs text-[var(--mudha-text-muted)]">{subtitle}</p>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-4">
                <MeasuredChartBox className="h-[240px] min-h-[240px] w-full min-w-0 sm:h-[320px] sm:min-h-[320px]">
                    {children}
                </MeasuredChartBox>
            </CardContent>
        </Card>
    )
}

export default function DashboardPage() {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === "dark"
    const chart = getChartColors(isDark)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [exportingReport, setExportingReport] = useState(false)
    const [monthsRange, setMonthsRange] = useState<string>("6")
    const [calendarMode, setCalendarMode] = useState<"gregorian" | "hijri">("gregorian")
    const [retryNonce, setRetryNonce] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        let didTimeout = false
        const timeoutId = window.setTimeout(() => {
            didTimeout = true
            controller.abort()
        }, 15_000)

        const fetchStats = async () => {
            setStats(null)
            setError(null)
            try {
                let url = `/api/dashboard?months=${monthsRange}`
                if (selectedInvestorId && selectedInvestorId !== "all") {
                    url += `&investorId=${selectedInvestorId}`
                }
                const res = await fetch(url, {
                    cache: "no-store",
                    credentials: "same-origin",
                    signal: controller.signal,
                })
                if (res.status === 401) {
                    await signOutToLogin()
                    return
                }
                if (!res.ok) {
                    throw new Error("Failed to fetch dashboard data")
                }
                const data = await res.json()

                if (!data.investorStats) data.investorStats = []
                if (!data.recentTransactions) data.recentTransactions = []
                if (!data.unitStatusDistribution) data.unitStatusDistribution = []
                if (!data.monthlyStats) data.monthlyStats = []
                if (!data.monthlyStatsHijri) data.monthlyStatsHijri = []
                if (!data.taxReminders) data.taxReminders = []

                setStats(data)
                setError(null)
            } catch (err) {
                if (controller.signal.aborted) {
                    if (!didTimeout) return
                    setError("Dashboard terlalu lama merespons. Silakan muat ulang halaman.")
                    toast.error("Dashboard terlalu lama merespons")
                    return
                }
                console.error("Error fetching dashboard stats:", err)
                setError("Gagal memuat data dashboard. Silakan coba lagi.")
                toast.error("Gagal memuat data dashboard")
            } finally {
                window.clearTimeout(timeoutId)
            }
        }

        fetchStats()

        return () => {
            window.clearTimeout(timeoutId)
            controller.abort()
        }
    }, [selectedInvestorId, monthsRange, retryNonce])

    if (error && !stats) return <div className="space-y-4 pb-20"><ErrorState title="Gagal memuat dashboard" description={error} onRetry={() => setRetryNonce((value) => value + 1)} /></div>
    if (!stats) {
        return (
            <div className="space-y-4 pb-20">
                <LoadingState variant="page" label="Memuat dashboard..." />
            </div>
        )
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)
    }

    const formatCurrencyShort = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(value)
    }

    const formatXAxisDate = (val: string) => {
        const parts = val.split(" ")
        if (parts.length >= 2 && ["Awal", "Akhir"].includes(parts[1])) {
            return `${parts[0]} ${parts[1]}`
        }
        return parts[0]
    }

    const handleExportXLSX = async () => {
        if (selectedInvestorId === "all") return
        const investor = stats?.investorStats.find(inv => inv.id === selectedInvestorId)
        if (!investor) return

        setExportingReport(true)
        const loadingToastId = toast.loading(`Mengekspor laporan Excel untuk ${investor.name}...`)

        try {
            const { exportInvestorReportXLSX } = await import("@/lib/export-utils")
            const result = await exportInvestorReportXLSX(selectedInvestorId, investor.name)

            toast.dismiss(loadingToastId)
            if (result.success) {
                toast.success("Laporan Excel berhasil diunduh!")
            } else {
                toast.error(result.error || "Gagal mengekspor laporan Excel")
            }
        } catch {
            toast.dismiss(loadingToastId)
            toast.error("Gagal memuat modul ekspor Excel. Silakan coba lagi.")
        } finally {
            setExportingReport(false)
        }
    }

    const handleExportPDF = async () => {
        if (selectedInvestorId === "all") return
        const investor = stats?.investorStats.find(inv => inv.id === selectedInvestorId)
        if (!investor) return

        setExportingReport(true)
        const loadingToastId = toast.loading(`Mengekspor laporan PDF untuk ${investor.name}...`)

        try {
            const { exportInvestorReportPDF } = await import("@/lib/export-utils")
            const result = await exportInvestorReportPDF(selectedInvestorId, investor.name)

            toast.dismiss(loadingToastId)
            if (result.success) {
                toast.success("Laporan PDF berhasil diunduh!")
            } else {
                toast.error(result.error || "Gagal mengekspor laporan PDF")
            }
        } catch {
            toast.dismiss(loadingToastId)
            toast.error("Gagal memuat modul ekspor PDF. Silakan coba lagi.")
        } finally {
            setExportingReport(false)
        }
    }

    const currentMonthlyStats = calendarMode === "hijri" ? (stats.monthlyStatsHijri || []) : (stats.monthlyStats || [])
    const selectedInvestor = selectedInvestorId === "all" ? null : stats.investorStats.find(investor => investor.id === selectedInvestorId)
    const heroLabel = selectedInvestor ? selectedInvestor.name : "Semua Investor"
    const bestInvestor = [...stats.investorStats].sort((a, b) => b.totalProfit - a.totalProfit)[0]
    const totalSharedProfit = stats.totalInvestorProfit + stats.totalManagerProfit

    const quickActions = [
        { label: "Unit", href: "/dashboard/units", icon: Car },
        { label: "Transaksi", href: "/dashboard/transactions", icon: ReceiptText },
        { label: "Pemodal", href: "/dashboard/investors", icon: Landmark },
        { label: "Kalkulator", href: "/dashboard/calculator", icon: Gauge },
    ]

    return (
        <div className="space-y-5 lg:space-y-7">
            <section className="rounded-lg bg-[#073f3b] text-white shadow-2xl shadow-teal-950/15">
                <div className="relative grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.35fr_0.65fr] xl:p-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100/70">{heroLabel}</p>
                            <h1 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
                                Dashboard
                            </h1>
                            <p className="max-w-xl text-sm leading-6 text-teal-50/70 sm:text-base">
                                Pantau modal aktif, margin, unit terjual, dan performa pemodal.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {quickActions.map((action) => (
                                <Link
                                    key={action.href}
                                    href={action.href}
                                    className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-teal-950"
                                >
                                    <action.icon className="size-4 text-teal-200 transition group-hover:text-teal-600" />
                                    {action.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs text-teal-100/70">Total Margin</p>
                                <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrencyShort(stats.totalMargin)}</p>
                            </div>
                            <div className="grid size-10 place-items-center rounded-lg bg-white text-teal-700">
                                <TrendingUp className="size-5" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                            <div>
                                <p className="text-xs text-teal-100/65">Unit aktif</p>
                                <p className="mt-1 text-lg font-bold">{stats.activeUnits}</p>
                            </div>
                            <div>
                                <p className="text-xs text-teal-100/65">Terjual</p>
                                <p className="mt-1 text-lg font-bold">{stats.completedTransactions}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-teal-100/65">Top pemodal</p>
                                <p className="mt-1 truncate text-sm font-medium">{bestInvestor?.name || "Belum ada data"}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-3 rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-3 shadow-[var(--mudha-shadow-xs)] sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                    <SelectTrigger className="h-11 w-full rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)]">
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

                <Tabs value={calendarMode} onValueChange={(val) => setCalendarMode(val as "gregorian" | "hijri")} className="w-full lg:w-[190px]">
                    <TabsList className="grid h-11 w-full grid-cols-2 rounded-lg bg-[var(--mudha-surface-subtle)]">
                        <TabsTrigger value="gregorian" className="rounded-lg">Masehi</TabsTrigger>
                        <TabsTrigger value="hijri" className="rounded-lg">Hijri</TabsTrigger>
                    </TabsList>
                </Tabs>

                <Select value={monthsRange} onValueChange={setMonthsRange}>
                    <SelectTrigger className="h-11 w-full rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] lg:w-[170px]">
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
                                disabled={exportingReport}
                                className="h-11 w-full rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] lg:w-auto"
                            >
                                <Download className="h-4 w-4" />
                                {exportingReport ? "Mengekspor…" : "Ekspor"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Format Laporan</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleExportXLSX} disabled={exportingReport}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                <span>Ekspor Excel (XLSX)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportPDF} disabled={exportingReport}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Ekspor PDF</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
                <MetricCard title="Unit Aktif" value={stats.activeUnits} helper="Siap dijual" icon={Car} href="/dashboard/units?status=AVAILABLE" tone="teal" />
                <MetricCard
                    title="Modal Diputar"
                    value={formatCurrencyShort(stats.totalCapitalDeployed)}
                    titleFull={formatCurrency(stats.totalCapitalDeployed)}
                    helper="Di unit aktif"
                    icon={Wallet}
                    tone="sky"
                />
                <MetricCard title="Unit Terjual" value={stats.completedTransactions} helper="Transaksi selesai" icon={CheckCircle2} href="/dashboard/transactions?status=COMPLETED" tone="lime" />
                <MetricCard
                    title="Total Margin"
                    value={formatCurrencyShort(stats.totalMargin)}
                    titleFull={formatCurrency(stats.totalMargin)}
                    helper="Profit bersih"
                    icon={BarChart3}
                    tone="teal"
                />
                <MetricCard
                    title="Hak Pemodal"
                    value={formatCurrencyShort(stats.totalInvestorProfit)}
                    titleFull={formatCurrency(stats.totalInvestorProfit)}
                    helper="Bagi hasil"
                    icon={PiggyBank}
                    tone="amber"
                />
                <MetricCard
                    title="Hak Pengelola"
                    value={formatCurrencyShort(stats.totalManagerProfit)}
                    titleFull={formatCurrency(stats.totalManagerProfit)}
                    helper="Bagi hasil"
                    icon={Banknote}
                    tone="sky"
                />
            </section>

            {stats.taxReminders && stats.taxReminders.length > 0 && (
                <Card className="rounded-lg border-amber-200 dark:border-amber-300 bg-amber-50/80 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-black text-amber-900 dark:text-amber-300">
                            <Calendar className="h-4 w-4" />
                            Pengingat Pajak Kendaraan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
                            {stats.taxReminders.slice(0, 4).map((reminder) => (
                                <div key={reminder.id} className="min-w-[220px] rounded-lg border border-amber-200 bg-card p-3 shadow-sm lg:min-w-0 dark:border-amber-800/40">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-foreground">{reminder.plateNumber}</p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">{reminder.name}</p>
                                        </div>
                                        <Badge variant={reminder.daysLeft <= 7 ? "destructive" : "outline"} className="text-[10px]">
                                            {reminder.daysLeft <= 0 ? "Lewat Tempo" : `${reminder.daysLeft} hari`}
                                        </Badge>
                                    </div>
                                    <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                                        <Clock3 className="size-3" />
                                        {format(new Date(reminder.taxDueDate), "dd/MM/yyyy")}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <section className="grid gap-4 xl:grid-cols-4">
                <ChartPanel title="Omset Bulanan" subtitle="Revenue per periode">
                    <ResponsiveContainer width="100%" height="100%" minWidth={160} minHeight={240} initialDimension={{ width: 320, height: 240 }}>
                        <BarChart data={currentMonthlyStats} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                            <XAxis dataKey="month" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatXAxisDate} interval={0} height={54} tick={{ dy: 10 }} angle={-35} textAnchor="end" />
                            <YAxis hide />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: chart.tooltipBackground, borderColor: chart.tooltipBorder, color: chart.tooltipLabel }} labelStyle={{ color: chart.tooltipLabel }} cursor={{ fill: chart.cursor, opacity: 0.35 }} />
                            <Bar dataKey="totalRevenue" name="Omset" fill={chartBarFill(isDark)} radius={[6, 6, 0, 0]} barSize={34} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartPanel>

                <ChartPanel title="Profit Bulanan" subtitle="Margin bersih">
                    <ResponsiveContainer width="100%" height="100%" minWidth={160} minHeight={240} initialDimension={{ width: 320, height: 240 }}>
                        <BarChart data={currentMonthlyStats} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                            <XAxis dataKey="month" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatXAxisDate} interval={0} height={54} tick={{ dy: 10 }} angle={-35} textAnchor="end" />
                            <YAxis hide />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: chart.tooltipBackground, borderColor: chart.tooltipBorder, color: chart.tooltipLabel }} labelStyle={{ color: chart.tooltipLabel }} cursor={{ fill: chart.cursor, opacity: 0.45 }} />
                            <Bar dataKey="totalMargin" name="Total Profit" fill={chartBarAltFill(isDark)} radius={[6, 6, 0, 0]} barSize={34} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartPanel>

                <ChartPanel title="Pembagian Profit" subtitle={`Total dibagi ${formatCurrencyShort(totalSharedProfit)}`}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={160} minHeight={240} initialDimension={{ width: 320, height: 240 }}>
                        <BarChart data={currentMonthlyStats} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                            <XAxis dataKey="month" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatXAxisDate} interval={0} height={54} tick={{ dy: 10 }} angle={-35} textAnchor="end" />
                            <YAxis hide />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: chart.tooltipBackground, borderColor: chart.tooltipBorder, color: chart.tooltipLabel }} labelStyle={{ color: chart.tooltipLabel }} cursor={{ fill: chart.cursor, opacity: 0.5 }} />
                            <Legend wrapperStyle={{ fontSize: "10px", color: chart.legendText }} />
                            <Bar dataKey="investorShare" name="Pemodal" stackId="a" fill={chart.pie[2]} radius={[0, 0, 6, 6]} />
                            <Bar dataKey="managerShare" name="Pengelola" stackId="a" fill={chart.pie[3]} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartPanel>

                <ChartPanel title="Unit Terjual" subtitle="Volume penjualan">
                    <ResponsiveContainer width="100%" height="100%" minWidth={160} minHeight={240} initialDimension={{ width: 320, height: 240 }}>
                        <BarChart data={currentMonthlyStats} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                            <XAxis dataKey="month" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatXAxisDate} interval={0} height={54} tick={{ dy: 10 }} angle={-35} textAnchor="end" />
                            <YAxis hide />
                            <Tooltip formatter={(value: number) => [`${value} Unit`, "Terjual"]} contentStyle={{ backgroundColor: chart.tooltipBackground, borderColor: chart.tooltipBorder, color: chart.tooltipLabel }} labelStyle={{ color: chart.tooltipLabel }} cursor={{ fill: chart.cursor, opacity: 0.6 }} />
                            <Bar dataKey="unitsSold" name="Unit" fill={chart.pie[3]} radius={[6, 6, 0, 0]} barSize={34} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartPanel>
            </section>

            <section className="grid gap-4 lg:grid-cols-7">
                <Card className="rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)] lg:col-span-4">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-[var(--mudha-text-main)]">Aktivitas Terbaru</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.recentTransactions?.map((tx) => (
                                <Link
                                    key={tx.id}
                                    href={`/dashboard/transactions/${tx.id}`}
                                    className="group flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3 transition hover:border-teal-200 hover:bg-teal-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:flex-row sm:items-center dark:hover:border-teal-800 dark:hover:bg-teal-950/40 dark:ring-teal-950/40"
                                >
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--mudha-surface-subtle)] text-[var(--mudha-primary-700)] transition group-hover:bg-[var(--mudha-primary-700)] group-hover:text-white">
                                            <ReceiptText className="size-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-sm font-black leading-snug text-foreground transition group-hover:text-teal-800 dark:group-hover:text-teal-200">
                                                {tx.code} - {tx.unitName}
                                            </p>
                                            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                                                {formatHijriFull(new Date(tx.date))} • {tx.type}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-3 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                                        <div className="text-sm font-black text-foreground">{formatCurrencyShort(tx.amount)}</div>
                                        <Badge variant={tx.status === "COMPLETED" ? "default" : "secondary"} className="text-[10px] sm:mt-1">
                                            {tx.status}
                                        </Badge>
                                    </div>
                                </Link>
                            ))}
                            {stats.recentTransactions.length === 0 && (
                                <p className="py-6 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 lg:col-span-3">
                    <Card className="rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)]">
                        <CardHeader>
                            <CardTitle className="text-base font-bold text-[var(--mudha-text-main)]">Performa Pemodal</CardTitle>
                            <p className="text-xs text-[var(--mudha-text-muted)]">Ranking berdasarkan bagi hasil 30 hari terakhir.</p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats.investorStats?.slice(0, 5).map((investor, index) => (
                                    <div key={investor.id} className="flex items-center gap-3">
                                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--mudha-surface-subtle)] text-xs font-bold text-[var(--mudha-primary-700)]">
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-black text-foreground">{investor.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {investor.activeUnits} aktif • {investor.completedTransactions} selesai
                                            </p>
                                        </div>
                                        <div className="text-right text-sm font-black text-foreground">{formatCurrencyShort(investor.totalProfit)}</div>
                                    </div>
                                ))}
                                {stats.investorStats.length === 0 && (
                                    <p className="py-6 text-center text-sm text-muted-foreground">Belum ada data pemodal.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)]">
                        <CardHeader>
                            <CardTitle className="text-base font-bold text-[var(--mudha-text-main)]">Status Unit</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid min-w-0 grid-cols-[120px_1fr] items-center gap-3">
                                <MeasuredChartBox className="h-[120px] min-h-[120px] w-full min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={120} initialDimension={{ width: 120, height: 120 }}>
                                        <PieChart>
                                            <Pie data={stats.unitStatusDistribution} dataKey="value" nameKey="name" innerRadius={36} outerRadius={56} paddingAngle={3}>
                                                {stats.unitStatusDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${entry.name}`} fill={chart.pie[index % chart.pie.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: number) => [`${value} Unit`, "Jumlah"]} contentStyle={{ backgroundColor: chart.tooltipBackground, borderColor: chart.tooltipBorder, color: chart.tooltipLabel }} labelStyle={{ color: chart.tooltipLabel }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </MeasuredChartBox>
                                <div className="space-y-2">
                                    {stats.unitStatusDistribution.slice(0, 5).map((item, index) => (
                                        <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                                                <span className="size-2 rounded-full" style={{ backgroundColor: chart.pie[index % chart.pie.length] }} />
                                                <span className="truncate">{item.name}</span>
                                            </span>
                                            <span className="font-black text-foreground">{item.value}</span>
                                        </div>
                                    ))}
                                    {stats.unitStatusDistribution.length === 0 && (
                                        <p className="text-sm text-muted-foreground">Belum ada data unit.</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    )
}
