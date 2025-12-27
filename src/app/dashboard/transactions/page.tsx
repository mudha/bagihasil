"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
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
import { Plus, Eye, MoreVertical, Trash, FileText, CheckCircle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { format } from "date-fns"
import { exportTransactionReportPDF } from "@/lib/export-utils"
import { ImportTransactionsDialog } from "@/components/import/ImportTransactionsDialog"
import { EditStatusDialog } from "@/components/transactions/EditStatusDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog"


const transactionSchema = z.object({
    unitId: z.string().min(1, "Unit wajib dipilih"),
    transactionCode: z.string().min(1, "Kode transaksi wajib diisi"),
    buyDate: z.string().min(1, "Tanggal beli wajib diisi"),
    buyPrice: z.union([z.string(), z.number()]).transform((val) => Number(val)),
    initialInvestorCapital: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? undefined : val,
        z.union([z.string(), z.number()]).transform((val) => Number(val)).optional()
    ),
    initialManagerCapital: z.preprocess(
        (val) => (val === "" || val === null || val === undefined) ? undefined : val,
        z.union([z.string(), z.number()]).transform((val) => Number(val)).optional()
    ),
    notes: z.string().optional(),
})

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
        investor: {
            name: string
        }
    }
}

interface Unit {
    id: string
    name: string
    plateNumber: string
    status: string
    investorId: string
    investor: {
        name: string
    }
}

interface Investor {
    id: string
    name: string
}

