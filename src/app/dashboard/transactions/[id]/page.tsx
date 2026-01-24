"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { format } from "date-fns"
import { ArrowLeft, Plus, DollarSign, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { AddPaymentDialog } from "@/components/transactions/AddPaymentDialog"
import { AddCostDialog } from "@/components/transactions/AddCostDialog"
import { FinalizeTransactionDialog } from "@/components/transactions/FinalizeTransactionDialog"
import { EditTransactionDetailsDialog } from "@/components/transactions/EditTransactionDetailsDialog"

import { ManageCostProofsDialog } from "@/components/transactions/ManageCostProofsDialog"
import { UpdateTransactionProofDialog } from "@/components/transactions/UpdateTransactionProofDialog"
import { FileText, Paperclip, Upload, Camera, Eye } from "lucide-react"
import { exportTransactionReportPDF } from "@/lib/export-utils"
import { UpdateUnitImageDialog } from "@/components/units/UpdateUnitImageDialog"
import { EditProfitSharingDialog } from "@/components/transactions/EditProfitSharingDialog"
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog"

export default function TransactionDetailPage() {
    const params = useParams()
    const router = useRouter()
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

    const fetchTransaction = async () => {
        if (!params.id) return
        try {
            const res = await fetch(`/api/transactions/${params.id}`)
            if (!res.ok) throw new Error("Failed to fetch")
            const data = await res.json()
            setTransaction(data)
        } catch (error) {
            console.error("Error fetching transaction:", error)
        }
    }

    useEffect(() => {
        if (params.id) {
            fetchTransaction()
        }
    }, [params.id])

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
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    const handleCloseCostDialog = (open: boolean) => {
        setIsCostOpen(open)
        if (!open) {
            setEditingCost(null)
        }
    }

    if (!transaction) return <div>Loading...</div>

    const costsInvestor = transaction.costs
        .filter((c: any) => c.payer === "INVESTOR")
        .reduce((sum: number, cost: any) => sum + cost.amount, 0)

    const costsManager = transaction.costs
        .filter((c: any) => c.payer === "MANAGER")
        .reduce((sum: number, cost: any) => sum + cost.amount, 0)

    const totalCosts = transaction.costs.reduce((sum: number, cost: any) => sum + cost.amount, 0)

    const baseInvestorCapital = transaction.initialInvestorCapital ?? transaction.buyPrice
    const baseManagerCapital = transaction.initialManagerCapital ?? 0

    const totalCapitalInvestor = baseInvestorCapital + costsInvestor
    const totalCapitalManager = baseManagerCapital + costsManager
    const totalCapital = totalCapitalInvestor + totalCapitalManager

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center gap-4">
                    <Link href="/dashboard/transactions">
                        <Button variant="outline" size="icon" className="mt-1 md:mt-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-xl md:text-3xl font-bold tracking-tight flex flex-wrap items-center gap-2 md:gap-3 break-all">
                            {transaction.transactionCode}
                            {transaction.status !== 'COMPLETED' && (
                                <EditTransactionDetailsDialog transaction={transaction} onSuccess={fetchTransaction} />
                            )}
                        </h2>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                            {transaction.unit.imageUrl && (
                                <div
                                    className="h-8 w-8 rounded overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                                    onClick={() => setViewPaymentProof(transaction.unit.imageUrl)}
                                    title="Lihat Foto Unit"
                                >
                                    <img
                                        src={transaction.unit.imageUrl}
                                        alt="Unit"
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            )}
                            <span className="break-words">
                                {transaction.unit.name} - {transaction.unit.plateNumber}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-slate-200 flex-shrink-0"
                                onClick={() => setIsUnitImageOpen(true)}
                                title="Update Foto Unit"
                            >
                                <Camera className="h-4 w-4 text-slate-500" />
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                    {transaction.status === 'COMPLETED' && (
                        <Button
                            variant="outline"
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="flex-1 md:flex-none"
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            {isExporting ? "Exporting..." : "Laporan PDF"}
                        </Button>
                    )}
                    <Badge variant={transaction.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-lg px-4 py-1 h-10 flex items-center justify-center flex-1 md:flex-none">
                        {transaction.status}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 md:gap-4">
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs md:text-sm font-medium text-blue-800">Modal dari Pemodal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-base md:text-2xl font-bold text-blue-900 break-words">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(baseInvestorCapital)}
                        </div>
                        <p className="text-[10px] md:text-xs text-blue-700 mt-1">
                            {transaction.initialInvestorCapital ? "Modal awal custom" : "Harga Beli Unit"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-100 border-blue-300">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs md:text-sm font-medium text-blue-800">Total Modal Pemodal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-base md:text-2xl font-bold text-blue-900 break-words">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalCapitalInvestor)}
                        </div>
                        <p className="text-[10px] md:text-xs text-blue-700 mt-1">
                            Beli + Biaya ({new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(costsInvestor)})
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs md:text-sm font-medium text-purple-800">Total Modal Pengelola</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-base md:text-2xl font-bold text-purple-900 break-words">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalCapitalManager)}
                        </div>
                        <p className="text-[10px] md:text-xs text-purple-700 mt-1">
                            Modal ({new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(baseManagerCapital)}) + Biaya ({new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(costsManager)})
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                    <CardHeader className="pb-2 p-4">
                        <CardTitle className="text-xs md:text-sm font-medium text-green-800">Total Modal Keseluruhan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-base md:text-2xl font-bold text-green-900 break-words">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalCapital)}
                        </div>
                        <p className="text-[10px] md:text-xs text-green-700 mt-1">
                            Pemodal + Pengelola
                        </p>
                    </CardContent>
                </Card>
            </div>



            {transaction.status === 'COMPLETED' && transaction.profitSharing && (
                <Card className="bg-green-50 border-green-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-green-800">Hasil Penjualan</CardTitle>
                        <EditProfitSharingDialog
                            transactionId={transaction.id}
                            currentInvestorShare={transaction.profitSharing.investorSharePercentage}
                            currentManagerShare={transaction.profitSharing.managerSharePercentage}
                            onSuccess={fetchTransaction}
                        />
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-4">
                        <div>
                            <p className="text-sm font-medium text-green-800">Harga Jual</p>
                            <p className="text-2xl font-bold text-green-900">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.sellPrice)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-800">Margin Bersih</p>
                            <p className="text-2xl font-bold text-green-900">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.profitSharing.netMargin)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-800">Profit Pemodal ({transaction.profitSharing.investorSharePercentage}%)</p>
                            <p className="text-xl font-bold text-green-900">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.profitSharing.investorProfitAmount)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-800">Profit Pengelola ({transaction.profitSharing.managerSharePercentage}%)</p>
                            <p className="text-xl font-bold text-green-900">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.profitSharing.managerProfitAmount)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="costs" className="w-full">
                <TabsList>
                    <TabsTrigger value="costs">Biaya Operasional</TabsTrigger>
                    <TabsTrigger value="details">Detail Transaksi</TabsTrigger>
                </TabsList>
                <TabsContent value="costs" className="space-y-4">
                    <div className="flex justify-end">
                        {transaction.status !== 'COMPLETED' && (
                            <>
                                <Button variant="outline" onClick={() => setIsCostOpen(true)}>
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

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Jenis</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead>Dibayar Oleh</TableHead>
                                    <TableHead className="text-right">Nominal</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transaction.costs.map((cost: any) => (
                                    <TableRow key={cost.id}>
                                        <TableCell>{cost.costType}</TableCell>
                                        <TableCell>{cost.description}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{cost.payer}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(cost.amount)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
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
                    <Card>
                        <CardHeader>
                            <CardTitle>Informasi Detail</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="font-medium">Kode Transaksi:</span>
                                    <p>{transaction.transactionCode}</p>
                                </div>
                                <div>
                                    <span className="font-medium">Unit:</span>
                                    <p>{transaction.unit.name} ({transaction.unit.plateNumber})</p>
                                </div>
                                <div>
                                    <span className="font-medium">Tanggal Beli:</span>
                                    <p>{format(new Date(transaction.buyDate), 'dd MMMM yyyy')}</p>
                                </div>
                                <div>
                                    <span className="font-medium">Tanggal Laku:</span>
                                    <p>{transaction.sellDate ? format(new Date(transaction.sellDate), 'dd MMMM yyyy') : '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-medium">Catatan:</span>
                                    <p>{transaction.notes || '-'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                    <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Dokumen & Bukti Transaksi
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 md:gap-4 p-4 pt-0">
                    <div className="border border-slate-200 rounded-lg p-3 md:p-5 bg-white dark:bg-slate-950 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-xs md:text-base text-slate-900 dark:text-slate-100 line-clamp-1">Bukti Beli</p>
                                    <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 line-clamp-1">Dari Seller</p>
                                </div>
                                {(() => {
                                    const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0)
                                    if (count > 0) {
                                        return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 font-medium text-[10px] px-1.5 h-5">{count}</Badge>
                                    }
                                    return <Badge variant="outline" className="text-slate-400 border-slate-300 text-[10px] px-1.5 h-5">0</Badge>
                                })()}
                            </div>
                        </div>
                        <div className="flex gap-1.5 mt-auto">
                            {(() => {
                                const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0)
                                if (count > 0) {
                                    return (
                                        <Button variant="default" size="sm" onClick={() => setProofType('BUY')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-7 text-[10px] md:text-xs px-2">
                                            <Eye className="mr-1.5 h-3 w-3" /> Lihat
                                        </Button>
                                    )
                                }
                            })()}
                            <Button variant="outline" size="sm" onClick={() => setProofType('BUY')} className={`${(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0); return count > 0 ? '' : 'flex-1' })()} border-blue-300 text-blue-700 hover:bg-blue-50 h-7 text-[10px] md:text-xs px-2`}>
                                <Upload className="mr-1.5 h-3 w-3" /> {(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'BUY').length || (transaction.buyProofImageUrl ? 1 : 0); return count > 0 ? '' : 'Kelola' })()}
                            </Button>
                        </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3 md:p-5 bg-white dark:bg-slate-950 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-xs md:text-base text-slate-900 dark:text-slate-100 line-clamp-1">Bukti Lunas</p>
                                    <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 line-clamp-1">Dari Buyer</p>
                                </div>
                                {(() => {
                                    const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0)
                                    if (count > 0) {
                                        return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 font-medium text-[10px] px-1.5 h-5">{count}</Badge>
                                    }
                                    return <Badge variant="outline" className="text-slate-400 border-slate-300 text-[10px] px-1.5 h-5">0</Badge>
                                })()}
                            </div>
                        </div>
                        <div className="flex gap-1.5 mt-auto">
                            {(() => {
                                const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0)
                                if (count > 0) {
                                    return (
                                        <Button variant="default" size="sm" onClick={() => setProofType('SELL')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-7 text-[10px] md:text-xs px-2">
                                            <Eye className="mr-1.5 h-3 w-3" /> Lihat
                                        </Button>
                                    )
                                }
                            })()}
                            <Button variant="outline" size="sm" onClick={() => setProofType('SELL')} className={`${(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0); return count > 0 ? '' : 'flex-1' })()} border-blue-300 text-blue-700 hover:bg-blue-50 h-7 text-[10px] md:text-xs px-2`}>
                                <Upload className="mr-1.5 h-3 w-3" /> {(() => { const count = transaction.proofs?.filter((p: any) => p.proofType === 'SELL').length || (transaction.sellProofImageUrl ? 1 : 0); return count > 0 ? '' : 'Kelola' })()}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {transaction.status === 'COMPLETED' && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Pembayaran Bagi Hasil (Profit Sharing)</CardTitle>
                            <AddPaymentDialog
                                transactionId={transaction.id}
                                investorId={transaction.unit.investorId}
                                onSuccess={fetchTransaction}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {transaction.paymentHistories && transaction.paymentHistories.length > 0 ? (
                            <div className="space-y-4">
                                <div className="grid gap-2 md:grid-cols-3 mb-4">
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-blue-800">Total Harus Dibayar</p>
                                        <p className="text-xl font-bold text-blue-900">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(
                                                transaction.payment.investorShouldReceive
                                            )}
                                        </p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-green-800">Sudah Dibayar</p>
                                        <p className="text-xl font-bold text-green-900">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.payment.totalPaid)}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-lg">
                                        <p className="text-sm font-medium text-orange-800">Sisa</p>
                                        <p className="text-xl font-bold text-orange-900">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(transaction.payment.remaining)}
                                        </p>
                                        <Badge className="mt-1" variant={transaction.payment.paymentStatus === 'PAID' ? 'default' : transaction.paymentStatus === 'PARTIAL' ? 'secondary' : 'destructive'}>
                                            {transaction.payment.paymentStatus}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="rounded-md border">
                                    <Table>
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
                                                    <TableCell>{format(new Date(payment.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{payment.method}</Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(payment.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
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
                                <p className="text-sm mt-1">Klik tombol "Tambah Pembayaran" untuk menambahkan pembayaran.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {transaction.status !== 'COMPLETED' && (
                <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-background p-4 shadow-top">
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
