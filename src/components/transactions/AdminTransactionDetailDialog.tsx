"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import {
    Calendar,
    User,
    Hash,
    Image as ImageIcon,
    Receipt,
    Banknote,
    Tag,
    Clock,
    DollarSign,
    Car,
    Pencil,
    Eye
} from "lucide-react"
import { ImageHoverPreview } from "@/components/ui/image-hover-preview"
import Image from "next/image"
import { useState } from "react"
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog"

interface Transaction {
    id: string
    transactionCode: string
    buyDate: string
    buyPrice: number
    sellDate?: string | null
    sellPrice?: number | null
    status: string
    unit: {
        name: string
        plateNumber: string
        investorId: string
        imageUrl?: string | null
        vehicleType?: string | null
        brand?: string | null
        model?: string | null
        year?: string | null
        color?: string | null
        investor: {
            name: string
        }
    }
    initialInvestorCapital?: number | null
    initialManagerCapital?: number | null
    buyProofImageUrl?: string | null
    buyProofDescription?: string | null
    notes?: string | null
    costs?: {
        amount: number
        description: string
    }[]
}

interface AdminTransactionDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: Transaction | null
    onEdit?: () => void
    onViewDetail?: () => void
}

export function AdminTransactionDetailDialog({ open, onOpenChange, transaction, onEdit, onViewDetail }: AdminTransactionDetailDialogProps) {
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    if (!transaction) return null

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "AVAILABLE":
                return <Badge variant="outline" className="rounded-full border-green-600 bg-green-50 dark:bg-green-950/40 px-3 py-1 text-green-700 dark:text-green-300">Available</Badge>
            case "ON_PROCESS":
                return <Badge variant="secondary" className="rounded-full bg-blue-100 dark:bg-blue-950/40 px-3 py-1 text-blue-700 dark:text-blue-300">On Process</Badge>
            case "COMPLETED":
                return <Badge variant="default" className="rounded-full bg-emerald-600 px-3 py-1 dark:bg-emerald-700">Completed</Badge>
            case "SOLD":
                return <Badge variant="default" className="rounded-full bg-blue-600 px-3 py-1 dark:bg-blue-700">Sold</Badge>
            default:
                return <Badge variant="secondary" className="rounded-full px-3 py-1">{status}</Badge>
        }
    }

    const totalCosts = transaction.costs?.reduce((acc, curr) => acc + curr.amount, 0) || 0
    const hasSaleInfo = transaction.status === "COMPLETED" && (transaction.sellDate || transaction.sellPrice)

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="min-w-0 grid h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border-border p-0 shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-5xl sm:rounded-2xl">
                    <div className="bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-14 text-white sm:px-6 sm:py-5 sm:pr-16">
                        <DialogHeader>
                            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 space-y-3">
                                    <div className="flex items-center gap-2 text-teal-100/80">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                            <Receipt className="h-5 w-5" />
                                        </span>
                                        <span className="text-xs font-black uppercase tracking-[0.16em]">Detail Transaksi</span>
                                    </div>
                                    <DialogTitle className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                        {transaction.transactionCode}
                                    </DialogTitle>
                                    <p className="max-w-2xl text-sm leading-relaxed text-teal-50/80">
                                        Ringkasan pembelian, unit kendaraan, bukti transaksi, dan rincian modal dalam satu tampilan.
                                    </p>
                                </div>

                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                                    <div className="flex justify-start sm:justify-end">
                                        {getStatusBadge(transaction.status)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:flex">
                                        {onEdit && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={onEdit}
                                                className="h-10 rounded-lg bg-card text-teal-950 shadow-none hover:bg-teal-50 dark:text-teal-100 dark:hover:bg-teal-950/40"
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </Button>
                                        )}
                                        {onViewDetail && (
                                            <Button
                                                size="sm"
                                                onClick={onViewDetail}
                                                className="h-10 rounded-lg bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                Detail
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="min-h-0 overflow-y-auto overscroll-contain bg-muted/50 p-4 sm:p-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                            <section className="space-y-4">
                                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/35 text-teal-800 dark:text-teal-300">
                                            <Car className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-foreground">Unit Kendaraan</h3>
                                            <p className="text-xs text-muted-foreground">Unit yang terhubung dengan transaksi ini.</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                                        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-muted relative">
                                            {transaction.unit.imageUrl ? (
                                                <Image
                                                    src={transaction.unit.imageUrl}
                                                    alt={transaction.unit.name}
                                                    fill
                                                    className="object-cover"
                                                    style={{ top: 0, left: 0 }}
                                                />
                                            ) : (
                                                <Car className="h-8 w-8 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="min-w-0 space-y-3">
                                            <div>
                                                <p className="break-words text-lg font-black leading-snug text-foreground">
                                                    {transaction.unit.name}
                                                </p>
                                                <p className="mt-2 inline-flex max-w-full rounded-lg border border-border bg-muted/50 px-3 py-1 font-mono text-sm font-bold text-foreground [overflow-wrap:anywhere]">
                                                    {transaction.unit.plateNumber || "-"}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                {transaction.unit.year && <span className="rounded-full bg-muted px-2 py-1">{transaction.unit.year}</span>}
                                                {transaction.unit.color && <span className="rounded-full bg-muted px-2 py-1">{transaction.unit.color}</span>}
                                                {transaction.unit.vehicleType && <span className="rounded-full bg-muted px-2 py-1">{transaction.unit.vehicleType}</span>}
                                            </div>
                                            <div className="rounded-lg bg-teal-50 dark:bg-teal-950/35 p-3">
                                                <p className="text-xs font-semibold text-teal-900/60 dark:text-teal-200">Pemilik Unit</p>
                                                <p className="mt-1 break-words font-bold text-teal-950 dark:text-teal-100">{transaction.unit.investor.name}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                                            <Tag className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <h3 className="font-black text-foreground">Informasi Utama</h3>
                                            <p className="text-xs text-muted-foreground">Tanggal, harga, dan komposisi modal.</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-border bg-muted/50 p-3">
                                            <p className="text-xs font-semibold text-muted-foreground">Tanggal Beli</p>
                                            <p className="mt-2 flex items-start gap-2 break-words font-bold text-foreground">
                                                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
                                                {transaction.buyDate ? format(new Date(transaction.buyDate), "dd MMMM yyyy", { locale: id }) : "-"}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/50 p-3">
                                            <p className="text-xs font-semibold text-muted-foreground">Harga Beli</p>
                                            <p className="mt-2 flex items-start gap-2 break-words font-bold text-foreground">
                                                <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
                                                {formatCurrency(transaction.buyPrice)}
                                            </p>
                                        </div>
                                        {transaction.initialInvestorCapital !== null && transaction.initialInvestorCapital !== undefined && (
                                            <div className="rounded-lg border border-blue-100 bg-blue-50 dark:bg-blue-950/40 p-3">
                                                <p className="text-xs font-semibold text-blue-900/60 dark:text-blue-200">Modal Pemodal</p>
                                                <p className="mt-2 break-words font-black text-blue-700 dark:text-blue-300">{formatCurrency(transaction.initialInvestorCapital)}</p>
                                            </div>
                                        )}
                                        {transaction.initialManagerCapital !== null && transaction.initialManagerCapital !== undefined && (
                                            <div className="rounded-lg border border-orange-100 bg-orange-50 dark:bg-orange-950/40 p-3">
                                                <p className="text-xs font-semibold text-orange-900/60 dark:text-orange-200">Modal Pengelola</p>
                                                <p className="mt-2 break-words font-black text-orange-700 dark:text-orange-300">{formatCurrency(transaction.initialManagerCapital)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {transaction.costs && transaction.costs.length > 0 && (
                                    <div className="rounded-xl border border-orange-200 dark:border-orange-300 bg-orange-50 dark:bg-orange-950/40 p-4 shadow-sm">
                                        <div className="mb-4 flex items-center gap-2 text-orange-950 dark:text-orange-100">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-orange-700 dark:text-orange-300">
                                                <Banknote className="h-5 w-5" />
                                            </span>
                                            <div>
                                                <h3 className="font-black">Biaya & Pengeluaran</h3>
                                                <p className="text-xs text-orange-900/60 dark:text-orange-200">Rincian biaya tambahan transaksi.</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {transaction.costs.map((cost, index) => (
                                                <div key={index} className="grid gap-1 rounded-lg bg-card/75 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                                                    <span className="min-w-0 break-words text-foreground">{cost.description || "Biaya"}</span>
                                                    <span className="font-black text-orange-700 dark:text-orange-300 sm:text-right">{formatCurrency(cost.amount)}</span>
                                                </div>
                                            ))}
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-orange-200 dark:border-orange-300 pt-3 font-black">
                                                <span>Total Biaya</span>
                                                <span className="text-orange-700 dark:text-orange-300">{formatCurrency(totalCosts)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {transaction.notes && (
                                    <div className="rounded-xl border border-amber-200 dark:border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4">
                                        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800 dark:text-amber-300">Catatan</p>
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-amber-950 dark:text-amber-100">{transaction.notes}</p>
                                    </div>
                                )}
                            </section>

                            <aside className="space-y-4">
                                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                                    <div className="mb-3 flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="font-black text-foreground">Bukti Pembelian</h3>
                                    </div>
                                    <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted relative">
                                        {transaction.buyProofImageUrl ? (
                                            <ImageHoverPreview
                                                src={transaction.buyProofImageUrl}
                                                alt="Bukti Beli"
                                                className="h-full w-full relative"
                                            >
                                                <button
                                                    type="button"
                                                    className="block h-full min-h-[220px] w-full cursor-pointer bg-slate-950 relative"
                                                    onClick={() => setPreviewImage(transaction.buyProofImageUrl || null)}
                                                >
                                                    <Image
                                                        src={transaction.buyProofImageUrl}
                                                        alt="Bukti Beli"
                                                        fill
                                                        className="object-contain transition-opacity hover:opacity-95"
                                                        style={{ top: 0, left: 0 }}
                                                    />
                                                </button>
                                            </ImageHoverPreview>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                                                <ImageIcon className="h-10 w-10 opacity-30" />
                                                <span className="text-sm font-semibold">Tidak ada bukti foto</span>
                                            </div>
                                        )}
                                    </div>
                                    {transaction.buyProofDescription && (
                                        <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-sm italic text-muted-foreground">
                                            &quot;{transaction.buyProofDescription}&quot;
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                                            <Hash className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <h3 className="font-black text-foreground">Detail Lainnya</h3>
                                            <p className="text-xs text-muted-foreground">Status dan info tambahan transaksi.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex gap-3 rounded-lg bg-muted/50 p-3">
                                            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-muted-foreground">Pemilik Unit</p>
                                                <p className="mt-1 break-words font-bold text-foreground">{transaction.unit.investor.name}</p>
                                            </div>
                                        </div>

                                        {hasSaleInfo && (
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                                {transaction.sellDate && (
                                                    <div className="flex gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3">
                                                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-emerald-900/60 dark:text-emerald-200">Tanggal Jual</p>
                                                            <p className="mt-1 break-words font-bold text-emerald-800 dark:text-emerald-300">
                                                                {format(new Date(transaction.sellDate), "dd MMMM yyyy", { locale: id })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                {transaction.sellPrice && (
                                                    <div className="flex gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3">
                                                        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-emerald-900/60 dark:text-emerald-200">Harga Jual</p>
                                                            <p className="mt-1 break-words font-bold text-emerald-800 dark:text-emerald-300">
                                                                {formatCurrency(transaction.sellPrice)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ImagePreviewDialog
                isOpen={!!previewImage}
                onOpenChange={(open) => !open && setPreviewImage(null)}
                src={previewImage || ""}
                title="Pratinjau Bukti"
            />
        </>
    )
}
