"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

interface MonthlyChartData {
    month: string
    income: number
}

interface InvestorMonthlyChartProps {
    data: MonthlyChartData[]
}

export function InvestorMonthlyChart({ data }: InvestorMonthlyChartProps) {
    const formatCurrency = (val: number) => {
        // Shorten large numbers (e.g. 1.5jt)
        if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}jt`
        if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}rb`
        return `Rp ${val}`
    }

    const formatTooltipCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(val)

    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Pendapatan Bulanan (6 Bulan Terakhir)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
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
                                tickFormatter={formatCurrency}
                            />
                            <Tooltip
                                formatter={(value: number) => [formatTooltipCurrency(value), "Pendapatan"]}
                                labelStyle={{ color: "black" }}
                                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                            />
                            <Bar
                                dataKey="income"
                                fill="#10b981" // emerald-500
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