const calculateDuration = (buyDate: string, sellDate?: string | null) => {
    if (!sellDate) return "-"
    const start = new Date(buyDate)
    const end = new Date(sellDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return `${diffDays} hari`
}

export default function TransactionsPage() {
    const { data: session } = useSession()
    // @ts-ignore
    const isViewer = session?.user?.role === "VIEWER"

    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [availableUnits, setAvailableUnits] = useState<Unit[]>([])
    const [investors, setInvestors] = useState<Investor[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<any>(null)
    const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [exportingTransactionId, setExportingTransactionId] = useState<string | null>(null)
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [sortBy, setSortBy] = useState<string>("buyDate")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    const filteredTransactions = transactions.filter(trx => {
        const matchesSearch = (trx.transactionCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (trx.unit?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (trx.unit?.plateNumber || "").toLowerCase().includes(searchQuery.toLowerCase())

        const matchesInvestor = selectedInvestorId === "all" || trx.unit.investorId === selectedInvestorId

        return matchesSearch && matchesInvestor
    }).sort((a, b) => {
        let compareValue = 0

        switch (sortBy) {
            case "transactionCode":
                compareValue = a.transactionCode.localeCompare(b.transactionCode)
                break
            case "buyDate":
                compareValue = new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime()
                break
            case "sellDate":
                const aDate = a.sellDate ? new Date(a.sellDate).getTime() : 0
                const bDate = b.sellDate ? new Date(b.sellDate).getTime() : 0
                compareValue = aDate - bDate
                break
            case "buyPrice":
                compareValue = a.buyPrice - b.buyPrice
                break
            case "sellPrice":
                const aPrice = a.sellPrice || 0
                const bPrice = b.sellPrice || 0
                compareValue = aPrice - bPrice
                break
            case "status":
                compareValue = a.status.localeCompare(b.status)
                break
            case "investor":
                compareValue = a.unit.investor.name.localeCompare(b.unit.investor.name)
                break
            default:
                compareValue = 0
        }

        return sortOrder === "asc" ? compareValue : -compareValue
    })

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredTransactions.map(t => t.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id])
        } else {
            setSelectedIds(prev => prev.filter(item => item !== id))
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return

        try {
            const res = await fetch('/api/transactions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            })

            if (res.ok) {
                toast.success(`${selectedIds.length} transaksi berhasil dihapus`)
                setSelectedIds([])
                fetchTransactions()
                fetchAvailableUnits()
            } else {
                toast.error("Gagal menghapus transaksi")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    async function handleBulkMarkAsPaid() {
        if (selectedIds.length === 0) return

        try {
            const res = await fetch('/api/transactions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, paymentStatus: 'PAID' }),
            })

            if (res.ok) {
                toast.success(`${selectedIds.length} transaksi ditandai LUNAS`)
                setSelectedIds([])
                fetchTransactions()
            } else {
                toast.error("Gagal mengupdate transaksi")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema) as any,
        defaultValues: {
            unitId: "",
            transactionCode: "",
            buyDate: new Date().toISOString().split('T')[0],
            buyPrice: 0,
            initialInvestorCapital: undefined,
            initialManagerCapital: undefined,
            notes: "",
        },
    })

    const fetchTransactions = async () => {
        const res = await fetch('/api/transactions')
        const data = await res.json()
        setTransactions(data)
    }

    const fetchAvailableUnits = async () => {
        const res = await fetch('/api/units')
        const data = await res.json()
        // Filter only available units or units that don't have active transaction
        // For simplicity, let's just show all AVAILABLE units
        setAvailableUnits(data.filter((u: Unit) => u.status === 'AVAILABLE'))
    }

    const fetchInvestors = async () => {
        const res = await fetch('/api/investors')
        const data = await res.json()
        setInvestors(data)
    }

    useEffect(() => {
        fetchTransactions()
        fetchAvailableUnits()
        fetchInvestors()
    }, [])

    useEffect(() => {
        if (isOpen && !editingTransaction) {
            fetch('/api/transactions/next-code')
                .then(res => res.json())
                .then(data => {
                    if (data.code) {
                        form.setValue('transactionCode', data.code)
                    }
                })
                .catch(err => console.error("Failed to fetch next code", err))
        }
    }, [isOpen, editingTransaction, form])

    async function onSubmit(values: z.infer<typeof transactionSchema>) {
        try {
            const url = editingTransaction ? `/api/transactions/${editingTransaction.id}` : '/api/transactions'
            const method = editingTransaction ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })

            if (res.ok) {
                toast.success(editingTransaction ? "Transaksi berhasil diperbarui" : "Transaksi berhasil dibuat")
                setIsOpen(false)
                setEditingTransaction(null)
                form.reset()
                fetchTransactions()
                fetchAvailableUnits() // Refresh available units
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal menyimpan transaksi")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    async function handleDelete() {
        if (!deleteTransactionId) return

        try {
            const res = await fetch(`/api/transactions/${deleteTransactionId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                toast.success("Transaksi berhasil dihapus")
                setDeleteTransactionId(null)
                fetchTransactions()
                fetchAvailableUnits()
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal menghapus transaksi")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    function handleEdit(transaction: any) {
        setEditingTransaction(transaction)
        form.reset({
            unitId: transaction.unitId,
            transactionCode: transaction.transactionCode,
            buyDate: new Date(transaction.buyDate).toISOString().split('T')[0],
            buyPrice: transaction.buyPrice,
            initialInvestorCapital: transaction.initialInvestorCapital,
            initialManagerCapital: transaction.initialManagerCapital,
            notes: transaction.notes || "",
        })
        setIsOpen(true)
    }

    async function handleExportPDF(transactionId: string, transactionCode: string) {
        setExportingTransactionId(transactionId)
        toast.loading(`Mengekspor laporan ${transactionCode}...`)

        const result = await exportTransactionReportPDF(transactionId, transactionCode)

        toast.dismiss()
        if (result.success) {
            toast.success("Laporan PDF berhasil diunduh!")
        } else {
            toast.error(result.error || "Gagal mengekspor laporan PDF")
        }
        setExportingTransactionId(null)
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Daftar Transaksi</h2>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {selectedIds.length > 0 && !isViewer && (
                        <>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash className="mr-2 h-4 w-4" /> Hapus ({selectedIds.length})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Hapus {selectedIds.length} Transaksi?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Tindakan ini tidak dapat dibatalkan. Data transaksi yang dipilih akan dihapus permanen.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                                            Hapus
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="secondary" size="sm">
                                        <CheckCircle className="mr-2 h-4 w-4" /> Set Lunas ({selectedIds.length})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Tandai {selectedIds.length} Transaksi sebagai Lunas?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Status pembayaran transaksi yang dipilih akan diubah menjadi PAID.
                                            Catatan: Aksi ini tidak membuat riwayat pembayaran baru.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleBulkMarkAsPaid}>
                                            Ya, Tandai Lunas
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                    <ImportTransactionsDialog onImportSuccess={() => {
                        fetchTransactions()
                        fetchAvailableUnits()
                    }} />
                    <Dialog open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open)
                        if (!open) {
                            setEditingTransaction(null)
                            form.reset()
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Transaksi Baru
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingTransaction ? "Edit Transaksi" : "Mulai Transaksi Baru (Beli Unit)"}</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="unitId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Pilih Unit</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!!editingTransaction}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Pilih unit yang akan dibeli" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {availableUnits.map((unit) => (
                                                            <SelectItem key={unit.id} value={unit.id}>
                                                                {unit.name} - {unit.plateNumber}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="transactionCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Kode Transaksi</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="TRX-2024-001" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="buyDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tanggal Beli</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="buyPrice"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Harga Beli (Rp)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" placeholder="0" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="initialInvestorCapital"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Modal dari Pemodal (Rp)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Kosongkan jika sama dengan harga beli"
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                                <p className="text-xs text-muted-foreground">Opsional: Isi jika modal pemodal berbeda dari harga beli</p>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="initialManagerCapital"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Modal dari Pengelola (Rp)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                                <p className="text-xs text-muted-foreground">Opsional: Modal tambahan dari pengelola</p>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Catatan</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Catatan tambahan..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full">{editingTransaction ? "Update" : "Simpan"}</Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center justify-between py-4 gap-4">
                <Input
                    placeholder="Cari transaksi..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="max-w-sm"
                />
                <div className="flex gap-2">
                    <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Pilih Investor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Investor</SelectItem>
                            {investors.map((investor) => (
                                <SelectItem key={investor.id} value={investor.id}>
                                    {investor.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredTransactions.length === 0 ? (
                    <div className="text-center p-8 border rounded-md text-muted-foreground bg-slate-50">
                        {searchQuery ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi."}
                    </div>
                ) : (
                    filteredTransactions.map((trx) => (
                        <div key={trx.id} className="border rounded-lg p-4 space-y-4 bg-white dark:bg-slate-950 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div
                                        className="h-14 w-14 rounded-md overflow-hidden border border-slate-200 cursor-pointer flex-shrink-0 relative group"
                                        onClick={() => trx.unit.imageUrl && setPreviewUrl(trx.unit.imageUrl)}
                                    >
                                        {trx.unit.imageUrl ? (
                                            <img
                                                src={trx.unit.imageUrl}
                                                alt={trx.unit.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <span className="text-[10px]">No Img</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">{trx.transactionCode}</span>
                                            <Badge variant={trx.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-[10px] py-0 h-5">
                                                {trx.status}
                                            </Badge>
                                        </div>
                                        <div className="font-semibold text-sm line-clamp-1">{trx.unit.name}</div>
                                        <div className="text-xs text-muted-foreground">{trx.unit.plateNumber}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t text-sm">
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Investor</span>
                                    <span className="font-medium text-xs">{trx.unit.investor.name}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Durasi</span>
                                    <span className="font-medium text-xs">{calculateDuration(trx.buyDate, trx.sellDate)}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Tanggal Beli</span>
                                    <span className="font-medium text-xs">{format(new Date(trx.buyDate), 'dd MMM yy')}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Harga Beli</span>
                                    <span className="font-medium text-xs text-emerald-600">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(trx.buyPrice)}
                                    </span>
                                </div>
                                {trx.sellDate && (
                                    <>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-1">Tanggal Jual</span>
                                            <span className="font-medium text-xs">{format(new Date(trx.sellDate), 'dd MMM yy')}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-1">Harga Jual</span>
                                            <span className="font-medium text-xs text-blue-600">
                                                {trx.sellPrice ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(trx.sellPrice) : "-"}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2 items-center justify-end border-t">
                                <Link href={`/dashboard/transactions/${trx.id}`} className="flex-1">
                                    <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                                        <Eye className="h-3 w-3 mr-2" /> Detail
                                    </Button>
                                </Link>
                                {!isViewer && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(trx)}>
                                                Edit Transaksi
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setDeleteTransactionId(trx.id)} className="text-red-600">
                                                Hapus Transaksi
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                                {trx.status === 'COMPLETED' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-blue-600"
                                        onClick={() => handleExportPDF(trx.id, trx.transactionCode)}
                                        disabled={exportingTransactionId === trx.id}
                                    >
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                            </TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "transactionCode") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("transactionCode")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Kode TRX
                                    {sortBy === "transactionCode" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "investor") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("investor")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Investor
                                    {sortBy === "investor" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>

                            </TableHead>
                            <TableHead className="w-[80px]">Foto</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "buyDate") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("buyDate")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Tanggal Beli
                                    {sortBy === "buyDate" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "buyPrice") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("buyPrice")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Harga Beli
                                    {sortBy === "buyPrice" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "sellDate") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("sellDate")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Tanggal Laku
                                    {sortBy === "sellDate" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "sellPrice") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("sellPrice")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Harga Laku
                                    {sortBy === "sellPrice" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead>Durasi</TableHead>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "status") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("status")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Status
                                    {sortBy === "status" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.map((trx) => (
                            <TableRow key={trx.id}>
                                <TableCell>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                                        checked={selectedIds.includes(trx.id)}
                                        onChange={(e) => handleSelectOne(trx.id, e.target.checked)}
                                        disabled={isViewer}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{trx.transactionCode}</TableCell>
                                <TableCell>{trx.unit.investor.name}</TableCell>
                                <TableCell>
                                    {trx.unit.imageUrl ? (
                                        <div
                                            className="h-10 w-10 rounded-md overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => trx.unit.imageUrl && setPreviewUrl(trx.unit.imageUrl)}
                                        >
                                            <img
                                                src={trx.unit.imageUrl}
                                                alt={trx.unit.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                                            <span className="text-xs">No Img</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{trx.unit.name}</div>
                                    <div className="text-xs text-muted-foreground">{trx.unit.plateNumber}</div>
                                </TableCell>
                                <TableCell>{format(new Date(trx.buyDate), 'dd MMM yyyy')}</TableCell>
                                <TableCell>
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(trx.buyPrice)}
                                </TableCell>
                                <TableCell>
                                    {trx.sellDate ? format(new Date(trx.sellDate), 'dd MMM yyyy') : "-"}
                                </TableCell>
                                <TableCell>
                                    {trx.sellPrice ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(trx.sellPrice) : "-"}
                                </TableCell>
                                <TableCell>
                                    {calculateDuration(trx.buyDate, trx.sellDate)}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={trx.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                        {trx.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link href={`/dashboard/transactions/${trx.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <Eye className="h-4 w-4 mr-2" /> Detail
                                            </Button>
                                        </Link>
                                        {!isViewer ? (
                                            <>
                                                <EditStatusDialog
                                                    transaction={{
                                                        id: trx.id,
                                                        transactionCode: trx.transactionCode,
                                                        status: trx.status
                                                    }}
                                                    onSuccess={() => {
                                                        fetchTransactions()
                                                        fetchAvailableUnits()
                                                    }}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(trx)}
                                                >
                                                    <MoreVertical className="h-4 w-4 mr-2" /> Edit
                                                </Button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Read-only</span>
                                        )}
                                        {trx.status === 'COMPLETED' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleExportPDF(trx.id, trx.transactionCode)}
                                                disabled={exportingTransactionId === trx.id}
                                            >
                                                <FileText className="h-4 w-4 mr-2" />
                                                {exportingTransactionId === trx.id ? "Exporting..." : "Laporan"}
                                            </Button>
                                        )}
                                        {!isViewer && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteTransactionId(trx.id)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash className="h-4 w-4 mr-2" /> Hapus
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredTransactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-4">
                                    {searchQuery ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={deleteTransactionId !== null} onOpenChange={() => setDeleteTransactionId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Aksi ini tidak dapat dibatalkan. Transaksi dan semua biaya terkait akan dihapus permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <ImagePreviewDialog
                src={previewUrl}
                isOpen={!!previewUrl}
                onOpenChange={(open) => !open && setPreviewUrl(null)}
                title="Pratinjau Foto Unit"
            />
        </div >
    )
}
