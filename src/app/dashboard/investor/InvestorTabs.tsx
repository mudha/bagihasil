"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvestmentsTable } from "@/components/investor/InvestmentsTable"
import { PaymentsTable } from "@/components/investor/PaymentsTable"
import { DollarSign, TrendingUp, Package, Wallet } from "lucide-react"
import { InvestorMonthlyChart } from "./InvestorMonthlyChart"
import { InvestorSalesTrendChart } from "./InvestorSalesTrendChart"

interface InvestorTabsProps {
    investorName: string
    stats: {
        totalInvested: number
        activeCapital: number
        totalProfit: number
        activeUnitsCount: number
        totalUnitsCount: number
    }
    monthlyChartData: any[]
    monthlySalesTrend: any[]
    monthlyChartDataHijri: any[]
    monthlySalesTrendHijri: any[]
    investmentsData: any[]
    paymentsData: any[]
}

export function InvestorTabs({
    investorName,
    stats,
    monthlyChartData,
    monthlySalesTrend,
    monthlyChartDataHijri,
    monthlySalesTrendHijri,
    investmentsData,
    paymentsData
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

    const currentMonthlyChartData = calendarMode === 'hijri' ? monthlyChartDataHijri : monthlyChartData
    const currentMonthlySalesTrend = calendarMode === 'hijri' ? monthlySalesTrendHijri : monthlySalesTrend

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
                {/* Empty div or Title if needed */}
                <div></div>
                <div className="flex bg-muted p-1 rounded-lg">
                    <button
                        onClick={() => setCalendarMode('masehi')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${calendarMode === 'masehi' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
                    >
                        Masehi
                    </button>
                    <button
                        onClick={() => setCalendarMode('hijri')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${calendarMode === 'hijri' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
                    >
                        Hijriyah
                    </button>
                </div>
            </div>

            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="investments">Investasi</TabsTrigger>
                <TabsTrigger value="payments">Pembayaran</TabsTrigger>
            </TabsList>

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
                </div>

                <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                    <InvestorMonthlyChart data={currentMonthlyChartData} className="lg:col-span-4" />
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
        </Tabs>
    )
}
