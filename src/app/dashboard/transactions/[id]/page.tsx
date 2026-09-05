"use client"

import Image from "next/image";
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    ArrowLeft,
    Calendar,
    Camera,
    Car,
    DollarSign,
    Eye,
    FileText,
    ImageIcon,
    Pencil,
    Paperclip,
    Plus,
    Trash2,
    TrendingUp,
    Upload,
    Users,
    Wallet,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { formatHijriFull } from "@/lib/date-utils"
import { AddPaymentDialog } from "@/components/transactions/AddPaymentDialog"
import { AddCostDialog } from "@/components/transactions/AddCostDialog"
import { FinalizeTransactionDialog } from "@/components/transactions/FinalizeTransactionDialog"
import { EditTransactionDetailsDialog } from "@/components/transactions/EditTransactionDetailsDialog"
import { ManageCostProofsDialog } from "@/components/transactions/ManageCostProofsDialog"
import { UpdateTransactionProofDialog } from "@/components/transactions/UpdateTransactionProofDialog"
import { exportTransactionReportPDF } from "@/lib/export-utils"
import { UpdateUnitImageDialog } from "@/components/units/UpdateUnitImageDialog"
import { EditProfitSharingDialog } from "@/components/transactions/EditProfitSharingDialog"
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog"
import { StatusBadge, type StatusBadgeTone } from "@/components/mudha/StatusBadge"
import { LoadingState } from "@/components/mudha/LoadingState"
import { ErrorState } from "@/components/mudha/ErrorState"
import { getCostTypeLabel } from "@/lib/cost-types"

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)

const getStatusBadgeTone = (status: string): StatusBadgeTone => {
    if (status === 'COMPLETED') return "success"
    if (status === 'ON_PROCESS') return "warning"
    return "neutral"
}

const getStatusLabel = (status: string) => {
    if (status === 'COMPLETED') return "Selesai"
    if (status === 'ON_PROCESS') return "Berjalan"
    return status.replaceAll("_", " ")
}

