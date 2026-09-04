"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvestmentsTable } from "@/components/investor/InvestmentsTable"
import { PaymentsTable } from "@/components/investor/PaymentsTable"
import { ManagedCapitalSelfCard } from "@/components/investor/ManagedCapitalSelfCard"
import { CheckCircle, DollarSign, Package, Sparkles, TrendingUp, Wallet } from "lucide-react"
import { InvestorMonthlyChart } from "./InvestorMonthlyChart"
import { InvestorSalesTrendChart } from "./InvestorSalesTrendChart"
import { InvestorRevenueChart } from "./InvestorRevenueChart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface InvestorTabsProps {
    investorName: string
    stats: {
        totalInvested: number
        activeCapital: number
        totalProfit: number
        activeUnitsCount: number
        soldUnitsCount: number
        totalUnitsCount: number
    }
    monthlyChartData: any[]
    monthlySalesTrend: any[]
    monthlyRevenueData: any[]
    monthlyChartDataHijri: any[]
    monthlySalesTrendHijri: any[]
    monthlyRevenueDataHijri: any[]
    investmentsData: any[]
    paymentsData: any[]
    monthsRange: string
    onMonthsRangeChange: (months: string) => void
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value || 0)
}

function formatCompactCurrency(value: number) {
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    return formatCurrency(value)
}

