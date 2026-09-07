"use client"

import { CalendarRange } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type DashboardPeriodValue = "6" | "12" | "24" | "all" | "custom"

interface DashboardPeriodFilterProps {
    value: DashboardPeriodValue
    onValueChange: (value: DashboardPeriodValue) => void
    customFrom: string
    customTo: string
    onCustomFromChange: (value: string) => void
    onCustomToChange: (value: string) => void
    onApplyCustom: () => void
    className?: string
}

export function DashboardPeriodFilter({
    value,
    onValueChange,
    customFrom,
    customTo,
    onCustomFromChange,
    onCustomToChange,
    onApplyCustom,
    className,
}: DashboardPeriodFilterProps) {
    const customRangeValid = Boolean(customFrom && customTo && customFrom <= customTo)

    return (
        <div className={className}>
            <Select value={value} onValueChange={(next) => onValueChange(next as DashboardPeriodValue)}>
                <SelectTrigger className="h-11 w-full rounded-lg border-border sm:w-[210px]">
                    <SelectValue placeholder="Rentang Waktu" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="6">6 Bulan Terakhir</SelectItem>
                    <SelectItem value="12">1 Tahun Terakhir</SelectItem>
                    <SelectItem value="24">2 Tahun Terakhir</SelectItem>
                    <SelectItem value="all">Semua Waktu</SelectItem>
                    <SelectItem value="custom">Rentang Tanggal…</SelectItem>
                </SelectContent>
            </Select>

            {value === "custom" && (
                <div className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                        <Label htmlFor="dashboard-period-from">Tanggal awal</Label>
                        <Input
                            id="dashboard-period-from"
                            type="date"
                            value={customFrom}
                            max={customTo || undefined}
                            onChange={(event) => onCustomFromChange(event.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="dashboard-period-to">Tanggal akhir</Label>
                        <Input
                            id="dashboard-period-to"
                            type="date"
                            value={customTo}
                            min={customFrom || undefined}
                            onChange={(event) => onCustomToChange(event.target.value)}
                        />
                    </div>
                    <Button type="button" disabled={!customRangeValid} onClick={onApplyCustom} className="h-10">
                        <CalendarRange className="size-4" />
                        Terapkan
                    </Button>
                </div>
            )}
        </div>
    )
}