export default function TransactionDetailPage() {
    const params = useParams()
    const [transaction, setTransaction] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notFound, setNotFound] = useState(false)
    const [accessDenied, setAccessDenied] = useState(false)
    const [isCostOpen, setIsCostOpen] = useState(false)
    const [editingCost, setEditingCost] = useState<any>(null)

    const [proofCost, setProofCost] = useState<any>(null)
    const [isProofCostOpen, setIsProofCostOpen] = useState(false)
    const [proofType, setProofType] = useState<'BUY' | 'SELL' | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [viewPaymentProof, setViewPaymentProof] = useState<string | null>(null)
    const [isUnitImageOpen, setIsUnitImageOpen] = useState(false)

    const handleExportPDF = async () => {
        if (!transaction) return

        setIsExporting(true)
        toast.loading(`Mengekspor laporan ${transaction.transactionCode}...`)

        const result = await exportTransactionReportPDF(transaction.id, transaction.transactionCode)

        toast.dismiss()
        if (result.success) {
            toast.success("Laporan PDF berhasil diunduh!")
        } else {
            toast.error(result.error || "Gagal mengekspor laporan PDF")
        }
        setIsExporting(false)
    }

    const fetchTransaction = useCallback(async () => {
        if (!params.id) return
        setIsLoading(true)
        setError(null)
        setNotFound(false)
        setAccessDenied(false)
        setTransaction(null)
        try {
            const res = await fetch(`/api/transactions/${params.id}`)
            if (res.status === 404) {
                setNotFound(true)
                return
            }
            if (res.status === 401 || res.status === 403) {
                setAccessDenied(true)
                return
            }
            if (!res.ok) throw new Error("Gagal memuat data transaksi")
            const data = await res.json()
            setTransaction(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data")
        } finally {
            setIsLoading(false)
        }
    }, [params.id])

    useEffect(() => {
        if (params.id) {
            fetchTransaction()
        }
    }, [fetchTransaction, params.id])

    const handleEditCost = (cost: any) => {
        setEditingCost(cost)
        setIsCostOpen(true)
    }

    const handleDeleteCost = async (costId: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus biaya ini?")) return

        try {
            const res = await fetch(`/api/transactions/${params.id}/costs/${costId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                toast.success("Biaya berhasil dihapus")
                fetchTransaction()
            } else {
                toast.error("Gagal menghapus biaya")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        }
    }

    const handleCloseCostDialog = (open: boolean) => {
        setIsCostOpen(open)
        if (!open) {
            setEditingCost(null)
        }
    }

    if (isLoading && !transaction) {
        return (
            <div className="space-y-4 pb-20">
                <LoadingState variant="page" label="Memuat detail transaksi..." />
            </div>
        )
    }

    if (notFound && !transaction) {
        return (
            <div className="space-y-4 pb-20">
                <ErrorState
                    title="Data tidak ditemukan"
                    description="Transaksi yang Anda cari tidak tersedia."
                />
            </div>
        )
    }

    if (accessDenied && !transaction) {
        return (
            <div className="space-y-4 pb-20">
                <ErrorState
                    title="Akses tidak tersedia"
                    description="Data transaksi tidak dapat ditampilkan untuk sesi ini."
                />
            </div>
        )
    }

    if (error && !transaction) {
        return (
            <div className="space-y-4 pb-20">
                <ErrorState
                    title="Gagal memuat detail transaksi"
                    description={error}
                    onRetry={fetchTransaction}
                />
            </div>
        )
    }

    if (!transaction) return null

    const costsInvestor = transaction.costs
        .filter((c: any) => c.payer === "INVESTOR")
        .reduce((sum: number, cost: any) => sum + cost.amount, 0)

    const costsManager = transaction.costs
        .filter((c: any) => c.payer === "MANAGER")
        .reduce((sum: number, cost: any) => sum + cost.amount, 0)

    const baseInvestorCapital = transaction.initialInvestorCapital ?? transaction.buyPrice
    const baseManagerCapital = transaction.initialManagerCapital ?? 0

    const totalCapitalInvestor = baseInvestorCapital + costsInvestor
    const totalCapitalManager = baseManagerCapital + costsManager
    const totalCapital = totalCapitalInvestor + totalCapitalManager

    return (
        <div className="space-y-5 pb-24 lg:space-y-7">
            <section className="rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-4 shadow-[var(--mudha-shadow-xs)] sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 xl:p-8">
                <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/dashboard/transactions">
                            <Button variant="outline" size="icon" className="size-10 shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <StatusBadge
                            label={getStatusLabel(transaction.status)}
                            tone={getStatusBadgeTone(transaction.status)}
                        />
                    </div>

                    <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h1 className="min-w-0 max-w-full text-2xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere] sm:text-3xl">
                                {transaction.transactionCode}
                            </h1>
                            <EditTransactionDetailsDialog
                                transaction={transaction}
                                onSuccess={fetchTransaction}
                                triggerLabel=""
                                triggerClassName="size-9 shrink-0 rounded-lg border p-0"
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--mudha-text-secondary)]">
                            <span className="flex items-center gap-1.5">
                                <Car className="size-4 text-[var(--mudha-primary-700)]" />
                                {transaction.unit.name}
                            </span>
                            <span className="text-[var(--mudha-text-muted)]">·</span>
                            <span className="flex items-center gap-1.5">
                                <Calendar className="size-4 text-[var(--mudha-text-muted)]" />
                                {formatHijriFull(new Date(transaction.buyDate))}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="size-12 shrink-0 overflow-hidden rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-subtle)] transition hover:bg-[var(--mudha-brand-soft)]"
                            onClick={() => transaction.unit.imageUrl && setViewPaymentProof(transaction.unit.imageUrl)}
                            title="Lihat Foto Unit"
                        >
                            {transaction.unit.imageUrl ? (
                                <div className="relative h-full w-full">
                                    <Image
                                        src={transaction.unit.imageUrl}
                                        alt="Unit"
                                        fill
                                        className="object-cover"
                                        style={{ top: 0, left: 0 }}
                                    />
                                </div>
                            ) : (
                                <div className="grid size-full place-items-center">
                                    <ImageIcon className="size-5 text-[var(--mudha-text-muted)]" />
                                </div>
                            )}
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-[var(--mudha-border-brand)] bg-[var(--mudha-brand-soft)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--mudha-primary-900)] [overflow-wrap:anywhere]">
                                    {transaction.unit.code}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-8 shrink-0 rounded-lg p-0"
                                    onClick={() => setIsUnitImageOpen(true)}
                                    title="Update Foto Unit"
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="mt-1 text-sm text-[var(--mudha-text-secondary)] [overflow-wrap:anywhere]">
                                {transaction.unit.plateNumber}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-subtle)] p-4 lg:mt-0">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)]">Total modal</p>
                        <p className="mt-2 text-2xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere] sm:text-3xl">
                            {formatCurrency(totalCapital)}
                        </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
                        {transaction.status === 'COMPLETED' && (
                            <Button
                                variant="outline"
                                onClick={handleExportPDF}
                                disabled={isExporting}
                                className="min-h-11 rounded-lg"
                            >
                                <FileText className="mr-2 h-4 w-4" />
                                {isExporting ? "Mengekspor…" : "Laporan PDF"}
                            </Button>
                        )}
                        {transaction.status !== 'COMPLETED' && (
                            <div className="rounded-lg border border-[var(--mudha-status-warning-border)] bg-[var(--mudha-status-warning-bg)] p-3 text-sm font-medium leading-relaxed text-[var(--mudha-status-warning-text)]">
                                Transaksi masih berjalan. Lengkapi biaya dan bukti sebelum finalisasi.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                <Card className="overflow-hidden rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)]">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)] sm:text-sm"><Wallet className="size-4 text-[var(--mudha-primary-700)]" /> Modal dari Pemodal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(baseInvestorCapital)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[var(--mudha-text-muted)]">
                            {transaction.initialInvestorCapital ? "Modal awal custom" : "Harga Beli Unit"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)]">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)] sm:text-sm"><TrendingUp className="size-4 text-[var(--mudha-primary-600)]" /> Total Modal Pemodal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(totalCapitalInvestor)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[var(--mudha-text-muted)]">
                            Beli + Biaya ({formatCurrency(costsInvestor)})
                        </p>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-lg border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)]">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)] sm:text-sm"><Users className="size-4 text-[var(--mudha-status-warning-text)]" /> Total Modal Pengelola</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(totalCapitalManager)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[var(--mudha-text-muted)]">
                            Modal ({formatCurrency(baseManagerCapital)}) + Biaya ({formatCurrency(costsManager)})
                        </p>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-lg border border-[var(--mudha-border-brand)] bg-[var(--mudha-brand-soft)] shadow-[var(--mudha-shadow-xs)]">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--mudha-primary-900)] sm:text-sm"><DollarSign className="size-4 text-[var(--mudha-primary-700)]" /> Total Modal Keseluruhan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(totalCapital)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[var(--mudha-text-secondary)]">
                            Pemodal + Pengelola
                        </p>
                    </CardContent>
                </Card>
            </div>



            {transaction.status === 'COMPLETED' && transaction.profitSharing && (
                <Card className="overflow-hidden rounded-lg border-[var(--mudha-border-brand)] bg-[var(--mudha-brand-soft)] shadow-[var(--mudha-shadow-xs)]">
                    <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div>
                            <CardTitle className="text-lg font-bold text-[var(--mudha-text-main)]">Hasil Penjualan</CardTitle>
                            <p className="mt-1 text-sm leading-relaxed text-[var(--mudha-text-secondary)]">Ringkasan margin dan pembagian profit transaksi selesai.</p>
                        </div>
                        <EditProfitSharingDialog
                            transactionId={transaction.id}
                            currentInvestorShare={transaction.profitSharing.investorSharePercentage}
                            currentManagerShare={transaction.profitSharing.managerSharePercentage}
                            onSuccess={fetchTransaction}
                        />
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-4">
                        <div className="rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)]">Harga Jual</p>
                            <p className="mt-2 text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.sellPrice)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)]">Margin Bersih</p>
                            <p className="mt-2 text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.profitSharing.netMargin)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)]">Profit Pemodal ({transaction.profitSharing.investorSharePercentage}%)</p>
                            <p className="mt-2 text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.profitSharing.investorProfitAmount)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--mudha-text-muted)]">Profit Pengelola ({transaction.profitSharing.managerSharePercentage}%)</p>
                            <p className="mt-2 text-xl font-bold leading-tight text-[var(--mudha-text-main)] [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.profitSharing.managerProfitAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="costs" className="w-full gap-4">
                <TabsList className="grid min-h-11 w-full grid-cols-2 rounded-lg border border-border bg-card p-1 shadow-sm sm:w-fit">
                    <TabsTrigger value="costs" className="rounded-md px-3 py-2 text-xs font-black sm:text-sm">Biaya Operasional</TabsTrigger>
                    <TabsTrigger value="details" className="rounded-md px-3 py-2 text-xs font-black sm:text-sm">Detail Transaksi</TabsTrigger>
                </TabsList>
                <TabsContent value="costs" className="space-y-4">
                    <div className="flex justify-stretch sm:justify-end">
                        {transaction.status !== 'COMPLETED' && (
                            <Button variant="outline" onClick={() => setIsCostOpen(true)} className="min-h-11 w-full rounded-lg border-teal-200 dark:border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 dark:hover:text-teal-200 sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" /> Tambah Biaya
                            </Button>
                        )}
                        <AddCostDialog
                            transactionId={transaction.id}
                            open={isCostOpen}
                            onOpenChange={handleCloseCostDialog}
                            existingCost={editingCost}
                            onSuccess={fetchTransaction}
                        />
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                        <Table className="min-w-[760px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-black text-muted-foreground">Jenis</TableHead>
                                    <TableHead className="font-black text-muted-foreground">Keterangan</TableHead>
                                    <TableHead className="font-black text-muted-foreground">Dibayar Oleh</TableHead>
                                    <TableHead className="text-right font-black text-muted-foreground">Nominal</TableHead>
                                    <TableHead className="text-right font-black text-muted-foreground">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transaction.costs.map((cost: any) => (
                                    <TableRow key={cost.id}>
                                        <TableCell className="max-w-[180px] whitespace-normal font-semibold [overflow-wrap:anywhere]">{getCostTypeLabel(cost.costType)}</TableCell>
                                        <TableCell className="max-w-[260px] whitespace-normal text-muted-foreground [overflow-wrap:anywhere]">{cost.description}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{cost.payer}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-black [overflow-wrap:anywhere]">
                                            {formatCurrency(cost.amount)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {cost.proofs && cost.proofs.length > 0 ? (
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
                                                        title="Lihat Bukti"
                                                        onClick={() => {
                                                            setProofCost(cost)
                                                            setIsProofCostOpen(true)
                                                        }}
                                                    >
                                                        <Eye className="h-3 w-3 mr-1.5" />
                                                        Lihat Bukti
                                                        <span className="ml-1.5 font-semibold">({cost.proofs.length})</span>
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-3 text-xs border-blue-300 dark:border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                                                    title="Kelola Bukti"
                                                    onClick={() => {
                                                        setProofCost(cost)
                                                        setIsProofCostOpen(true)
                                                    }}
                                                >
                                                    <Upload className="h-3 w-3 mr-1.5" />
                                                    Kelola
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditCost(cost)}
                                                    className="h-8 border-border px-3 text-xs text-foreground hover:bg-muted/50 hover:text-foreground"
                                                    title="Edit biaya"
                                                >
                                                    <Pencil className="mr-1.5 h-3 w-3" />
                                                    Edit
                                                </Button>
                                                {transaction.status !== 'COMPLETED' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteCost(cost.id)}
                                                            className="h-8 w-8 p-0 text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {transaction.costs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4">
                                            Belum ada biaya tercatat.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="details">
                    <Card className="rounded-lg border-border bg-card shadow-sm">
                        <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <div>
                                <CardTitle className="text-lg font-black text-foreground">Informasi Detail</CardTitle>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Data utama transaksi dan catatan internal.</p>
                            </div>
                            <EditTransactionDetailsDialog transaction={transaction} onSuccess={fetchTransaction} />
                        </CardHeader>
                        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-lg bg-muted/50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Kode Transaksi</span>
                                    <p className="mt-2 font-black text-foreground [overflow-wrap:anywhere]">{transaction.transactionCode}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Unit</span>
                                    <p className="mt-2 font-black text-foreground [overflow-wrap:anywhere]">{transaction.unit.name} ({transaction.unit.plateNumber})</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Tanggal Beli</span>
                                    <p className="mt-2 font-black text-foreground [overflow-wrap:anywhere]">{formatHijriFull(new Date(transaction.buyDate))}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Tanggal Laku</span>
                                    <p className="mt-2 font-black text-foreground [overflow-wrap:anywhere]">{transaction.sellDate ? formatHijriFull(new Date(transaction.sellDate)) : '-'}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-4 sm:col-span-2">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Catatan</span>
                                    <p className="mt-2 leading-relaxed text-foreground [overflow-wrap:anywhere]">{transaction.notes || '-'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="overflow-hidden rounded-lg border-border bg-card shadow-sm">
                <CardHeader className="bg-muted/50 p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Dokumen & Bukti Transaksi
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6">
                    <div className="flex h-full flex-col justify-between rounded-lg border border-border bg-card p-4 transition hover:border-blue-200 hover:bg-blue-50/30 md:p-5 dark:hover:border-blue-800 dark:hover:bg-blue-950/40">
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-base font-black leading-snug text-foreground [overflow-wrap:anywhere]">Bukti Beli</p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">Dari Seller</p>
                                </div>
                                {(() => {
                                    const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0)
                                    if (count > 0) {
                                        return <Badge variant="secondary" className="shrink-0 border-green-300 dark:border-green-300 bg-green-100 dark:bg-green-950/40 text-[10px] font-medium text-green-700 dark:text-green-300">{count}</Badge>
                                    }
                                    return <Badge variant="outline" className="shrink-0 border-border text-[10px] text-muted-foreground">0</Badge>
                                })()}
                            </div>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2">
                            {(() => {
                                const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0)
                                if (count > 0) {
                                    return (
                                        <Button variant="default" size="sm" onClick={() => setProofType('BUY')} className="min-h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
                                            <Eye className="mr-1.5 h-3 w-3" /> Lihat
                                        </Button>
                                    )
                                }
                            })()}
                            <Button variant="outline" size="sm" onClick={() => setProofType('BUY')} className={`${(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0); return count > 0 ? '' : 'flex-1' })()} min-h-9 rounded-lg border-blue-300 dark:border-blue-300 px-3 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:hover:text-blue-200`}>
                                <Upload className="mr-1.5 h-3 w-3" /> {(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0); return count > 0 ? '' : 'Kelola' })()}
                            </Button>
                        </div>
                    </div>
                    <div className="flex h-full flex-col justify-between rounded-lg border border-border bg-card p-4 transition hover:border-blue-200 hover:bg-blue-50/30 md:p-5 dark:hover:border-blue-800 dark:hover:bg-blue-950/40">
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-base font-black leading-snug text-foreground [overflow-wrap:anywhere]">Bukti Lunas</p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">Dari Buyer</p>
                                </div>
                                {(() => {
                                    const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0)
                                    if (count > 0) {
                                        return <Badge variant="secondary" className="shrink-0 border-green-300 dark:border-green-300 bg-green-100 dark:bg-green-950/40 text-[10px] font-medium text-green-700 dark:text-green-300">{count}</Badge>
                                    }
                                    return <Badge variant="outline" className="shrink-0 border-border text-[10px] text-muted-foreground">0</Badge>
                                })()}
                            </div>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2">
                            {(() => {
                                const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0)
                                if (count > 0) {
                                    return (
                                        <Button variant="default" size="sm" onClick={() => setProofType('SELL')} className="min-h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
                                            <Eye className="mr-1.5 h-3 w-3" /> Lihat
                                        </Button>
                                    )
                                }
                            })()}
                            <Button variant="outline" size="sm" onClick={() => setProofType('SELL')} className={`${(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0); return count > 0 ? '' : 'flex-1' })()} min-h-9 rounded-lg border-blue-300 dark:border-blue-300 px-3 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:hover:text-blue-200`}>
                                <Upload className="mr-1.5 h-3 w-3" /> {(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0); return count > 0 ? '' : 'Kelola' })()}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {transaction.status === 'COMPLETED' && (
                <Card className="rounded-lg border-border bg-card shadow-sm">
                    <CardHeader className="p-4 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-lg font-black text-foreground">Pembayaran Bagi Hasil (Profit Sharing)</CardTitle>
                            <AddPaymentDialog
                                transactionId={transaction.id}
                                investorId={transaction.unit.investorId}
                                onSuccess={fetchTransaction}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        {transaction.paymentHistories && transaction.paymentHistories.length > 0 ? (
                            <div className="space-y-4">
                                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                                    <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Harus Dibayar</p>
                                        <p className="text-xl font-bold text-blue-900 dark:text-blue-300 [overflow-wrap:anywhere]">
                                            {formatCurrency(transaction.payment.investorShouldReceive)}
                                        </p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-green-800 dark:text-green-300">Sudah Dibayar</p>
                                        <p className="text-xl font-bold text-green-900 dark:text-green-300 [overflow-wrap:anywhere]">
                                            {formatCurrency(transaction.payment.totalPaid)}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-950/40 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Sisa</p>
                                        <p className="text-xl font-bold text-orange-900 dark:text-orange-300 [overflow-wrap:anywhere]">
                                            {formatCurrency(transaction.payment.remaining)}
                                        </p>
                                        <Badge className="mt-1" variant={transaction.payment.paymentStatus === 'PAID' ? 'default' : transaction.paymentStatus === 'PARTIAL' ? 'secondary' : 'destructive'}>
                                            {transaction.payment.paymentStatus}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-lg border">
                                    <Table className="min-w-[700px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead>Metode</TableHead>
                                                <TableHead>Jumlah</TableHead>
                                                <TableHead>Catatan</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transaction.paymentHistories.map((payment: any) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell className="whitespace-normal [overflow-wrap:anywhere]">{formatHijriFull(new Date(payment.paymentDate))}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{payment.method}</Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium [overflow-wrap:anywhere]">
                                                        {formatCurrency(payment.amount)}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal text-sm text-muted-foreground [overflow-wrap:anywhere]">
                                                        {payment.notes || '-'}
                                                        {payment.proofImageUrl && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="ml-2 h-6 border border-border bg-muted px-2 text-xs text-foreground hover:bg-muted/80"
                                                                onClick={() => setViewPaymentProof(payment.proofImageUrl)}
                                                            >
                                                                <Paperclip className="mr-1 inline h-3.5 w-3.5 align-[-1px]" aria-hidden="true" />
                                                                Lihat Bukti
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Belum ada pembayaran yang tercatat.</p>
                                <p className="text-sm mt-1">Klik tombol &quot;Tambah Pembayaran&quot; untuk menambahkan pembayaran.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {transaction.status !== 'COMPLETED' && (
                <div className="sticky bottom-0 flex justify-stretch border-t bg-background p-3 pt-4 shadow-top safe-pb sm:justify-end">
                    <FinalizeTransactionDialog
                        transactionId={transaction.id}
                        onSuccess={fetchTransaction}
                        defaultShares={{
                            investor: transaction.unit.investor.marginPercentage || 50,
                            manager: 100 - (transaction.unit.investor.marginPercentage || 50)
                        }}
                    />
                </div>
            )}

            {/* Dialogs */}
            {proofCost && (
                <ManageCostProofsDialog
                    open={isProofCostOpen}
                    onOpenChange={(open) => {
                        setIsProofCostOpen(open)
                        if (!open) setProofCost(null)
                    }}
                    transactionId={transaction.id}
                    cost={proofCost}
                    onSuccess={fetchTransaction}
                />
            )}

            {proofType && (
                <UpdateTransactionProofDialog
                    open={!!proofType}
                    onOpenChange={(open) => !open && setProofType(null)}
                    transaction={transaction}
                    type={proofType}
                    onSuccess={fetchTransaction}
                />
            )}

            <UpdateUnitImageDialog
                open={isUnitImageOpen}
                onOpenChange={setIsUnitImageOpen}
                unit={transaction.unit}
                onSuccess={fetchTransaction}
            />

            <ImagePreviewDialog
                src={viewPaymentProof}
                isOpen={!!viewPaymentProof}
                onOpenChange={(open) => !open && setViewPaymentProof(null)}
                title="Pratinjau Gambar"
            />
        </div>
    )
}
