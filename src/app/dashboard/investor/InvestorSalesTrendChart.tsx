"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

interface SalesTrendData {
    month: string
    count: number
}

interface InvestorSalesTrendChartProps {
    data: SalesTrendData[]
    className?: string
}

export function InvestorSalesTrendChart({ data, className }: InvestorSalesTrendChartProps) {
    return (
        <Card className={`rounded-lg border-border bg-card shadow-sm ${className || ""}`}>
            <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base font-black text-foreground">Tren Penjualan Unit</CardTitle>
                <p className="text-sm text-muted-foreground">Unit selesai per periode</p>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="h-[260px] w-full sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
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
                                allowDecimals={false}
                            />
                            <Tooltip
                                formatter={(value: number) => [value, "Unit Terjual"]}
                                labelStyle={{ color: "black" }}
                                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                            />
                            <Bar
                                dataKey="count"
                                fill="#0ea5e9"
                                radius={[6, 6, 0, 0]}
                                barSize={36}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
