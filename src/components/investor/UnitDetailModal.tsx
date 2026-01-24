"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, DollarSign, TrendingUp, Package } from "lucide-react"
import { format } from "date-fns"
import { id } from "date-fns/locale"

interface UnitDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transactionId: string | null
}

export function UnitDetailModal({ open, onOpenChange, transactionId }: UnitDetailModalProps) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)

    useEffect(() => {
        if (open && transactionId) {
            fetchTransactionDetail()
        }
    }, [open, transactionId])

    const fetchTransactionDetail = async () => {
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
    }

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
                return <Badge variant="default" className="bg-blue-500">Sedang Berjalan</Badge>
            case "COMPLETED":
                return <Badge variant="default" className="bg-emerald-500">Selesai</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detail Investasi Unit</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-xl font-bold">{data.unit?.name}</h3>
                                <p className="text-muted-foreground">{data.unit?.plateNumber}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Kode: <span className="font-mono font-semibold">{data.transactionCode}</span>
                                </p>
                            </div>
                            {getStatusBadge(data.status)}
                        </div>

                        {/* Unit Image */}
                        {data.unit?.imageUrl && (
                            <div className="rounded-lg overflow-hidden border max-h-64">
                                <img
                                    src={data.unit.imageUrl}
                                    alt={data.unit.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Transaction Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                            <div className="flex items-start gap-3">
                                <Calendar className="h-5 w-5 text-slate-600 mt-0.5" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Tanggal Beli</p>
                                    <p className="font-semibold">
                                        {data.buyDate ? format(new Date(data.buyDate), "d MMMM yyyy", { locale: id }) : "-"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Package className="h-5 w-5 text-slate-600 mt-0.5" />
                                <div>
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
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <DollarSign className="h-5 w-5" />
                                Ringkasan Keuangan
                            </h4>

                            <div className="space-y-2 border rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Harga Beli</span>
                                    <span className="font-semibold">{formatCurrency(data.buyPrice || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Modal dari Anda</span>
                                    <span className="font-semibold text-blue-600">
                                        {formatCurrency(data.initialInvestorCapital || data.buyPrice || 0)}
                                    </span>
                                </div>
                                {data.sellPrice > 0 && (
                                    <div className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-muted-foreground">Harga Jual</span>
                                        <span className="font-semibold text-emerald-600">
                                            {formatCurrency(data.sellPrice)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Total Biaya Operasional</span>
                                    <span className="font-medium text-orange-600">
                                        {formatCurrency(data.costs?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Profit Summary (if sold) */}
                        {data.sellPrice > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                                <h5 className="font-semibold flex items-center gap-2 text-emerald-700">
                                    <TrendingUp className="h-4 w-4" />
                                    Bagi Hasil
                                </h5>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-emerald-700">Profit Bersih</span>
                                    <span className="font-bold text-emerald-700">
                                        {formatCurrency(data.profitSharing?.netMargin || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-emerald-700">
                                        Bagian Anda ({data.profitSharing?.investorSharePercentage ?? 50}%)
                                    </span>
                                    <span className="font-bold text-emerald-600">
                                        {formatCurrency(data.profitSharing?.investorProfitAmount || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-emerald-600">
                                    <span>Status Pembayaran</span>
                                    <span className="font-semibold">
                                        {data.payment?.paymentStatus === "PAID" ? "✅ Lunas" :
                                            data.payment?.paymentStatus === "PARTIAL" ? "⏳ Sebagian" : "⏳ Belum Lunas"}
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
