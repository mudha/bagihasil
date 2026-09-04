"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

interface RevenueChartData {
    month: string
    revenue: number
}

interface InvestorRevenueChartProps {
    data: RevenueChartData[]
    className?: string
}

export function InvestorRevenueChart({ data, className }: InvestorRevenueChartProps) {
    const formatCurrency = (val: number) => {
        // Shorten large numbers (e.g. 1.5jt)
        if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}jt`
        if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}rb`
        return `Rp ${val}`
    }

    const formatTooltipCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(val)

    return (
        <Card className={`rounded-lg border-border bg-card shadow-sm ${className || ""}`}>
            <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base font-black text-foreground">Omset Bulanan</CardTitle>
                <p className="text-sm text-muted-foreground">Volume penjualan per periode</p>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="h-[260px] w-full sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                            <XAxis
                                dataKey="month"
                                stroke="#64748b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                height={60}
                                tick={{ dy: 10 }}
                                angle={-45}
                                textAnchor="end"
                                tickFormatter={(val) => {
                                    const parts = val.split(' ')
                                    if (parts.length >= 2 && ['Awal', 'Akhir'].includes(parts[1])) {
                                        return `${parts[0]} ${parts[1]}`
                                    }
                                    return parts[0]
                                }}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={formatCurrency}
                            />
                            <Tooltip
                                formatter={(value: number) => [formatTooltipCurrency(value), "Omset"]}
                                labelStyle={{ color: "black" }}
                                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                            />
                            <Bar
                                dataKey="revenue"
                                fill="#0f9b8e"
                                radius={[6, 6, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
