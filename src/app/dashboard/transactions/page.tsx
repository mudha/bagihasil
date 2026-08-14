"use client"

import { Suspense } from "react"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Plus, MoreHorizontal, Eye, FileText, CheckCircle, ArrowUp, ArrowDown, ArrowUpDown, Trash, Pencil, Scan, CheckCircle2, AlertCircle, ReceiptText, Wallet, TrendingUp, Sparkles } from "lucide-react"
import { MultipleImageUpload } from "@/components/ui/multi-image-upload"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { formatHijriFull } from "@/lib/date-utils"
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

function calculateManagerCapital(buyPrice: unknown, investorCapital: unknown) {
    const parsedBuyPrice = Number(buyPrice)
    const normalizedBuyPrice = Number.isFinite(parsedBuyPrice) ? Math.max(parsedBuyPrice, 0) : 0
    const parsedInvestorCapital = investorCapital === undefined || investorCapital === null || investorCapital === ""
        ? normalizedBuyPrice
        : Number(investorCapital)
    const normalizedInvestorCapital = Number.isFinite(parsedInvestorCapital) ? Math.max(parsedInvestorCapital, 0) : 0

    return Math.max(normalizedBuyPrice - normalizedInvestorCapital, 0)
}

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
            isActive?: boolean
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
    _count?: {
        paymentHistories: number
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

const INVESTOR_TONES = [
    {
        accent: "#2563eb",
        rowBg: "#eff6ff",
        chipBg: "#dbeafe",
        chipText: "#1e3a8a",
        stripe: "linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)",
    },
    {
        accent: "#16a34a",
        rowBg: "#f0fdf4",
        chipBg: "#dcfce7",
        chipText: "#14532d",
        stripe: "linear-gradient(90deg, #16a34a 0%, #84cc16 100%)",
    },
    {
        accent: "#f59e0b",
        rowBg: "#fffbeb",
        chipBg: "#fef3c7",
        chipText: "#78350f",
        stripe: "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
    },
    {
        accent: "#dc2626",
        rowBg: "#fef2f2",
        chipBg: "#fee2e2",
        chipText: "#7f1d1d",
        stripe: "linear-gradient(90deg, #dc2626 0%, #fb7185 100%)",
    },
    {
        accent: "#4f46e5",
        rowBg: "#eef2ff",
        chipBg: "#e0e7ff",
        chipText: "#312e81",
        stripe: "linear-gradient(90deg, #4f46e5 0%, #818cf8 100%)",
    },
    {
        accent: "#db2777",
        rowBg: "#fdf2f8",
        chipBg: "#fce7f3",
        chipText: "#831843",
        stripe: "linear-gradient(90deg, #db2777 0%, #f472b6 100%)",
    },
    {
        accent: "#0f766e",
        rowBg: "#f0fdfa",
        chipBg: "#ccfbf1",
        chipText: "#134e4a",
        stripe: "linear-gradient(90deg, #0f766e 0%, #2dd4bf 100%)",
    },
    {
        accent: "#475569",
        rowBg: "#f8fafc",
        chipBg: "#e2e8f0",
        chipText: "#0f172a",
        stripe: "linear-gradient(90deg, #475569 0%, #94a3b8 100%)",
    },
] as const

const INVESTOR_TONE_OVERRIDES: Record<string, (typeof INVESTOR_TONES)[number]> = {
    "wahyu prasetyo adi": INVESTOR_TONES[0],
    "achmad firmansyah": INVESTOR_TONES[2],
    "wiwin yuli widiastuti": INVESTOR_TONES[5],
}

const getInvestorTone = (investorKey?: string | null) => {
    const value = investorKey?.trim().toLowerCase().replace(/\s+/g, " ") || "unknown-investor"
    const override = INVESTOR_TONE_OVERRIDES[value]

    if (override) return override

    let hash = 0

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0
    }

    return INVESTOR_TONES[hash % INVESTOR_TONES.length]
}

