"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"
import type { TopSellingUnit } from "@/lib/top-selling"

interface TopSellingUnitsProps {
    data: TopSellingUnit[]
    className?: string
}

function RankBadge({ rank }: { rank: number }) {
    const tones = [
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        "bg-[var(--mudha-surface-subtle)] text-[var(--mudha-text-muted)]",
        "bg-[var(--mudha-surface-subtle)] text-[var(--mudha-text-muted)]",
    ]
    return (
        <div className={`grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${tones[rank] ?? tones[4]}`}>
            {rank + 1}
        </div>
    )
}

export function TopSellingUnits({ data, className }: TopSellingUnitsProps) {
    return (
        <Card className={`rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)] ${className ?? ""}`}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--mudha-text-main)]">
                    <Trophy aria-hidden="true" className="size-4 text-amber-500" />
                    Top 5 Unit Terlaris
                </CardTitle>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="py-6 text-center">
                        <Trophy aria-hidden="true" className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Belum ada penjualan pada periode ini.</p>
                    </div>
                ) : (
                    <ol className="space-y-3">
                        {data.map((item, index) => (
                            <li key={item.name} className="flex items-center gap-3">
                                <RankBadge rank={index} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black text-foreground">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.count} unit terjual</p>
                                </div>
                                <div
                                    role="progressbar"
                                    aria-label={`${item.name}: ${item.count} unit terjual`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={item.percentage}
                                    className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--mudha-surface-subtle)] sm:w-28"
                                >
                                    <div
                                        className="h-full rounded-full bg-teal-500 transition-all dark:bg-teal-400"
                                        style={{ width: `${item.percentage}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    )
}
