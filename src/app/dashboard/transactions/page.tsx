"use client"

import { Suspense } from "react"

import { useEffect, useState, useCallback } from "react"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, MoreVertical, Eye, FileText, CheckCircle, ArrowUp, ArrowDown, ArrowUpDown, Trash, Pencil, Scan } from "lucide-react"
import { MultipleImageUpload } from "@/components/ui/multi-image-upload"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { formatHijriFull } from "@/lib/date-utils"
import { exportTransactionReportPDF } from "@/lib/export-utils"
import { ImportTransactionsDialog } from "@/components/import/ImportTransactionsDialog"
import { EditStatusDialog } from "@/components/transactions/EditStatusDialog"

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
import { ImageHoverPreview } from "@/components/ui/image-hover-preview"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { usePersistedSort } from "@/hooks/use-persisted-sort"
import { AdminTransactionDetailDialog } from "@/components/transactions/AdminTransactionDetailDialog"



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
    createdAt?: string
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

// Helper function to get duplicate information for a unit based on plate number
const getDuplicateInfo = (units: Unit[], currentUnit: Unit) => {
    // Safety check: return no duplicate if plateNumber is missing
    if (!currentUnit.plateNumber || !currentUnit.plateNumber.trim()) {
        return { isDuplicate: false, purchaseNumber: 1, totalDuplicates: 1 }
    }

    const samePlateUnits = units
        .filter(u => u.plateNumber && u.plateNumber.toLowerCase().trim() === currentUnit.plateNumber.toLowerCase().trim())
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())

    const index = samePlateUnits.findIndex(u => u.id === currentUnit.id)
    const purchaseNumber = index + 1
    const totalDuplicates = samePlateUnits.length

    return {
        isDuplicate: totalDuplicates > 1,
        purchaseNumber,
        totalDuplicates
    }
}


