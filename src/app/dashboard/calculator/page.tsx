"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Calculator, RefreshCw, DollarSign, TrendingUp, PieChart } from "lucide-react"
// import { formatCurrency } from "@/lib/utils" 

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

export default function CalculatorPage() {
    const [buyPrice, setBuyPrice] = useState<number>(0)
    const [repairCost, setRepairCost] = useState<number>(0)
    const [otherCost, setOtherCost] = useState<number>(0)
    const [targetSellPrice, setTargetSellPrice] = useState<number>(0)
    const [investorSharePct, setInvestorSharePct] = useState<number>(40)

    const [results, setResults] = useState({
        totalCapital: 0,
        grossProfit: 0,
        netProfit: 0, // Assuming no other deductions for now, keeping it same as gross
        roi: 0,
        investorShare: 0,
        managerShare: 0
    })

    useEffect(() => {
        const totalCapital = buyPrice + repairCost + otherCost
        const grossProfit = targetSellPrice - totalCapital
        // Avoid division by zero
        const roi = totalCapital > 0 ? (grossProfit / totalCapital) * 100 : 0

        const investorShare = grossProfit > 0 ? grossProfit * (investorSharePct / 100) : 0
        const managerShare = grossProfit > 0 ? grossProfit * ((100 - investorSharePct) / 100) : 0

        setResults({
            totalCapital,
            grossProfit,
            netProfit: grossProfit,
            roi,
            investorShare,
            managerShare
        })
    }, [buyPrice, repairCost, otherCost, targetSellPrice, investorSharePct])

    const resetCalculator = () => {
        setBuyPrice(0)
        setRepairCost(0)
        setOtherCost(0)
        setTargetSellPrice(0)
        setInvestorSharePct(40)
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Kalkulator Estimasi Profit</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* INPUT SECTION */}
                <Card className="col-span-4 lg:col-span-3 border-emerald-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-emerald-700">
                            <Calculator className="h-5 w-5" />
                            Input Simulasi
                        </CardTitle>
                        <CardDescription>
                            Masukkan estimasi harga beli dan biaya untuk melihat potensi profit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="buyPrice">Harga Beli Unit</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="buyPrice"
                                    type="number"
                                    placeholder="0"
                                    className="pl-8"
                                    value={buyPrice || ''}
                                    onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="repairCost">Estimasi Perbaikan</Label>
                                <Input
                                    id="repairCost"
                                    type="number"
                                    placeholder="0"
                                    value={repairCost || ''}
                                    onChange={(e) => setRepairCost(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="otherCost">Biaya Lainnya</Label>
                                <Input
                                    id="otherCost"
                                    type="number"
                                    placeholder="0"
                                    value={otherCost || ''}
                                    onChange={(e) => setOtherCost(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                            <Label htmlFor="targetSellPrice" className="text-base">Target Harga Jual</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-emerald-600" />
                                <Input
                                    id="targetSellPrice"
                                    type="number"
                                    placeholder="0"
                                    className="pl-8 border-emerald-200 focus-visible:ring-emerald-500"
                                    value={targetSellPrice || ''}
                                    onChange={(e) => setTargetSellPrice(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex justify-between">
                                <Label>Bagi Hasil Pemodal</Label>
                                <span className="text-sm font-medium">{investorSharePct}%</span>
                            </div>
                            <Slider
                                value={[investorSharePct]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(val: number[]) => setInvestorSharePct(val[0])}
                                className="py-2"
                            />
                            <p className="text-xs text-muted-foreground text-right">
                                Pengelola: {100 - investorSharePct}%
                            </p>
                        </div>

                        <Button variant="outline" className="w-full mt-4" onClick={resetCalculator}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Reset Kalkulator
                        </Button>
                    </CardContent>
                </Card>

                {/* RESULT SECTION */}
                <div className="col-span-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Modal</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(results.totalCapital)}</div>
                                <p className="text-xs text-muted-foreground">
                                    Beli + Perbaikan + Lainnya
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Estimasi Profit Bersih</CardTitle>
                                <TrendingUp className={results.grossProfit >= 0 ? "h-4 w-4 text-green-500" : "h-4 w-4 text-red-500"} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${results.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatCurrency(results.grossProfit)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    ROI: <span className={results.roi >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                        {results.roi.toFixed(1)}%
                                    </span>
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-slate-50 border-slate-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-slate-700">
                                <PieChart className="h-5 w-5" />
                                Estimasi Pembagian Profit
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">Bagian Pemodal ({investorSharePct}%)</p>
                                        <p className="text-xs text-muted-foreground">Return on Investment</p>
                                    </div>
                                    <div className="text-right font-bold text-lg text-emerald-600">
                                        {formatCurrency(results.investorShare)}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">Bagian Pengelola ({100 - investorSharePct}%)</p>
                                        <p className="text-xs text-muted-foreground">Operational Success</p>
                                    </div>
                                    <div className="text-right font-bold text-lg text-blue-600">
                                        {formatCurrency(results.managerShare)}
                                    </div>
                                </div>
                            </div>

                            {results.grossProfit < 0 && (
                                <div className="mt-4 p-3 bg-red-100 text-red-800 text-sm rounded-md border border-red-200">
                                    <strong>Peringatan:</strong> Estimasi menunjukkan kerugian sebesar {formatCurrency(Math.abs(results.grossProfit))}. Cek kembali harga beli atau biaya perbaikan.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