const getInvestorInitials = (name?: string | null) => {
    const initials = name
        ?.trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")

    return initials || "?"
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

const getPaymentStatusBadge = (transaction: Transaction) => {
    if (transaction.status !== "COMPLETED") {
        return <span className="text-xs text-muted-foreground">-</span>
    }

    // Check if legacy transaction (sold before: Jan 1, 2026)
    if (transaction.sellDate) {
        const sellDate = new Date(transaction.sellDate)
        const appCreationDate = new Date("2026-01-01")
        // Reset time part to compare dates only
        sellDate.setHours(0, 0, 0, 0)
        appCreationDate.setHours(0, 0, 0, 0)

        if (sellDate < appCreationDate) {
            return (
                <Badge variant="default" className="bg-emerald-600 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Lunas
                </Badge>
            )
        }
    }

    const paymentCount = transaction._count?.paymentHistories || 0

    if (paymentCount > 0) {
        return (
            <Badge variant="default" className="bg-emerald-600 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Lunas
            </Badge>
        )
    }

    return (
        <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50 gap-1">
            <AlertCircle className="h-3 w-3" />
            Belum Bayar
        </Badge>
    )
}


function TransactionsPageContent() {
    const { data: session } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
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
    const [investorStatusFilter, setInvestorStatusFilter] = useState("active")

    useEffect(() => {
        const status = searchParams.get('status')
        const investorStatus = searchParams.get('investorStatus')
        if (status) {
            setStatusFilter(status)
        }
        if (investorStatus) {
            setInvestorStatusFilter(investorStatus)
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

                // Pemodal covers the full scanned purchase price by default.
                setAutoManagerCapital(total, total)

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

        let matchesInvestorStatus = true
        if (investorStatusFilter === 'active') {
            // @ts-ignore
            matchesInvestorStatus = trx.unit.investor?.isActive !== false
        } else if (investorStatusFilter === 'inactive') {
            // @ts-ignore
            matchesInvestorStatus = trx.unit.investor?.isActive === false
        }

        return matchesSearch && matchesInvestor && matchesStatus && matchesInvestorStatus
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
            case "duration":
                const getDuration = (t: Transaction) => {
                    if (!t.sellDate) return 0
                    return new Date(t.sellDate).getTime() - new Date(t.buyDate).getTime()
                }
                compareValue = getDuration(a) - getDuration(b)
                break
            case "paymentStatus":
                const getStatusValue = (t: Transaction) => {
                    // Logic: 0 = Not Completed, 1 = Unpaid, 2 = Paid (Legacy or Actual)
                    if (t.status !== 'COMPLETED') return 0

                    // Check legacy (Sold before Jan 1, 2026)
                    if (t.sellDate) {
                        const sellDate = new Date(t.sellDate)
                        const cutoffDate = new Date("2026-01-01")
                        sellDate.setHours(0, 0, 0, 0)
                        cutoffDate.setHours(0, 0, 0, 0)
                        if (sellDate < cutoffDate) return 2
                    }

                    // Check actual payment
                    if ((t._count?.paymentHistories || 0) > 0) return 2

                    return 1
                }
                compareValue = getStatusValue(a) - getStatusValue(b)
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
        } catch {
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
        } catch {
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

    function setAutoManagerCapital(buyPrice: unknown, investorCapital: unknown) {
        if (editingTransaction) return

        form.setValue(
            'initialManagerCapital',
            calculateManagerCapital(buyPrice, investorCapital),
            { shouldDirty: true, shouldValidate: true }
        )
    }

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
                setViewingTransaction(null)
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
                    } catch {
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
        } catch {
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
        const loadingToastId = toast.loading(`Mengekspor laporan ${transactionCode}...`)

        try {
            const { exportTransactionReportPDF } = await import("@/lib/export-utils")
            const result = await exportTransactionReportPDF(transactionId, transactionCode)

            toast.dismiss(loadingToastId)
            if (result.success) {
                toast.success("Laporan PDF berhasil diunduh!")
            } else {
                toast.error(result.error || "Gagal mengekspor laporan PDF")
            }
        } catch {
            toast.dismiss(loadingToastId)
            toast.error("Gagal memuat modul ekspor PDF. Silakan coba lagi.")
        } finally {
            setExportingTransactionId(null)
        }
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

    const formatCurrencyShort = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(value)
    }

    const transactionSummary = {
        total: filteredTransactions.length,
        active: filteredTransactions.filter(trx => trx.status !== "COMPLETED" && trx.status !== "CANCELLED").length,
        completed: filteredTransactions.filter(trx => trx.status === "COMPLETED").length,
        buyValue: filteredTransactions.reduce((sum, trx) => sum + trx.buyPrice, 0),
    }

    return (
        <div className="space-y-5 lg:space-y-7">
            <section className="relative overflow-hidden rounded-lg bg-[#073f3b] text-white shadow-2xl shadow-teal-950/15">
                <div className="absolute -right-20 -top-24 size-72 rounded-full bg-teal-300/20 blur-3xl" />
                <div className="absolute -bottom-24 left-8 size-56 rounded-full bg-lime-300/20 blur-3xl" />
                <div className="relative flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
                    <div className="max-w-2xl space-y-3">
                        <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/15">
                            <Sparkles className="size-3" />
                            Deal flow
                        </Badge>
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-100/75">Daftar Transaksi</p>
                            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                                Alur beli-jual tampil lebih hidup.
                            </h1>
                        </div>
                        <p className="text-sm leading-6 text-teal-50/75 sm:text-base">
                            Pantau transaksi berjalan, status bayar, nilai beli, dan laporan selesai dengan tampilan yang lebih fokus.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <ReceiptText className="mb-3 size-5 text-lime-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Total</p>
                                <p className="mt-1 text-2xl font-black">{transactionSummary.total}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <TrendingUp className="mb-3 size-5 text-sky-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Berjalan</p>
                                <p className="mt-1 text-2xl font-black">{transactionSummary.active}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <CheckCircle2 className="mb-3 size-5 text-lime-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Selesai</p>
                                <p className="mt-1 text-2xl font-black">{transactionSummary.completed}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <Wallet className="mb-3 size-5 text-amber-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Nilai beli</p>
                                <p className="mt-1 text-2xl font-black leading-tight [overflow-wrap:anywhere]">{formatCurrencyShort(transactionSummary.buyValue)}</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            <div className="rounded-lg border border-teal-900/10 bg-white/85 p-3 shadow-sm backdrop-blur">
                <div className="grid w-full grid-cols-2 gap-2 [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:w-full lg:flex lg:justify-end lg:[&_[data-slot=button]]:w-auto">
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
                            setViewingTransaction(null)
                            form.reset()
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="h-11 rounded-lg bg-teal-600 px-4 font-black shadow-lg shadow-teal-600/20 hover:bg-teal-700">
                                <Plus className="mr-2 h-4 w-4" /> Transaksi Baru
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="grid h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 border-teal-900/10 p-0 shadow-2xl shadow-slate-950/20 sm:h-[92dvh] sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:rounded-2xl sm:border">
                            <DialogHeader className="bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-16 text-left text-white sm:px-7 sm:py-5 sm:pr-20">
                                <div className="w-fit rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-teal-100">
                                    {editingTransaction ? "Mode edit" : "Transaksi baru"}
                                </div>
                                <DialogTitle className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{editingTransaction ? "Edit Transaksi" : "Mulai Transaksi Baru"}</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-col overflow-hidden">
                                    <div className="touch-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 pb-6 [&_[data-slot=input]]:h-11 [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full sm:p-6 sm:pb-8">
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
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                                            onChange={e => {
                                                                const buyPrice = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                                                field.onChange(buyPrice)
                                                                setAutoManagerCapital(buyPrice, form.getValues('initialInvestorCapital'))
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-4 rounded-lg border border-teal-900/10 bg-teal-50/50 p-4 dark:bg-slate-900/50">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
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
                                                        min="0"
                                                        placeholder="Kosongkan jika sama dengan harga beli"
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        onChange={(e) => {
                                                            const investorCapital = e.target.value === '' ? undefined : parseFloat(e.target.value)
                                                            field.onChange(investorCapital)
                                                            setAutoManagerCapital(form.getValues('buyPrice'), investorCapital)
                                                        }}
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
                                                        min="0"
                                                        placeholder="0"
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                                <p className="text-xs text-muted-foreground">Otomatis: harga beli dikurangi modal pemodal, dan tetap bisa disesuaikan manual</p>
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
                                    </div>
                                    <div className="safe-pb shrink-0 border-t border-slate-200 bg-white/95 px-4 pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 sm:pb-4">
                                        <Button type="submit" className="h-12 w-full rounded-xl bg-teal-600 text-base font-black shadow-lg shadow-teal-600/20 hover:bg-teal-700">{editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi"}</Button>
                                    </div>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>


            <div className="grid grid-cols-2 gap-2 rounded-lg border border-teal-900/10 bg-white/95 p-3 shadow-sm backdrop-blur lg:grid-cols-[minmax(240px,1fr)_150px_150px_220px] lg:items-center lg:gap-3">
                    <div className="relative col-span-2 w-full lg:col-span-1">
                        <Input
                            placeholder="Cari transaksi..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="h-11 w-full rounded-lg border-teal-900/10 bg-white pr-10"
                        />
                        {searchQuery && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setSearchQuery("")}
                            >
                                <span className="sr-only">Clear search</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </Button>
                        )}
                    </div>
                    <Select value={investorStatusFilter} onValueChange={(value) => {
                        setInvestorStatusFilter(value)
                        const params = new URLSearchParams(searchParams.toString())
                        if (value) params.set('investorStatus', value)
                        else params.delete('investorStatus')
                        window.history.replaceState(null, '', `?${params.toString()}`)
                    }}>
                        <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white lg:w-[150px]">
                            <SelectValue placeholder="Status Pemodal" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Pemodal Aktif</SelectItem>
                            <SelectItem value="inactive">Pemodal Arsip</SelectItem>
                            <SelectItem value="all">Semua Pemodal</SelectItem>
                        </SelectContent>
                    </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white lg:w-[150px]">
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
                        <div className="w-full lg:hidden">
                            <Select value={getMobileSortValue()} onValueChange={handleMobileSort}>
                                <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white">
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
                    <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                        <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white lg:w-[220px]">
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

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
                {paginatedTransactions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-teal-900/20 bg-white/80 p-8 text-center text-muted-foreground">
                        {searchQuery ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi."}
                    </div>
                ) : (
                    paginatedTransactions.map((trx) => {
                        const investorTone = getInvestorTone(trx.unit.investor.name || trx.unit.investorId)

                        return (
                        <div
                            key={trx.id}
                            className="overflow-hidden rounded-lg border bg-white shadow-sm"
                            style={{ borderColor: investorTone.accent }}
                        >
                            <div className="h-1.5" style={{ background: investorTone.stripe }} />
                            <div className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 gap-3">
                                    {trx.unit.imageUrl ? (
                                        <ImageHoverPreview
                                            src={trx.unit.imageUrl}
                                            alt={trx.unit.name}
                                            previewSize="lg"
                                            className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-teal-900/10"
                                        >
                                            <img
                                                src={trx.unit.imageUrl}
                                                alt={trx.unit.name}
                                                className="h-full w-full object-cover cursor-pointer"
                                                onClick={() => trx.unit.imageUrl && setPreviewUrl(trx.unit.imageUrl)}
                                            />
                                        </ImageHoverPreview>
                                    ) : (
                                        <div className="relative h-14 w-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-teal-900/10">
                                            <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <span className="text-[10px]">No Img</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-teal-50 px-2 py-1 font-mono text-xs font-bold text-teal-700 [overflow-wrap:anywhere]">{trx.transactionCode}</span>
                                            <Badge variant={trx.status === 'COMPLETED' ? 'default' : 'secondary'} className="h-5 rounded-full py-0 text-[10px]">
                                                {trx.status}
                                            </Badge>
                                            <div className="text-[10px]">
                                                {getPaymentStatusBadge(trx)}
                                            </div>
                                        </div>
                                        <div className="text-sm font-black leading-snug text-slate-950 [overflow-wrap:anywhere]">{trx.unit.name}</div>
                                        <div className="text-xs text-slate-500 [overflow-wrap:anywhere]">{trx.unit.plateNumber}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Investor</span>
                                    <span
                                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-black"
                                        style={{
                                            backgroundColor: investorTone.chipBg,
                                            borderColor: investorTone.accent,
                                            color: investorTone.chipText,
                                        }}
                                    >
                                        <span
                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm"
                                            style={{ backgroundColor: investorTone.accent }}
                                        >
                                            {getInvestorInitials(trx.unit.investor.name)}
                                        </span>
                                        <span className="truncate [overflow-wrap:anywhere]">{trx.unit.investor.name}</span>
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Durasi</span>
                                    <span className="text-xs font-medium [overflow-wrap:anywhere]">{calculateDuration(trx.buyDate, trx.sellDate)}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Tanggal Beli</span>
                                    <span className="text-xs font-medium [overflow-wrap:anywhere]">{formatHijriFull(new Date(trx.buyDate))}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Harga Beli</span>
                                    <span className="text-xs font-medium text-emerald-600 [overflow-wrap:anywhere]">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(trx.buyPrice)}
                                    </span>
                                </div>
                                {trx.sellDate && (
                                    <>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-1">Tanggal Jual</span>
                                            <span className="text-xs font-medium [overflow-wrap:anywhere]">{formatHijriFull(new Date(trx.sellDate))}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-muted-foreground mb-1">Harga Jual</span>
                                            <span className="text-xs font-medium text-blue-600 [overflow-wrap:anywhere]">
                                                {trx.sellPrice ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(trx.sellPrice) : "-"}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
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
                                        <DropdownMenuContent align="end" className="min-w-56 rounded-xl border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                                            <DropdownMenuLabel className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Menu Transaksi</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-teal-50 focus:text-teal-700"
                                                onSelect={() => {
                                                    setViewingTransaction(null)
                                                    handleEdit(trx)
                                                }}
                                            >
                                                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                                                    <Pencil className="h-4 w-4" />
                                                </span>
                                                Edit Data
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-emerald-50 focus:text-emerald-700"
                                                onSelect={() => {
                                                    setViewingTransaction(null)
                                                    setEditingStatusTransaction({
                                                        id: trx.id,
                                                        transactionCode: trx.transactionCode,
                                                        status: trx.status
                                                    })
                                                }}
                                            >
                                                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                                    <CheckCircle className="h-4 w-4" />
                                                </span>
                                                Update Status
                                            </DropdownMenuItem>
                                            {trx.status === 'COMPLETED' && (
                                                <DropdownMenuItem
                                                    className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-blue-50 focus:text-blue-700"
                                                    onSelect={() => {
                                                        setViewingTransaction(null)
                                                        handleExportPDF(trx.id, trx.transactionCode)
                                                    }}
                                                >
                                                    <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                                        <FileText className="h-4 w-4" />
                                                    </span>
                                                    Download Laporan
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator className="my-2" />
                                            <DropdownMenuItem
                                                onSelect={() => {
                                                    setViewingTransaction(null)
                                                    setDeleteTransactionId(trx.id)
                                                }}
                                                className="h-11 rounded-lg text-sm font-bold text-red-600 focus:bg-red-50 focus:text-red-700"
                                            >
                                                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                                    <Trash className="h-4 w-4" />
                                                </span>
                                                Hapus
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
                        </div>
                        )
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto rounded-lg border border-teal-900/10 bg-white shadow-sm lg:block">
                <Table className="min-w-[1540px]">
                    <TableHeader className="bg-teal-50/70">
                        <TableRow className="hover:bg-teal-50/70">
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
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "duration") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("duration")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Durasi
                                    {sortBy === "duration" ? (
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
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "paymentStatus") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("paymentStatus")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Status Bayar
                                    {sortBy === "paymentStatus" ? (
                                        sortOrder === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead className="w-[112px] text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedTransactions.map((trx) => {
                            const investorTone = getInvestorTone(trx.unit.investor.name || trx.unit.investorId)

                            return (
                            <TableRow
                                key={trx.id}
                                className="cursor-pointer border-l-[6px] border-y-slate-100 border-r-slate-100 transition hover:brightness-[0.98]"
                                style={{
                                    backgroundColor: investorTone.rowBg,
                                    borderLeftColor: investorTone.accent,
                                }}
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
                                <TableCell className="font-mono text-sm font-bold text-teal-700 [overflow-wrap:anywhere]">{trx.transactionCode}</TableCell>
                                <TableCell className="max-w-[240px] whitespace-normal">
                                    <span
                                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-black"
                                        style={{
                                            backgroundColor: investorTone.chipBg,
                                            borderColor: investorTone.accent,
                                            color: investorTone.chipText,
                                        }}
                                    >
                                        <span
                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm"
                                            style={{ backgroundColor: investorTone.accent }}
                                        >
                                            {getInvestorInitials(trx.unit.investor.name)}
                                        </span>
                                        <span className="truncate [overflow-wrap:anywhere]">{trx.unit.investor.name}</span>
                                    </span>
                                </TableCell>
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
                                <TableCell className="max-w-[320px] whitespace-normal">
                                    <div className="font-semibold text-slate-950 [overflow-wrap:anywhere]">{trx.unit.name}</div>
                                    <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{trx.unit.plateNumber}</div>
                                </TableCell>
                                <TableCell className="max-w-[180px] whitespace-normal [overflow-wrap:anywhere]">{formatHijriFull(new Date(trx.buyDate))}</TableCell>
                                <TableCell className="[overflow-wrap:anywhere]">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(trx.buyPrice)}
                                </TableCell>
                                <TableCell className="max-w-[180px] whitespace-normal [overflow-wrap:anywhere]">
                                    {trx.sellDate ? formatHijriFull(new Date(trx.sellDate)) : "-"}
                                </TableCell>
                                <TableCell className="[overflow-wrap:anywhere]">
                                    {trx.sellPrice ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(trx.sellPrice) : "-"}
                                </TableCell>
                                <TableCell className="whitespace-normal [overflow-wrap:anywhere]">
                                    {calculateDuration(trx.buyDate, trx.sellDate)}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={trx.status === 'COMPLETED' ? 'default' : 'secondary'} className="rounded-full">
                                        {trx.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {getPaymentStatusBadge(trx)}
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
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-9 rounded-lg border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700">
                                                            <MoreHorizontal className="mr-1.5 h-4 w-4" />
                                                            Aksi
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-56 rounded-xl border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                                                        <DropdownMenuLabel className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Menu Transaksi</DropdownMenuLabel>
                                                        <DropdownMenuItem
                                                            className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-teal-50 focus:text-teal-700"
                                                            onSelect={() => {
                                                                setViewingTransaction(null)
                                                                handleEdit(trx)
                                                            }}
                                                        >
                                                            <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                                                                <Pencil className="h-4 w-4" />
                                                            </span>
                                                            Edit Data
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-emerald-50 focus:text-emerald-700"
                                                            onSelect={() => {
                                                                setViewingTransaction(null)
                                                                setEditingStatusTransaction({
                                                                    id: trx.id,
                                                                    transactionCode: trx.transactionCode,
                                                                    status: trx.status
                                                                })
                                                            }}
                                                        >
                                                            <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                                                <CheckCircle className="h-4 w-4" />
                                                            </span>
                                                            Update Status
                                                        </DropdownMenuItem>
                                                        {trx.status === 'COMPLETED' && (
                                                            <DropdownMenuItem
                                                                className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-blue-50 focus:text-blue-700"
                                                                onSelect={() => {
                                                                    setViewingTransaction(null)
                                                                    handleExportPDF(trx.id, trx.transactionCode)
                                                                }}
                                                            >
                                                                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                                                    <FileText className="h-4 w-4" />
                                                                </span>
                                                                Download Laporan
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator className="my-2" />
                                                        <DropdownMenuItem
                                                            onSelect={() => {
                                                                setViewingTransaction(null)
                                                                setDeleteTransactionId(trx.id)
                                                            }}
                                                            className="h-11 rounded-lg text-sm font-bold text-red-600 focus:bg-red-50 focus:text-red-700"
                                                        >
                                                            <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                                                <Trash className="h-4 w-4" />
                                                            </span>
                                                            Hapus
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                            )
                        })}
                        {paginatedTransactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={12} className="text-center py-4">
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
                open={!!viewingTransaction && !isOpen}
                onOpenChange={(open) => !open && setViewingTransaction(null)}
                // @ts-ignore
                transaction={viewingTransaction}
                onEdit={() => {
                    if (viewingTransaction) {
                        handleEdit(viewingTransaction)
                        setViewingTransaction(null)
                    }
                }}
                onViewDetail={() => {
                    if (viewingTransaction) {
                        router.push(`/dashboard/transactions/${viewingTransaction.id}`)
                    }
                }}
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