function StatCard({
    title,
    value,
    helper,
    icon: Icon,
    tone = "teal",
    onClick,
}: {
    title: string
    value: string
    helper: string
    icon: typeof DollarSign
    tone?: "teal" | "lime" | "sky" | "amber"
    onClick?: () => void
}) {
    const toneClass = {
        teal: "bg-primary/10 text-primary",
        lime: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
        sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
        amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    }[tone]

    return (
        <Card
            onClick={onClick}
            className={`rounded-lg border-border bg-card shadow-sm transition ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-teal-800" : ""}`}
        >
            <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground [overflow-wrap:anywhere]">
                    {title}
                </CardTitle>
                <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClass}`}>
                    <Icon className="size-5" />
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black leading-tight text-foreground [overflow-wrap:anywhere]">{value}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{helper}</p>
            </CardContent>
        </Card>
    )
}

export function InvestorTabs({
    investorName,
    stats,
    monthlyChartData,
    monthlySalesTrend,
    monthlyRevenueData,
    monthlyChartDataHijri,
    monthlySalesTrendHijri,
    monthlyRevenueDataHijri,
    investmentsData,
    paymentsData,
    monthsRange,
    onMonthsRangeChange
}: InvestorTabsProps) {
    const [activeTab, setActiveTab] = useState("dashboard")
    const [investmentFilter, setInvestmentFilter] = useState("")
    const [calendarMode, setCalendarMode] = useState<'masehi' | 'hijri'>('masehi')

    const handleActiveUnitsClick = () => {
        setActiveTab("investments")
        setInvestmentFilter("AVAILABLE")
    }

    const handleSoldUnitsClick = () => {
        setActiveTab("investments")
        setInvestmentFilter("SOLD")
    }

    const currentMonthlyChartData = calendarMode === 'hijri' ? monthlyChartDataHijri : monthlyChartData
    const currentMonthlySalesTrend = calendarMode === 'hijri' ? monthlySalesTrendHijri : monthlySalesTrend
    const currentMonthlyRevenueData = calendarMode === 'hijri' ? monthlyRevenueDataHijri : monthlyRevenueData

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
            <section className="relative overflow-hidden rounded-lg bg-[#073f3b] text-white shadow-2xl shadow-teal-950/15">
                <div className="absolute -right-20 -top-24 size-72 rounded-full bg-cyan-300/20 blur-3xl" />
                <div className="absolute -bottom-24 left-8 size-56 rounded-full bg-lime-300/20 blur-3xl" />
                <div className="relative grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end xl:p-8">
                    <div className="min-w-0">
                        <div className="mb-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-black uppercase tracking-[0.14em] text-lime-100">
                            <Sparkles className="size-4" />
                            Investor portal
                        </div>
                        <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-white [overflow-wrap:anywhere] sm:text-5xl">
                            Assalamu&apos;alaikum, {investorName}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-teal-50/80 sm:text-base">
                            Pantau modal aktif, profit, unit didanai, dan riwayat pembayaran dari satu dashboard yang lebih ringan dibaca.
                        </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-50/70">Total profit bersih</p>
                        <p className="mt-2 text-3xl font-black leading-tight text-white [overflow-wrap:anywhere] sm:text-4xl">
                            {formatCurrency(stats.totalProfit)}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
                            <div>
                                <p className="text-teal-50/60">Unit aktif</p>
                                <p className="font-black text-white">{stats.activeUnitsCount}</p>
                            </div>
                            <div>
                                <p className="text-teal-50/60">Terjual</p>
                                <p className="font-black text-white">{stats.soldUnitsCount}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <TabsList className="grid min-h-12 w-full grid-cols-3 rounded-lg border border-border bg-card p-1 shadow-sm lg:w-[460px]">
                <TabsTrigger value="dashboard" className="rounded-md px-2 py-2 text-xs font-black sm:text-sm">Dashboard</TabsTrigger>
                <TabsTrigger value="investments" className="rounded-md px-2 py-2 text-xs font-black sm:text-sm">Investasi</TabsTrigger>
                <TabsTrigger value="payments" className="rounded-md px-2 py-2 text-xs font-black sm:text-sm">Pembayaran</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-5">
                <ManagedCapitalSelfCard />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard title="Total Akumulasi" value={formatCompactCurrency(stats.totalInvested)} helper="Total riwayat modal" icon={DollarSign} />
                    <StatCard title="Modal Diputar" value={formatCurrency(stats.activeCapital)} helper="Modal sedang aktif" icon={Wallet} tone="teal" />
                    <StatCard title="Total Profit" value={formatCurrency(stats.totalProfit)} helper="Keuntungan bagi hasil" icon={TrendingUp} tone="lime" />
                    <StatCard title="Unit Aktif" value={`${stats.activeUnitsCount} Unit`} helper={`Dari ${stats.totalUnitsCount} unit didanai`} icon={Package} tone="sky" onClick={handleActiveUnitsClick} />
                    <StatCard title="Unit Terjual" value={`${stats.soldUnitsCount} Unit`} helper="Transaksi sudah selesai" icon={CheckCircle} tone="amber" onClick={handleSoldUnitsClick} />
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <Select value={monthsRange} onValueChange={onMonthsRangeChange}>
                        <SelectTrigger className="h-11 w-full rounded-lg border-border sm:w-[200px]">
                            <SelectValue placeholder="Rentang Waktu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="6">6 Bulan Terakhir</SelectItem>
                            <SelectItem value="12">1 Tahun Terakhir</SelectItem>
                            <SelectItem value="24">2 Tahun Terakhir</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="grid grid-cols-2 items-center gap-1 rounded-lg bg-primary/5 p-1">
                        <button
                            type="button"
                            onClick={() => setCalendarMode('masehi')}
                            className={`rounded-md px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${calendarMode === 'masehi'
                                ? 'bg-card text-primary shadow-sm'
                                : 'text-muted-foreground hover:text-primary'
                                }`}
                        >
                            Masehi
                        </button>
                        <button
                            type="button"
                            onClick={() => setCalendarMode('hijri')}
                            className={`rounded-md px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${calendarMode === 'hijri'
                                ? 'bg-card text-primary shadow-sm'
                                : 'text-muted-foreground hover:text-primary'
                                }`}
                        >
                            Hijriyah
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-9">
                    <InvestorRevenueChart data={currentMonthlyRevenueData} className="lg:col-span-3" />
                    <InvestorMonthlyChart data={currentMonthlyChartData} className="lg:col-span-3" />
                    <InvestorSalesTrendChart data={currentMonthlySalesTrend} className="lg:col-span-3" />
                </div>
            </TabsContent>

            <TabsContent value="investments" className="space-y-4">
                <Card className="rounded-lg border-border bg-card shadow-sm">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg font-black text-foreground">Daftar Unit Didanai</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <InvestmentsTable data={investmentsData} defaultFilter={investmentFilter} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
                <Card className="rounded-lg border-border bg-card shadow-sm">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg font-black text-foreground">Riwayat Pembayaran</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <PaymentsTable data={paymentsData} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
