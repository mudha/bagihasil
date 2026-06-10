"use client"

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
    Plus,
    ReceiptText,
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

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)

const getStatusTone = (status: string) => {
    if (status === 'COMPLETED') return "border-lime-200 bg-lime-100 text-lime-900"
    if (status === 'ON_PROCESS') return "border-amber-200 bg-amber-100 text-amber-900"
    return "border-slate-200 bg-white text-slate-800"
}

export default function TransactionDetailPage() {
    const params = useParams()
    const [transaction, setTransaction] = useState<any>(null)
    const [isCostOpen, setIsCostOpen] = useState(false)
    const [editingCost, setEditingCost] = useState<any>(null)

    // New states
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
        try {
            const res = await fetch(`/api/transactions/${params.id}`)
            if (!res.ok) throw new Error("Failed to fetch")
            const data = await res.json()
            setTransaction(data)
        } catch (error) {
            console.error("Error fetching transaction:", error)
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

    if (!transaction) {
        return (
            <div className="space-y-4 pb-20">
                <div className="h-56 animate-pulse rounded-lg bg-teal-900/10" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="h-32 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                </div>
            </div>
        )
    }

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
            <section className="relative overflow-hidden rounded-lg bg-[#073f3b] text-white shadow-2xl shadow-teal-950/15">
                <div className="absolute -right-20 -top-24 size-72 rounded-full bg-cyan-300/20 blur-3xl" />
                <div className="absolute -bottom-24 left-8 size-56 rounded-full bg-lime-300/20 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                <div className="relative grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch xl:p-8">
                    <div className="min-w-0 space-y-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href="/dashboard/transactions">
                                <Button variant="outline" size="icon" className="size-10 shrink-0 rounded-lg border-white/20 bg-white/10 text-white hover:bg-white hover:text-teal-950">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Badge className="min-h-9 gap-1.5 border-white/15 bg-white/10 px-3 text-white hover:bg-white/15">
                                <ReceiptText className="size-3.5" />
                                Detail transaksi
                            </Badge>
                            <Badge className={`min-h-9 border px-3 font-black ${getStatusTone(transaction.status)}`}>
                                {transaction.status.replaceAll("_", " ")}
                            </Badge>
                        </div>

                        <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-start gap-2">
                                <h1 className="min-w-0 max-w-full text-2xl font-black leading-tight tracking-tight text-white [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">
                                    {transaction.transactionCode}
                                </h1>
                                <EditTransactionDetailsDialog
                                    transaction={transaction}
                                    onSuccess={fetchTransaction}
                                    triggerLabel=""
                                    triggerClassName="size-9 shrink-0 rounded-lg border-white/20 bg-white/10 p-0 text-white hover:bg-white hover:text-teal-950"
                                />
                            </div>
                            <p className="max-w-2xl text-sm leading-relaxed text-teal-50/80 sm:text-base">
                                Ringkasan transaksi unit, modal, dokumen, dan biaya operasional dalam satu tampilan yang lebih mudah dibaca.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur">
                                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-lime-100">
                                    <Car className="size-4" />
                                    Unit kendaraan
                                </div>
                                <div className="flex items-start gap-3">
                                    <button
                                        type="button"
                                        className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
                                        onClick={() => transaction.unit.imageUrl && setViewPaymentProof(transaction.unit.imageUrl)}
                                        title="Lihat Foto Unit"
                                    >
                                        {transaction.unit.imageUrl ? (
                                            <img
                                                src={transaction.unit.imageUrl}
                                                alt="Unit"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <ImageIcon className="size-5 text-teal-50/70" />
                                        )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-lime-200/20 px-2 py-1 font-mono text-[11px] font-black text-lime-100 [overflow-wrap:anywhere]">
                                                {transaction.unit.code}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="size-8 shrink-0 rounded-lg p-0 text-white hover:bg-white/10"
                                                onClick={() => setIsUnitImageOpen(true)}
                                                title="Update Foto Unit"
                                            >
                                                <Camera className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <p className="text-base font-black leading-snug text-white [overflow-wrap:anywhere]">
                                            {transaction.unit.name}
                                        </p>
                                        <p className="mt-1 text-sm leading-relaxed text-teal-50/75 [overflow-wrap:anywhere]">
                                            {transaction.unit.plateNumber}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur">
                                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-lime-100">
                                    <Calendar className="size-4" />
                                    Tanggal transaksi
                                </div>
                                <p className="text-base font-black leading-snug text-white [overflow-wrap:anywhere]">
                                    {formatHijriFull(new Date(transaction.buyDate))}
                                </p>
                                <p className="mt-1 text-sm text-teal-50/75">
                                    Tanggal beli unit
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-50/70">Total modal</p>
                            <p className="mt-2 text-3xl font-black leading-tight text-white [overflow-wrap:anywhere] sm:text-4xl">
                                {formatCurrency(totalCapital)}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-teal-50/75">
                                Gabungan modal pemodal dan pengelola, termasuk biaya operasional yang sudah tercatat.
                            </p>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
                            {transaction.status === 'COMPLETED' && (
                                <Button
                                    variant="outline"
                                    onClick={handleExportPDF}
                                    disabled={isExporting}
                                    className="min-h-11 rounded-lg border-white/20 bg-white text-teal-950 hover:bg-lime-100"
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    {isExporting ? "Exporting..." : "Laporan PDF"}
                                </Button>
                            )}
                            {transaction.status !== 'COMPLETED' && (
                                <div className="rounded-lg border border-amber-200/30 bg-amber-100/15 p-3 text-sm font-semibold leading-relaxed text-amber-50">
                                    Transaksi masih berjalan. Lengkapi biaya dan bukti sebelum finalisasi.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                <Card className="overflow-hidden rounded-lg border-teal-900/10 bg-white shadow-sm">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500 sm:text-sm"><Wallet className="size-4 text-teal-600" /> Modal dari Pemodal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(baseInvestorCapital)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                            {transaction.initialInvestorCapital ? "Modal awal custom" : "Harga Beli Unit"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-lg border-teal-900/10 bg-white shadow-sm">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500 sm:text-sm"><TrendingUp className="size-4 text-sky-600" /> Total Modal Pemodal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(totalCapitalInvestor)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                            Beli + Biaya ({formatCurrency(costsInvestor)})
                        </p>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-lg border-teal-900/10 bg-white shadow-sm">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500 sm:text-sm"><Users className="size-4 text-amber-600" /> Total Modal Pengelola</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(totalCapitalManager)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                            Modal ({formatCurrency(baseManagerCapital)}) + Biaya ({formatCurrency(costsManager)})
                        </p>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-lg border-lime-200 bg-lime-50 shadow-sm">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-lime-800 sm:text-sm"><DollarSign className="size-4 text-lime-600" /> Total Modal Keseluruhan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-2xl">
                            {formatCurrency(totalCapital)}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-lime-800/70">
                            Pemodal + Pengelola
                        </p>
                    </CardContent>
                </Card>
            </div>



            {transaction.status === 'COMPLETED' && transaction.profitSharing && (
                <Card className="overflow-hidden rounded-lg border-lime-200 bg-gradient-to-br from-lime-50 to-white shadow-sm">
                    <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div>
                            <CardTitle className="text-lg font-black text-lime-950">Hasil Penjualan</CardTitle>
                            <p className="mt-1 text-sm leading-relaxed text-lime-800/70">Ringkasan margin dan pembagian profit transaksi selesai.</p>
                        </div>
                        <EditProfitSharingDialog
                            transactionId={transaction.id}
                            currentInvestorShare={transaction.profitSharing.investorSharePercentage}
                            currentManagerShare={transaction.profitSharing.managerSharePercentage}
                            onSuccess={fetchTransaction}
                        />
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-4">
                        <div className="rounded-lg border border-lime-200 bg-white p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-800">Harga Jual</p>
                            <p className="mt-2 text-xl font-black leading-tight text-lime-950 [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.sellPrice)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-lime-200 bg-white p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-800">Margin Bersih</p>
                            <p className="mt-2 text-xl font-black leading-tight text-lime-950 [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.profitSharing.netMargin)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-lime-200 bg-white p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-800">Profit Pemodal ({transaction.profitSharing.investorSharePercentage}%)</p>
                            <p className="mt-2 text-xl font-black leading-tight text-lime-950 [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.profitSharing.investorProfitAmount)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-lime-200 bg-white p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-800">Profit Pengelola ({transaction.profitSharing.managerSharePercentage}%)</p>
                            <p className="mt-2 text-xl font-black leading-tight text-lime-950 [overflow-wrap:anywhere]">
                                {formatCurrency(transaction.profitSharing.managerProfitAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="costs" className="w-full gap-4">
                <TabsList className="grid min-h-11 w-full grid-cols-2 rounded-lg border border-teal-900/10 bg-white p-1 shadow-sm sm:w-fit">
                    <TabsTrigger value="costs" className="rounded-md px-3 py-2 text-xs font-black sm:text-sm">Biaya Operasional</TabsTrigger>
                    <TabsTrigger value="details" className="rounded-md px-3 py-2 text-xs font-black sm:text-sm">Detail Transaksi</TabsTrigger>
                </TabsList>
                <TabsContent value="costs" className="space-y-4">
                    <div className="flex justify-stretch sm:justify-end">
                        {transaction.status !== 'COMPLETED' && (
                            <>
                                <Button variant="outline" onClick={() => setIsCostOpen(true)} className="min-h-11 w-full rounded-lg border-teal-200 text-teal-800 hover:bg-teal-50 sm:w-auto">
                                    <Plus className="mr-2 h-4 w-4" /> Tambah Biaya
                                </Button>
                                <AddCostDialog
                                    transactionId={transaction.id}
                                    open={isCostOpen}
                                    onOpenChange={handleCloseCostDialog}
                                    existingCost={editingCost}
                                    onSuccess={fetchTransaction}
                                />
                            </>
                        )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-teal-900/10 bg-white shadow-sm">
                        <Table className="min-w-[760px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-black text-slate-500">Jenis</TableHead>
                                    <TableHead className="font-black text-slate-500">Keterangan</TableHead>
                                    <TableHead className="font-black text-slate-500">Dibayar Oleh</TableHead>
                                    <TableHead className="text-right font-black text-slate-500">Nominal</TableHead>
                                    <TableHead className="text-right font-black text-slate-500">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transaction.costs.map((cost: any) => (
                                    <TableRow key={cost.id}>
                                        <TableCell className="max-w-[180px] whitespace-normal font-semibold [overflow-wrap:anywhere]">{cost.costType}</TableCell>
                                        <TableCell className="max-w-[260px] whitespace-normal text-slate-600 [overflow-wrap:anywhere]">{cost.description}</TableCell>
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
                                                        className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
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
                                                    className="h-8 px-3 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                                    title="Kelola Bukti"
                                                    onClick={() => {
                                                        setProofCost(cost)
                                                        setIsProofCostOpen(true)
                                                    }}
                                                >
                                                    <Upload className="h-3 w-3 mr-1.5" />
                                                    Kelola
                                                </Button>
                                                {transaction.status !== 'COMPLETED' && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEditCost(cost)}
                                                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteCost(cost.id)}
                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
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
                    <Card className="rounded-lg border-teal-900/10 bg-white shadow-sm">
                        <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <div>
                                <CardTitle className="text-lg font-black text-slate-950">Informasi Detail</CardTitle>
                                <p className="mt-1 text-sm leading-relaxed text-slate-500">Data utama transaksi dan catatan internal.</p>
                            </div>
                            <EditTransactionDetailsDialog transaction={transaction} onSuccess={fetchTransaction} />
                        </CardHeader>
                        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-lg bg-slate-50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Kode Transaksi</span>
                                    <p className="mt-2 font-black text-slate-950 [overflow-wrap:anywhere]">{transaction.transactionCode}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Unit</span>
                                    <p className="mt-2 font-black text-slate-950 [overflow-wrap:anywhere]">{transaction.unit.name} ({transaction.unit.plateNumber})</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Tanggal Beli</span>
                                    <p className="mt-2 font-black text-slate-950 [overflow-wrap:anywhere]">{formatHijriFull(new Date(transaction.buyDate))}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-4">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Tanggal Laku</span>
                                    <p className="mt-2 font-black text-slate-950 [overflow-wrap:anywhere]">{transaction.sellDate ? formatHijriFull(new Date(transaction.sellDate)) : '-'}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-4 sm:col-span-2">
                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Catatan</span>
                                    <p className="mt-2 leading-relaxed text-slate-700 [overflow-wrap:anywhere]">{transaction.notes || '-'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="overflow-hidden rounded-lg border-teal-900/10 bg-white shadow-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-teal-50/60 p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-950">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Dokumen & Bukti Transaksi
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6">
                    <div className="flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30 md:p-5">
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-base font-black leading-snug text-slate-950 [overflow-wrap:anywhere]">Bukti Beli</p>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]">Dari Seller</p>
                                </div>
                                {(() => {
                                    const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0)
                                    if (count > 0) {
                                        return <Badge variant="secondary" className="shrink-0 border-green-300 bg-green-100 text-[10px] font-medium text-green-700">{count}</Badge>
                                    }
                                    return <Badge variant="outline" className="shrink-0 border-slate-300 text-[10px] text-slate-400">0</Badge>
                                })()}
                            </div>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2">
                            {(() => {
                                const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0)
                                if (count > 0) {
                                    return (
                                        <Button variant="default" size="sm" onClick={() => setProofType('BUY')} className="min-h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs text-white hover:bg-blue-700">
                                            <Eye className="mr-1.5 h-3 w-3" /> Lihat
                                        </Button>
                                    )
                                }
                            })()}
                            <Button variant="outline" size="sm" onClick={() => setProofType('BUY')} className={`${(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0); return count > 0 ? '' : 'flex-1' })()} min-h-9 rounded-lg border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50`}>
                                <Upload className="mr-1.5 h-3 w-3" /> {(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0); return count > 0 ? '' : 'Kelola' })()}
                            </Button>
                        </div>
                    </div>
                    <div className="flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30 md:p-5">
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-base font-black leading-snug text-slate-950 [overflow-wrap:anywhere]">Bukti Lunas</p>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]">Dari Buyer</p>
                                </div>
                                {(() => {
                                    const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0)
                                    if (count > 0) {
                                        return <Badge variant="secondary" className="shrink-0 border-green-300 bg-green-100 text-[10px] font-medium text-green-700">{count}</Badge>
                                    }
                                    return <Badge variant="outline" className="shrink-0 border-slate-300 text-[10px] text-slate-400">0</Badge>
                                })()}
                            </div>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2">
                            {(() => {
                                const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0)
                                if (count > 0) {
                                    return (
                                        <Button variant="default" size="sm" onClick={() => setProofType('SELL')} className="min-h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs text-white hover:bg-blue-700">
                                            <Eye className="mr-1.5 h-3 w-3" /> Lihat
                                        </Button>
                                    )
                                }
                            })()}
                            <Button variant="outline" size="sm" onClick={() => setProofType('SELL')} className={`${(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0); return count > 0 ? '' : 'flex-1' })()} min-h-9 rounded-lg border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50`}>
                                <Upload className="mr-1.5 h-3 w-3" /> {(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0); return count > 0 ? '' : 'Kelola' })()}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {transaction.status === 'COMPLETED' && (
                <Card className="rounded-lg border-teal-900/10 bg-white shadow-sm">
                    <CardHeader className="p-4 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-lg font-black text-slate-950">Pembayaran Bagi Hasil (Profit Sharing)</CardTitle>
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
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-blue-800">Total Harus Dibayar</p>
                                        <p className="text-xl font-bold text-blue-900 [overflow-wrap:anywhere]">
                                            {formatCurrency(transaction.payment.investorShouldReceive)}
                                        </p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-green-800">Sudah Dibayar</p>
                                        <p className="text-xl font-bold text-green-900 [overflow-wrap:anywhere]">
                                            {formatCurrency(transaction.payment.totalPaid)}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-orange-800">Sisa</p>
                                        <p className="text-xl font-bold text-orange-900 [overflow-wrap:anywhere]">
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
                                                                className="ml-2 h-6 px-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                                                onClick={() => setViewPaymentProof(payment.proofImageUrl)}
                                                            >
                                                                📎 Lihat Bukti
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