function TransactionsPageContent() {
    const { data: session } = useSession()
    const searchParams = useSearchParams()
    // @ts-ignore
    const isViewer = session?.user?.role === "VIEWER"

    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [availableUnits, setAvailableUnits] = useState<Unit[]>([])
    const [investors, setInvestors] = useState<Investor[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null)

    const [editingTransaction, setEditingTransaction] = useState<any>(null)
    const [editingStatusTransaction, setEditingStatusTransaction] = useState<any>(null)
    const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [exportingTransactionId, setExportingTransactionId] = useState<string | null>(null)
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState("ALL")

    useEffect(() => {
        const status = searchParams.get('status')
        if (status) {
            setStatusFilter(status)
        }
    }, [searchParams])
    const [sortBy, setSortBy, sortOrder, setSortOrder] = usePersistedSort("transactions-sort", "buyDate", "desc")
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [resetKey, setResetKey] = useState(0)

    const handleImagesChange = useCallback((images: any[]) => {
        const files = images.map(img => img.file).filter((f): f is File => f !== null)
        setUploadedFiles(files)
    }, [])

    const handleScanProof = async () => {
        if (uploadedFiles.length === 0) return

        setIsScanning(true)
        const formData = new FormData()
        uploadedFiles.forEach(file => {
            formData.append('files', file)
        })

        try {
            const res = await fetch('/api/ai/parse-receipt', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()

            if (res.ok && data.success) {
                const total = data.data.totalAmount
                const date = data.data.latestDate

                // Set Buy Price
                form.setValue('buyPrice', total)

                // Set Modal Pemodal (Default equal to buy price)
                form.setValue('initialInvestorCapital', total)

                // Set Date if available
                if (date) {
                    form.setValue('buyDate', date)
                }

                toast.success(`Scan berhasil! Total: Rp ${total.toLocaleString()}`)
            } else {
                toast.error(data.error || "Gagal scan gambar")
            }
        } catch (error) {
            console.error(error)
            toast.error("Gagal memproses gambar")
        } finally {
            setIsScanning(false)
        }
    }

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const filteredTransactions = transactions.filter(trx => {
        const matchesSearch = (trx.transactionCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (trx.unit?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (trx.unit?.plateNumber || "").toLowerCase().includes(searchQuery.toLowerCase())

        const matchesInvestor = selectedInvestorId === "all" || trx.unit.investorId === selectedInvestorId
        const matchesStatus = statusFilter === "ALL" || trx.status === statusFilter

        return matchesSearch && matchesInvestor && matchesStatus
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

        // ... sorting logic ...
        return sortOrder === "asc" ? compareValue : -compareValue
    })

    // Pagination Logic
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
    const paginatedTransactions = filteredTransactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // Reset page to 1 on filter change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, selectedInvestorId])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(paginatedTransactions.map(t => t.id))
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

    // Generate/Regenerate transaction code when dialog opens
    useEffect(() => {
        if (isOpen && !editingTransaction) {
            // Always fetch a fresh code when dialog opens
            fetch('/api/transactions/next-code')
                .then(res => res.json())
                .then(data => {
                    if (data.code) {
                        form.setValue('transactionCode', data.code)
                    }
                })
                .catch(err => console.error("Failed to fetch next code", err))
        }
    }, [isOpen, editingTransaction, form, resetKey]) // Add resetKey as dependency to regenerate after failed save

    // Watch for unitId changes and update transaction code suggestion
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'unitId' && value.unitId && !editingTransaction) {
                // Fetch suggested code based on selected unit
                fetch(`/api/transactions/next-code?unitId=${value.unitId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.code) {
                            form.setValue('transactionCode', data.code)
                        }
                    })
                    .catch(err => console.error("Failed to fetch next code for unit", err))
            }
        })
        return () => subscription.unsubscribe()
    }, [form, editingTransaction])


    async function onSubmit(values: z.infer<typeof transactionSchema>) {
        try {
            // Handle File Uploads
            const proofs: { imageUrl: string; description: string }[] = []

            if (uploadedFiles.length > 0) {
                toast.loading("Mengupload bukti transfer...")

                for (const file of uploadedFiles) {
                    const formData = new FormData()
                    formData.append('file', file)

                    try {
                        const uploadRes = await fetch('/api/upload/payment-proof', {
                            method: 'POST',
                            body: formData
                        })

                        if (uploadRes.ok) {
                            const data = await uploadRes.json()
                            proofs.push({
                                imageUrl: data.url,
                                description: "Bukti Transfer Pembelian"
                            })
                        }
                    } catch (err) {
                        console.error("Failed to upload file", file.name, err)
                    }
                }

                toast.dismiss()
            }

            const url = editingTransaction ? `/api/transactions/${editingTransaction.id}` : '/api/transactions'
            const method = editingTransaction ? 'PUT' : 'POST'

            // Add proofs to payload
            const payload = {
                ...values,
                proofs: proofs.length > 0 ? proofs : undefined,
                // Fallback for single image field if needed for backward compatibility
                buyProofImageUrl: proofs.length > 0 ? proofs[0].imageUrl : undefined
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                toast.success(editingTransaction ? "Transaksi berhasil diperbarui" : "Transaksi berhasil dibuat")
                setIsOpen(false)
                setEditingTransaction(null)
                setUploadedFiles([])
                setResetKey(prev => prev + 1)
                form.reset()
                fetchTransactions()
                fetchAvailableUnits() // Refresh available units
            } else {
                let errorMessage = "Gagal menyimpan transaksi"
                try {
                    // Clone response to allow reading text if json fails
                    const resClone = res.clone()
                    try {
                        const errorData = await res.json()
                        errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)
                    } catch (e) {
                        const text = await resClone.text()
                        console.error("Non-JSON response:", res.status, res.statusText, text)
                        errorMessage = `Server Error (${res.status}): ${text.substring(0, 100)}`
                    }
                } catch (e) {
                    console.error("Error parsing error response:", e)
                }
                toast.error(errorMessage)
            }
        } catch (error) {
            console.error("Submit Error:", error)
            toast.error(`Terjadi kesalahan: ${error instanceof Error ? error.message : "Unknown error"}`)
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

    // Custom Logic for Mobile Sort that mimics Investor Portal (Combination of Field + Order)
    const handleMobileSort = (value: string) => {
        switch (value) {
            case "NEWEST":
                setSortBy("buyDate")
                setSortOrder("desc")
                break
            case "PRICE_HIGH":
                setSortBy("buyPrice")
                setSortOrder("desc")
                break
            case "PRICE_LOW":
                setSortBy("buyPrice")
                setSortOrder("asc")
                break
            case "NAME_ASC":
                setSortBy("transactionCode") // Using Code as proxy for primary identifier or Unit Name
                setSortOrder("asc")
                break
            default:
                break
        }
    }

    // Helper to get current composite value
    const getMobileSortValue = () => {
        if (sortBy === "buyDate" && sortOrder === "desc") return "NEWEST"
        if (sortBy === "buyPrice" && sortOrder === "desc") return "PRICE_HIGH"
        if (sortBy === "buyPrice" && sortOrder === "asc") return "PRICE_LOW"
        if (sortBy === "transactionCode" && sortOrder === "asc") return "NAME_ASC"
        return "NEWEST"
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
                                                        {availableUnits.map((unit) => {
                                                            const duplicateInfo = getDuplicateInfo(availableUnits, unit)
                                                            return (
                                                                <SelectItem key={unit.id} value={unit.id}>
                                                                    <div className="flex items-center gap-2 w-full">
                                                                        <span>{unit.name} - {unit.plateNumber}</span>
                                                                        {duplicateInfo.isDuplicate && (
                                                                            <Badge variant="outline" className="ml-auto text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                                                                                🔄 Pembelian ke-{duplicateInfo.purchaseNumber}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </SelectItem>
                                                            )
                                                        })}
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
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            {...field}
                                                            value={field.value === 0 ? '' : field.value}
                                                            onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-4 border rounded-md p-4 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex items-center justify-between">
                                            <FormLabel>Bukti Transfer Pembelian</FormLabel>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleScanProof}
                                                disabled={isScanning || uploadedFiles.length === 0}
                                                className="gap-2"
                                            >
                                                {isScanning ? (
                                                    <>
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                        Scanning...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Scan className="h-4 w-4 text-blue-600" />
                                                        Scan AI (Total)
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <MultipleImageUpload
                                            key={resetKey}
                                            onImagesChange={(images) => {
                                                // Prevent infinite loop by only updating if files actually changed
                                                // But since onImagesChange is called on mount/update of internal state,
                                                // and internal state is managed by Child, we just need to ensure this function is stable
                                                // OR we accept the update.
                                                // The Loop happens because Parent Re-renders -> New Function -> Child Effect -> Parent State Update -> Parent Re-render

                                                // Simple fix: Check if files actually different?
                                                // Or better: Fix dependency in Child?
                                                // Let's use a stable reference for the handler if possible, but the handler updates invalidates 'uploadedFiles'.

                                                // Actually, we can just extract this function and wrap in useCallback
                                                const files = images.map(img => img.file).filter((f): f is File => f !== null)
                                                // Only update if count changed to avoid some loops? No, file content might change.
                                                // Let's break the loop by checking if state actually needs update?
                                                // Setting state to same value might still trigger re-render in some React versions/setups but usually bails out.

                                                // Best approach: useCallback in the component body
                                                setUploadedFiles(files)
                                            }}
                                            maxImages={5}
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Upload bukti transfer DP & Pelunasan. Klik "Scan AI" untuk menjumlahkan nominal otomatis.
                                        </p>
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


            <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1">
                    <Input
                        placeholder="Cari transaksi..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full md:max-w-sm"
                    />
                    <div className="flex gap-2 w-full md:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Semua Status</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="PAID">Paid</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Mobile Sort Dropdown */}
                        <div className="md:hidden w-full">
                            <Select value={getMobileSortValue()} onValueChange={handleMobileSort}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Urutkan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NEWEST">Terbaru</SelectItem>
                                    <SelectItem value="PRICE_HIGH">Harga Tertinggi</SelectItem>
                                    <SelectItem value="PRICE_LOW">Harga Terendah</SelectItem>
                                    <SelectItem value="NAME_ASC">Kode (A-Z)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                        <SelectTrigger className="w-full md:w-[200px]">
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
                {paginatedTransactions.length === 0 ? (
                    <div className="text-center p-8 border rounded-md text-muted-foreground bg-slate-50">
                        {searchQuery ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi."}
                    </div>
                ) : (
                    paginatedTransactions.map((trx) => (
                        <div key={trx.id} className="border rounded-lg p-4 space-y-4 bg-white dark:bg-slate-950 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    {trx.unit.imageUrl ? (
                                        <ImageHoverPreview
                                            src={trx.unit.imageUrl}
                                            alt={trx.unit.name}
                                            previewSize="lg"
                                            className="h-14 w-14 rounded-md overflow-hidden border border-slate-200 flex-shrink-0 relative group"
                                        >
                                            <img
                                                src={trx.unit.imageUrl}
                                                alt={trx.unit.name}
                                                className="h-full w-full object-cover cursor-pointer"
                                                onClick={() => trx.unit.imageUrl && setPreviewUrl(trx.unit.imageUrl)}
                                            />
                                        </ImageHoverPreview>
                                    ) : (
                                        <div className="h-14 w-14 rounded-md overflow-hidden border border-slate-200 cursor-pointer flex-shrink-0 relative group">
                                            <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <span className="text-[10px]">No Img</span>
                                            </div>
                                        </div>
                                    )}
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
                                    <span className="font-medium text-xs">{formatHijriFull(new Date(trx.buyDate))}</span>
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
                                            <span className="font-medium text-xs">{formatHijriFull(new Date(trx.sellDate))}</span>
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

                            <div className="flex flex-wrap gap-2 pt-2 items-center justify-between border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => setViewingTransaction(trx)}
                                >
                                    <Eye className="h-3 w-3 mr-2" /> Detail
                                </Button>
                                {!isViewer && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                                                <MoreHorizontal className="h-3 w-3 mr-1.5" />
                                                Aksi
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEdit(trx)}>
                                                <Pencil className="mr-2 h-4 w-4" /> Edit Data
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setEditingStatusTransaction({
                                                id: trx.id,
                                                transactionCode: trx.transactionCode,
                                                status: trx.status
                                            })}>
                                                <CheckCircle className="mr-2 h-4 w-4" /> Update Status
                                            </DropdownMenuItem>
                                            {trx.status === 'COMPLETED' && (
                                                <DropdownMenuItem onClick={() => handleExportPDF(trx.id, trx.transactionCode)}>
                                                    <FileText className="mr-2 h-4 w-4" /> Download Laporan
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => setDeleteTransactionId(trx.id)}
                                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                            >
                                                <Trash className="mr-2 h-4 w-4" /> Hapus
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
                                        title="Download Laporan PDF"
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
                                    checked={paginatedTransactions.length > 0 && selectedIds.length === paginatedTransactions.length}
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
                        {paginatedTransactions.map((trx) => (
                            <TableRow
                                key={trx.id}
                                className="cursor-pointer hover:bg-slate-50"
                                onClick={(e) => {
                                    if (
                                        (e.target as HTMLElement).closest("a") ||
                                        (e.target as HTMLElement).closest("button") ||
                                        (e.target as HTMLElement).closest(".prevent-row-click") ||
                                        (e.target as HTMLElement).closest("input") ||
                                        (e.target as HTMLElement).closest('[role="checkbox"]')
                                    ) {
                                        return
                                    }
                                    // @ts-ignore
                                    setViewingTransaction(trx)
                                }}
                            >

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
                                        <ImageHoverPreview
                                            src={trx.unit.imageUrl}
                                            alt={trx.unit.name}
                                            previewSize="lg"
                                            className="h-10 w-10 rounded-md overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity"
                                        >
                                            <img
                                                src={trx.unit.imageUrl}
                                                alt={trx.unit.name}
                                                className="h-full w-full object-cover cursor-pointer"
                                                onClick={() => trx.unit.imageUrl && setPreviewUrl(trx.unit.imageUrl)}
                                            />
                                        </ImageHoverPreview>
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
                                <TableCell>{formatHijriFull(new Date(trx.buyDate))}</TableCell>
                                <TableCell>
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(trx.buyPrice)}
                                </TableCell>
                                <TableCell>
                                    {trx.sellDate ? formatHijriFull(new Date(trx.sellDate)) : "-"}
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Detail</span>
                                            </Button>
                                        </Link>

                                        {!isViewer && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={() => handleEdit(trx)}
                                                    title="Edit Data"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    <span className="sr-only">Edit</span>
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Aksi</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(trx)}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Edit Data
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setEditingStatusTransaction({
                                                            id: trx.id,
                                                            transactionCode: trx.transactionCode,
                                                            status: trx.status
                                                        })}>
                                                            <CheckCircle className="mr-2 h-4 w-4" /> Update Status
                                                        </DropdownMenuItem>
                                                        {trx.status === 'COMPLETED' && (
                                                            <DropdownMenuItem onClick={() => handleExportPDF(trx.id, trx.transactionCode)}>
                                                                <FileText className="mr-2 h-4 w-4" /> Download Laporan
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => setDeleteTransactionId(trx.id)}
                                                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                        >
                                                            <Trash className="mr-2 h-4 w-4" /> Hapus
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {paginatedTransactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-4">
                                    {searchQuery ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

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

            <EditStatusDialog
                transaction={editingStatusTransaction}
                open={!!editingStatusTransaction}
                onOpenChange={(open) => !open && setEditingStatusTransaction(null)}
                onSuccess={() => {
                    fetchTransactions()
                    fetchAvailableUnits()
                    setEditingStatusTransaction(null)
                }}
            />

            <AdminTransactionDetailDialog
                open={!!viewingTransaction}
                onOpenChange={(open) => !open && setViewingTransaction(null)}
                // @ts-ignore
                transaction={viewingTransaction}
            />

        </div >
    )
}

export default function TransactionsPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading...</div>}>
            <TransactionsPageContent />
        </Suspense>
    )
}
