"use client"

import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, DollarSign, TrendingUp, Package } from "lucide-react"
import { formatHijriFull } from "@/lib/date-utils"
import Image from "next/image"

interface UnitDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transactionId: string | null
}

export function UnitDetailModal({ open, onOpenChange, transactionId }: UnitDetailModalProps) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)

    const fetchTransactionDetail = useCallback(async () => {
        if (!transactionId) return

        setLoading(true)
        try {
            const res = await fetch(`/api/transactions/${transactionId}`)
            if (res.ok) {
                const result = await res.json()
                setData(result)
            }
        } catch (error) {
            console.error("Failed to fetch transaction detail:", error)
        } finally {
            setLoading(false)
        }
    }, [transactionId])

    useEffect(() => {
        if (open && transactionId) {
            fetchTransactionDetail()
        }
    }, [fetchTransactionDetail, open, transactionId])

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ON_PROCESS":
                return <Badge variant="default" className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900/35 dark:text-amber-200 dark:hover:bg-amber-900/45">Sedang Berjalan</Badge>
            case "COMPLETED":
                return <Badge variant="default" className="bg-lime-100 text-lime-900 hover:bg-lime-100 dark:bg-lime-900/35 dark:text-lime-200 dark:hover:bg-lime-900/45">Selesai</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-lg border-border p-0">
                <DialogHeader>
                    <DialogTitle className="sr-only">Detail Investasi Unit</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : data ? (
                    <div className="space-y-5 p-4 sm:p-6">
                        {/* Header Info */}
                        <div className="rounded-lg bg-[#073f3b] p-4 text-white shadow-lg shadow-teal-950/10">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-100">Detail Investasi Unit</p>
                                    <h3 className="mt-2 text-2xl font-black leading-tight [overflow-wrap:anywhere]">{data.unit?.name}</h3>
                                    <p className="mt-1 text-teal-50/75 [overflow-wrap:anywhere]">{data.unit?.plateNumber}</p>
                                    <p className="mt-2 text-sm text-teal-50/75 [overflow-wrap:anywhere]">
                                    Kode: <span className="font-mono font-semibold">{data.transactionCode}</span>
                                    </p>
                                </div>
                                <div className="shrink-0">{getStatusBadge(data.status)}</div>
                            </div>
                        </div>

                        {/* Unit Image */}
                        {data.unit?.imageUrl && (
                            <div className="relative h-[280px] overflow-hidden rounded-lg border border-border bg-muted sm:h-[420px]">
                                <Image
                                    src={data.unit.imageUrl}
                                    alt={data.unit.name}
                                    fill
                                    sizes="(min-width: 768px) 720px, 100vw"
                                    className="object-contain"
                                />
                            </div>
                        )}

                        {/* Transaction Info */}
                        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted p-4 sm:grid-cols-2">
                            <div className="flex items-start gap-3 rounded-lg bg-card p-3">
                                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-300" />
                                <div className="min-w-0">
                                    <p className="text-sm text-muted-foreground">Tanggal Beli</p>
                                    <p className="font-semibold [overflow-wrap:anywhere]">
                                        {data.buyDate ? formatHijriFull(new Date(data.buyDate)) : "-"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-lg bg-card p-3">
                                <Package className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-300" />
                                <div className="min-w-0">
                                    <p className="text-sm text-muted-foreground">Status Unit</p>
                                    <p className="font-semibold">
                                        <Badge variant={data.unit?.status === "SOLD" ? "secondary" : "default"}>
                                            {data.unit?.status}
                                        </Badge>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="space-y-3">
                            <h4 className="flex items-center gap-2 text-lg font-black text-foreground">
                                <DollarSign className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                                Ringkasan Keuangan
                            </h4>

                            <div className="space-y-2 rounded-lg border border-border p-4">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-muted-foreground">Harga Beli</span>
                                    <span className="font-semibold [overflow-wrap:anywhere]">{formatCurrency(data.buyPrice || 0)}</span>
                                </div>
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-muted-foreground">Modal dari Anda</span>
                                    <span className="font-semibold text-teal-700 dark:text-teal-300 [overflow-wrap:anywhere]">
                                        {formatCurrency(data.initialInvestorCapital || data.buyPrice || 0)}
                                    </span>
                                </div>
                                {data.sellPrice > 0 && (
                                    <div className="flex flex-col gap-1 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
                                        <span className="text-muted-foreground">Harga Jual</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-300 [overflow-wrap:anywhere]">
                                            {formatCurrency(data.sellPrice)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-muted-foreground">Total Biaya Operasional</span>
                                    <span className="font-medium text-orange-600 dark:text-orange-300 [overflow-wrap:anywhere]">
                                        {formatCurrency(data.costs?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Profit Summary (if sold) */}
                        {data.sellPrice > 0 && (
                            <div className="space-y-3 rounded-lg border border-lime-200 bg-lime-50 p-4 dark:border-lime-900/50 dark:bg-lime-950/30">
                                <h5 className="flex items-center gap-2 font-black text-lime-800 dark:text-lime-200">
                                    <TrendingUp className="h-4 w-4" />
                                    Bagi Hasil
                                </h5>
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-sm text-lime-800 dark:text-lime-200">Profit Bersih</span>
                                    <span className="font-bold text-lime-900 dark:text-lime-100 [overflow-wrap:anywhere]">
                                        {formatCurrency(data.profitSharing?.netMargin || 0)}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-sm text-lime-800 dark:text-lime-200">
                                        Bagian Anda ({data.profitSharing?.investorSharePercentage ?? 50}%)
                                    </span>
                                    <span className="font-bold text-lime-700 dark:text-lime-300 [overflow-wrap:anywhere]">
                                        {formatCurrency(data.profitSharing?.investorProfitAmount || 0)}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1 text-xs text-lime-700 dark:text-lime-300 sm:flex-row sm:items-center sm:justify-between">
                                    <span>Status Pembayaran</span>
                                    <span className="font-semibold">
                                        {data.payment?.paymentStatus === "PAID" ? "Lunas" :
                                            data.payment?.paymentStatus === "PARTIAL" ? "Sebagian" : "Belum Lunas"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        Tidak ada data
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
