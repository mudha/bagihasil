"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvestmentsTable } from "@/components/investor/InvestmentsTable"
import { PaymentsTable } from "@/components/investor/PaymentsTable"
import { DollarSign, TrendingUp, Package } from "lucide-react"
import { InvestorMonthlyChart } from "./InvestorMonthlyChart"
import { InvestorSalesTrendChart } from "./InvestorSalesTrendChart"

interface InvestorTabsProps {
    investorName: string
    stats: {
        totalInvested: number
        totalProfit: number
        activeUnitsCount: number
        totalUnitsCount: number
    }
    monthlyChartData: any[]
    monthlySalesTrend: any[]
    investmentsData: any[]
    paymentsData: any[]
}

export function InvestorTabs({
    investorName,
    stats,
    monthlyChartData,
    monthlySalesTrend,
    investmentsData,
    paymentsData
}: InvestorTabsProps) {
    const [activeTab, setActiveTab] = useState("dashboard")
    const [investmentFilter, setInvestmentFilter] = useState("")

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const handleActiveUnitsClick = () => {
        setActiveTab("investments")
        // Filter untuk unit yang statusnya belum SOLD (misal: "AVAILABLE" atau "ON_PROCESS" yg belum COMPLETED)
        // Di UI kita pakai bahasa Indonesia atau Inggris?
        // Di DB: "AVAILABLE", "SOLD".
        // Di InvestmentsTable kita filter berdasarkan text.
        // Mari kita gunakan "AVAILABLE" sebagai keyword pencarian awal jika Table search support itu.
        // Atau jika 'active' bermakna sedang berjalan, bisa 'Sedang Berjalan'.
        // Mari kita coba "AVAILABLE" dulu, tapi user mungkin ingin lihat semua yang aktif (termasuk on process).
        // Table search bersifat OR searching.
        // Jika saya set "AVAILABLE", mungkin hanya filter status AVAILABLE.
        // Mari kita cek InvestmentsTable lagi.
        // unit.status (DB status) matches query OR transactionStatus matches query.
        // Jika saya kirim "AVAILABLE", maka status AVAILABLE akan muncul.
        setInvestmentFilter("AVAILABLE")
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex justify-between items-center">
                {/* Optional: Add extra header controls here if needed */}
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

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Investasi</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg sm:text-xl md:text-2xl font-bold break-all">
                                {formatCurrency(stats.totalInvested)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Estimasi modal tertanam</p>
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
                            <p className="text-[10px] text-blue-400 mt-1 italic">Klik untuk lihat detail</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                    <InvestorMonthlyChart data={monthlyChartData} className="lg:col-span-4" />
                    <InvestorSalesTrendChart data={monthlySalesTrend} className="lg:col-span-3" />
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
