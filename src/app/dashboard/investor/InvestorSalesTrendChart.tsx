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
        <Card className={className}>
            <CardHeader>
                <CardTitle>Tren Penjualan Unit (6 Bulan Terakhir)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="month"
                                stroke="#888888"
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
                                stroke="#888888"
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
                                fill="#3b82f6" // blue-500
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
