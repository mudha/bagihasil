"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvestmentsTable } from "@/components/investor/InvestmentsTable"
import { PaymentsTable } from "@/components/investor/PaymentsTable"
import { DollarSign, TrendingUp, Package, Wallet, CheckCircle } from "lucide-react"
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const formatCompactCurrency = (value: number) => {
        if (value >= 1_000_000_000) {
            return new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 1, // 1 decimal place, e.g. 2,5 M
            }).format(value / 1_000_000_000).replace("Rp", "Rp") + " M"
        }
        return formatCurrency(value)
    }

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="mb-6">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="investments">Investasi</TabsTrigger>
                    <TabsTrigger value="payments">Pembayaran</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="dashboard" className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Assalamu&apos;alaikum, {investorName}</h2>
                    <p className="text-muted-foreground">Ringkasan performa investasi Anda.</p>
                </div>

                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Akumulasi</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg sm:text-xl md:text-2xl font-bold break-all">
                                {formatCompactCurrency(stats.totalInvested)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Total riwayat modal</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Modal Diputar</CardTitle>
                            <Wallet className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-700 break-all">
                                {formatCurrency(stats.activeCapital)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Modal sedang aktif</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Profit Bersih</CardTitle>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-600 break-all">
                                {formatCurrency(stats.totalProfit)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Keuntungan bagi hasil</p>
                        </CardContent>
                    </Card>
                    <Card
                        className="cursor-pointer hover:bg-slate-50 transition-colors border-blue-200"
                        onClick={handleActiveUnitsClick}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-blue-700">Unit Aktif</CardTitle>
                            <Package className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-700">{stats.activeUnitsCount} Unit</div>
                            <p className="text-xs text-blue-600/80">Dari total {stats.totalUnitsCount} unit didanai</p>
                            <p className="text-blue-400 text-[10px] mt-1 italic">Klik untuk lihat detail</p>
                        </CardContent>
                    </Card>
                    <Card
                        className="cursor-pointer hover:bg-slate-50 transition-colors border-amber-200"
                        onClick={handleSoldUnitsClick}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-amber-700">Unit Terjual</CardTitle>
                            <CheckCircle className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-700">{stats.soldUnitsCount} Unit</div>
                            <p className="text-xs text-amber-600/80">Sudah selesai transaksi</p>
                            <p className="text-amber-400 text-[10px] mt-1 italic">Klik untuk lihat detail</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-between items-center mb-4">
                    <Select value={monthsRange} onValueChange={onMonthsRangeChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Rentang Waktu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="6">6 Bulan Terakhir</SelectItem>
                            <SelectItem value="12">1 Tahun Terakhir</SelectItem>
                            <SelectItem value="24">2 Tahun Terakhir</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-full border border-slate-200">
                        <button
                            onClick={() => setCalendarMode('masehi')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${calendarMode === 'masehi'
                                ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Masehi
                        </button>
                        <button
                            onClick={() => setCalendarMode('hijri')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${calendarMode === 'hijri'
                                ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Hijriyah
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 grid-cols-1 lg:grid-cols-9">
                    <InvestorRevenueChart data={currentMonthlyRevenueData} className="lg:col-span-3" />
                    <InvestorMonthlyChart data={currentMonthlyChartData} className="lg:col-span-3" />
                    <InvestorSalesTrendChart data={currentMonthlySalesTrend} className="lg:col-span-3" />
                </div>
            </TabsContent>

            <TabsContent value="investments" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Unit Didanai</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <InvestmentsTable data={investmentsData} defaultFilter={investmentFilter} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Riwayat Pembayaran</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PaymentsTable data={paymentsData} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs >
    )
}
