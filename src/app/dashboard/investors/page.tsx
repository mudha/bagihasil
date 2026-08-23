"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Download, FileText, FileSpreadsheet, Sheet, Wallet, AlertTriangle, CircleDollarSign } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { runExportAction } from "@/lib/run-export-action"
import { useSession } from "next-auth/react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatRupiahOrNull } from "@/lib/rupiah-format"

const investorSchema = z.object({
    name: z.string().min(1, "Nama wajib diisi"),
    contactInfo: z.string().optional(),
    bankAccountDetails: z.string().optional(),
    notes: z.string().optional(),
    marginPercentage: z.number().min(0).max(100),
    userId: z.string().optional().nullable(),
})

type InvestorFormValues = z.infer<typeof investorSchema>

interface Investor {
    id: string
    name: string
    contactInfo: string
    bankAccountDetails: string
    notes: string
    marginPercentage: number
    isActive: boolean
    userId?: string | null
}

interface User {
    id: string
    name: string
    role: string
}

interface ManagedCapitalSummary {
    investorId: string
    managedCapitalBalance: string | null
    managedCapitalBalanceUpdatedAt: string | null
    activeAllocatedInvestorCapital: string
    availableManagedCapital: string | null
    managedCapitalStatus: "UNSET" | "SET"
    warnings: Array<{
        code: "ALLOCATION_EXCEEDS_MANAGED_BALANCE" | "MULTIPLE_ACTIVE_TRANSACTIONS_PER_UNIT"
        message: string
    }>
}

/* ---------- BigInt-safe rupiah input validation ---------- */

function isValidRupiahInput(raw: string): boolean {
    return /^\d+$/.test(raw)
}

function formatTimestamp(iso: string | null): string {
    if (!iso) return ""
    try {
        return new Date(iso).toLocaleString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return iso
    }
}

/* ---------- Set/Clear Managed Capital Dialog ---------- */

function ManagedCapitalDialog({
    investor,
    currentSummary,
    onUpdate,
}: {
    investor: Investor
    currentSummary: ManagedCapitalSummary | null
    onUpdate: () => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [inputValue, setInputValue] = useState("")
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setInputValue(currentSummary?.managedCapitalBalance ?? "")
            // focus input on open
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen, currentSummary?.managedCapitalBalance])

    const handleSet = useCallback(async () => {
        if (!isValidRupiahInput(inputValue)) {
            toast.error("Input harus berupa angka bulat positif tanpa spasi atau simbol.")
            return
        }
        setIsSaving(true)
        try {
            const res = await fetch(`/api/investors/${investor.id}/managed-capital`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "set",
                    managedCapitalBalance: inputValue,
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || "Gagal menyimpan saldo modal.")
                return
            }
            toast.success("Saldo modal berhasil disimpan.")
            setIsOpen(false)
            onUpdate()
        } catch {
            toast.error("Terjadi kesalahan sistem.")
        } finally {
            setIsSaving(false)
        }
    }, [inputValue, investor.id, onUpdate])

    const handleClear = useCallback(async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/investors/${investor.id}/managed-capital`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "clear" }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || "Gagal menghapus saldo modal.")
                return
            }
            toast.success("Saldo modal berhasil dihapus.")
            setShowClearConfirm(false)
            setIsOpen(false)
            onUpdate()
        } catch {
            toast.error("Terjadi kesalahan sistem.")
        } finally {
            setIsSaving(false)
        }
    }, [investor.id, onUpdate])

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label={`Atur saldo modal ${investor.name}`}>
                        <Wallet className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Modal</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Saldo Modal — {investor.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Current balance display */}
                        <div className="rounded-lg border bg-slate-50 p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Saldo Modal Kelolaan Saat Ini</p>
                            <p className="text-lg font-bold">
                                {formatRupiahOrNull(currentSummary?.managedCapitalBalance ?? null)}
                            </p>
                            {currentSummary?.managedCapitalBalanceUpdatedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Diperbarui: {formatTimestamp(currentSummary.managedCapitalBalanceUpdatedAt)}
                                </p>
                            )}
                        </div>

                        {/* Allocation summary */}
                        {currentSummary && (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="rounded border p-2">
                                    <p className="text-xs text-muted-foreground">Sedang Dialokasikan</p>
                                    <p className="font-semibold">{formatRupiahOrNull(currentSummary.activeAllocatedInvestorCapital)}</p>
                                </div>
                                <div className="rounded border p-2">
                                    <p className="text-xs text-muted-foreground">Sisa Tersedia</p>
                                    <p className="font-semibold">{formatRupiahOrNull(currentSummary.availableManagedCapital)}</p>
                                </div>
                            </div>
                        )}

                        {/* Input for set */}
                        <div className="space-y-2">
                            <Label htmlFor={`capital-input-${investor.id}`}>Saldo Baru (Rp)</Label>
                            <Input
                                id={`capital-input-${investor.id}`}
                                ref={inputRef}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="Contoh: 5000000"
                                value={inputValue}
                                onChange={(e) => {
                                    const v = e.target.value.replace(/[^\d]/g, "")
                                    setInputValue(v)
                                }}
                                disabled={isSaving}
                                aria-describedby="capital-input-help"
                            />
                            <p id="capital-input-help" className="text-xs text-muted-foreground">
                                Saldo modal terkini yang sedang dikelola. Hanya angka bulat tanpa simbol.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowClearConfirm(true)}
                                disabled={isSaving || currentSummary?.managedCapitalStatus === "UNSET"}
                            >
                                Hapus Nilai
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSet}
                                disabled={isSaving || !isValidRupiahInput(inputValue)}
                            >
                                {isSaving ? "Menyimpan..." : "Simpan"}
                            </Button>
                        </div>

                        {/* Warnings */}
                        {currentSummary?.warnings.map((w, i) => (
                            <Alert key={i} variant="destructive" className="text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{w.message}</AlertDescription>
                            </Alert>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Clear Confirmation */}
            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Saldo Modal?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Saldo modal kelolaan untuk {investor.name} akan dikosongkan menjadi status &ldquo;Belum diatur&rdquo;.
                            Transaksi dan data finansial lain tidak terpengaruh.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClear} disabled={isSaving}>
                            {isSaving ? "Menghapus..." : "Ya, Hapus"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

/* ---------- Capital Summary Display Row (Desktop) ---------- */

function CapitalSummaryCell({ summary }: { summary: ManagedCapitalSummary | null }) {
    if (!summary) return <TableCell className="text-muted-foreground text-xs italic">Memuat...</TableCell>
    return (
        <>
            <TableCell>
                <div className="text-sm">
                    <span className="font-semibold">{formatRupiahOrNull(summary.managedCapitalBalance)}</span>
                    {summary.managedCapitalStatus === "UNSET" && (
                        <span className="ml-1 text-xs text-muted-foreground">(Belum diatur)</span>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <span className="text-sm font-medium">{formatRupiahOrNull(summary.activeAllocatedInvestorCapital)}</span>
            </TableCell>
            <TableCell>
                <div className="text-sm">
                    <span className="font-medium">{formatRupiahOrNull(summary.availableManagedCapital)}</span>
                    {summary.warnings.some(w => w.code === "ALLOCATION_EXCEEDS_MANAGED_BALANCE") && (
                        <Badge variant="destructive" className="ml-1 text-[10px]">⚠ Melebihi</Badge>
                    )}
                </div>
            </TableCell>
        </>
    )
}

/* ---------- Capital Summary Mobile Card ---------- */

function CapitalSummaryMobile({
    summary,
}: {
    summary: ManagedCapitalSummary | null
}) {
    if (!summary) return null
    return (
        <div className="rounded-md border border-dashed bg-slate-50/80 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-1.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                <CircleDollarSign className="h-3.5 w-3.5" /> Modal Kelolaan
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <p className="text-xs text-muted-foreground">Saldo Saat Ini</p>
                    <p className="font-bold text-sm">{formatRupiahOrNull(summary.managedCapitalBalance)}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Sedang Dialokasikan</p>
                    <p className="font-semibold text-sm">{formatRupiahOrNull(summary.activeAllocatedInvestorCapital)}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Sisa Tersedia</p>
                    <p className="font-semibold text-sm">{formatRupiahOrNull(summary.availableManagedCapital)}</p>
                </div>
                {summary.managedCapitalBalanceUpdatedAt && (
                    <div>
                        <p className="text-xs text-muted-foreground">Terakhir Diperbarui</p>
                        <p className="text-xs">{formatTimestamp(summary.managedCapitalBalanceUpdatedAt)}</p>
                    </div>
                )}
            </div>
            {summary.warnings.map((w, i) => (
                <Alert key={i} variant="destructive" className="text-xs py-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <AlertDescription>{w.message}</AlertDescription>
                </Alert>
            ))}
        </div>
    )
}

/* ========== Main Page ========== */

export default function InvestorsPage() {
    const [investors, setInvestors] = useState<Investor[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)
    const [exportingInvestor, setExportingInvestor] = useState<string | null>(null)
    const [isExportingAll, setIsExportingAll] = useState(false)
    const [users, setUsers] = useState<User[]>([])
    const [capitalSummaries, setCapitalSummaries] = useState<Map<string, ManagedCapitalSummary> | null>(null)
    const { data: session } = useSession()
    const isViewer = session?.user?.role === "VIEWER"

    const form = useForm<InvestorFormValues>({
        resolver: zodResolver(investorSchema),
        defaultValues: {
            name: "",
            contactInfo: "",
            bankAccountDetails: "",
            notes: "",
            marginPercentage: 50,
            userId: null,
        },
    })

    const fetchInvestors = async () => {
        const res = await fetch('/api/investors')
        const data = await res.json()
        setInvestors(data)
    }

    const fetchUsers = async () => {
        const res = await fetch('/api/users')
        if (res.ok) {
            const data = await res.json()
            setUsers(data.filter((u: any) => u.role === "INVESTOR"))
        }
    }

    const fetchCapitalSummaries = useCallback(async () => {
        try {
            const res = await fetch('/api/investors/capital-summary')
            if (res.ok) {
                const data: ManagedCapitalSummary[] = await res.json()
                const map = new Map<string, ManagedCapitalSummary>()
                for (const s of data) {
                    map.set(s.investorId, s)
                }
                setCapitalSummaries(map)
            } else {
                setCapitalSummaries(new Map())
            }
        } catch {
            setCapitalSummaries(new Map())
        }
    }, [])

    useEffect(() => {
        fetchInvestors()
        fetchUsers()
        fetchCapitalSummaries()
    }, [fetchCapitalSummaries])

    useEffect(() => {
        if (editingInvestor) {
            form.reset({
                name: editingInvestor.name,
                contactInfo: editingInvestor.contactInfo || "",
                bankAccountDetails: editingInvestor.bankAccountDetails || "",
                notes: editingInvestor.notes || "",
                marginPercentage: editingInvestor.marginPercentage || 50,
                userId: editingInvestor.userId || null,
            })
        } else {
            form.reset({
                name: "",
                contactInfo: "",
                bankAccountDetails: "",
                notes: "",
                marginPercentage: 50,
                userId: null,
            })
        }
    }, [editingInvestor, form])

    async function onSubmit(values: InvestorFormValues) {
        try {
            const payload = {
                ...values,
                userId: values.userId === "none" ? null : values.userId
            }

            if (editingInvestor) {
                const res = await fetch(`/api/investors/${editingInvestor.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })

                if (res.ok) {
                    toast.success("Pemodal berhasil diupdate")
                    setIsOpen(false)
                    setEditingInvestor(null)
                    form.reset()
                    fetchInvestors()
                } else {
                    const errorData = await res.json()
                    toast.error(errorData.error || "Gagal mengupdate pemodal")
                }
            } else {
                const res = await fetch('/api/investors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })

                if (res.ok) {
                    toast.success("Pemodal berhasil ditambahkan")
                    setIsOpen(false)
                    form.reset()
                    fetchInvestors()
                } else {
                    const errorData = await res.json()
                    toast.error(errorData.error || "Gagal menambahkan pemodal")
                }
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        }
    }

    const handleEdit = (investor: Investor) => {
        setEditingInvestor(investor)
        setIsOpen(true)
    }

    const handleCloseDialog = (open: boolean) => {
        setIsOpen(open)
        if (!open) {
            setEditingInvestor(null)
            form.reset()
        }
    }

    const handleExportXLSX = async (investorId: string, investorName: string) => {
        await runExportAction({
            loadingMessage: `Mengekspor laporan Excel untuk ${investorName}...`,
            successMessage: "Laporan Excel berhasil diunduh!",
            fallbackErrorMessage: "Gagal mengekspor laporan Excel",
            thrownErrorMessage: "Gagal mengekspor laporan Excel. Silakan coba lagi.",
            run: async () => {
                const { exportInvestorReportXLSX } = await import("@/lib/export-utils")
                return exportInvestorReportXLSX(investorId, investorName)
            },
            onStart: () => setExportingInvestor(investorId),
            onFinish: () => setExportingInvestor(null),
            toast,
        })
    }

    const handleExportPDF = async (investorId: string, investorName: string) => {
        await runExportAction({
            loadingMessage: `Mengekspor laporan PDF untuk ${investorName}...`,
            successMessage: "Laporan PDF berhasil diunduh!",
            fallbackErrorMessage: "Gagal mengekspor laporan PDF",
            thrownErrorMessage: "Gagal mengekspor laporan PDF. Silakan coba lagi.",
            run: async () => {
                const { exportInvestorReportPDF } = await import("@/lib/export-utils")
                return exportInvestorReportPDF(investorId, investorName)
            },
            onStart: () => setExportingInvestor(investorId),
            onFinish: () => setExportingInvestor(null),
            toast,
        })
    }

    const handleExportAll = async () => {
        await runExportAction({
            loadingMessage: 'Mengekspor data semua pemodal...',
            successMessage: 'Laporan semua pemodal berhasil diunduh!',
            fallbackErrorMessage: 'Gagal mengekspor laporan',
            thrownErrorMessage: 'Gagal mengekspor laporan semua pemodal. Silakan coba lagi.',
            run: async () => {
                const { exportAllInvestorsXLSX } = await import("@/lib/export-utils")
                return exportAllInvestorsXLSX()
            },
            onStart: () => setIsExportingAll(true),
            onFinish: () => setIsExportingAll(false),
            toast,
        })
    }

    const handleToggleActive = async (investor: Investor) => {
        const newStatus = !investor.isActive
        try {
            setInvestors(prev => prev.map(inv =>
                inv.id === investor.id ? { ...inv, isActive: newStatus } : inv
            ))

            const res = await fetch(`/api/investors/${investor.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: newStatus }),
            })

            if (!res.ok) {
                setInvestors(prev => prev.map(inv =>
                    inv.id === investor.id ? { ...inv, isActive: !newStatus } : inv
                ))

                let errorMessage = "Gagal mengubah status aktif"
                try {
                    const errorData = await res.json()
                    errorMessage = errorData.error || errorMessage
                    console.error("API Error:", errorData)
                } catch {
                    console.error("Failed to parse error response. Status:", res.status, res.statusText)
                }
                toast.error(errorMessage)
            } else {
                toast.success(`Investor ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
            }
        } catch (error) {
            setInvestors(prev => prev.map(inv =>
                inv.id === investor.id ? { ...inv, isActive: !newStatus } : inv
            ))
            toast.error("Terjadi kesalahan sistem")
            console.error("Fetch error:", error)
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Data Pemodal</h2>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                    <Button
                        variant="outline"
                        onClick={handleExportAll}
                        disabled={isExportingAll}
                    >
                        <Sheet className="mr-2 h-4 w-4" />
                        {isExportingAll ? 'Mengekspor...' : 'Ekspor Semua (Excel)'}
                    </Button>
                {!isViewer && (
                    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Tambah Pemodal
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingInvestor ? "Edit Pemodal" : "Tambah Pemodal Baru"}
                                </DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nama Lengkap</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="John Doe" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="contactInfo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Kontak (HP/Email)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="08123456789" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="marginPercentage"
                                        render={({ field }) => {
                                            const managerShare = 100 - (Number(field.value) || 0)
                                            return (
                                                <FormItem>
                                                    <FormLabel>Persentase Margin Pemodal (%)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder="50"
                                                            {...field}
                                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                                        />
                                                    </FormControl>
                                                    <div className="text-sm text-muted-foreground mt-1 flex justify-between">
                                                        <span>Pemodal: {field.value || 0}%</span>
                                                        <span className="font-semibold text-blue-600">Pengelola: {managerShare}%</span>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )
                                        }}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="bankAccountDetails"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Info Rekening</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="BCA 1234567890 a.n John Doe" {...field} />
                                                </FormControl>
                                                <FormMessage />
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
                                    <FormField
                                        control={form.control}
                                        name="userId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Hubungkan ke Akun Login</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value || "none"}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Pilih Akun User" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="none">Belum dihubungkan</SelectItem>
                                                        {users.map((user) => (
                                                            <SelectItem key={user.id} value={user.id}>
                                                                {user.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full">
                                        {editingInvestor ? "Update" : "Simpan"}
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                )}
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
                {investors.length === 0 ? (
                    <div className="text-center p-8 border rounded-md text-muted-foreground bg-slate-50">
                        Belum ada data pemodal.
                    </div>
                ) : (
                    investors.map((investor) => {
                        const connectedUser = users.find(u => u.id === investor.userId)
                        const summary = capitalSummaries?.get(investor.id) ?? null
                        return (
                            <div key={investor.id} className="border rounded-lg p-4 space-y-3 bg-white dark:bg-slate-950 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold text-base">{investor.name}</div>
                                        <div className="text-sm text-muted-foreground">{investor.contactInfo || "-"}</div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-sm font-medium ${investor.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {investor.isActive ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                            {!isViewer && (
                                                <Switch
                                                    checked={investor.isActive}
                                                    onCheckedChange={() => handleToggleActive(investor)}
                                                    className="scale-75"
                                                />
                                            )}
                                        </div>
                                        <div className="font-bold text-lg text-emerald-600">
                                            {investor.marginPercentage}%
                                        </div>
                                    </div>
                                </div>

                                <div className="text-sm border-t pt-3 mt-2 grid grid-cols-1 gap-2">
                                    <div>
                                        <span className="block text-xs text-muted-foreground mb-0.5">Info Rekening</span>
                                        <span className="font-medium text-foreground">{investor.bankAccountDetails || "-"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-muted-foreground mb-0.5">Akun Terhubung</span>
                                        {connectedUser ? (
                                            <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded text-xs">
                                                {connectedUser.name}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground italic text-xs">-</span>
                                        )}
                                    </div>
                                </div>

                                {/* Capital Summary - Mobile */}
                                <CapitalSummaryMobile summary={summary} />

                                <div className="flex items-center justify-end gap-2 border-t pt-3 mt-2">
                                    {!isViewer && (
                                        <>
                                            <ManagedCapitalDialog
                                                investor={investor}
                                                currentSummary={summary}
                                                onUpdate={fetchCapitalSummaries}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleEdit(investor)}
                                            >
                                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                            </Button>
                                        </>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1"
                                                disabled={exportingInvestor === investor.id}
                                            >
                                                <Download className="h-3.5 w-3.5 mr-2" />
                                                {exportingInvestor === investor.id ? "Export..." : "Ekspor"}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Format Laporan</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleExportXLSX(investor.id, investor.name)}
                                                disabled={exportingInvestor === investor.id}
                                            >
                                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                <span>Ekspor Excel (XLSX)</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleExportPDF(investor.id, investor.name)}
                                                disabled={exportingInvestor === investor.id}
                                            >
                                                <FileText className="mr-2 h-4 w-4" />
                                                <span>Ekspor PDF</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden rounded-md border lg:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Kontak</TableHead>
                            <TableHead>Margin (%)</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Rekening</TableHead>
                            <TableHead>Terhubung ke Akun</TableHead>
                            <TableHead className="text-right">
                                <span className="inline-flex items-center gap-1">
                                    <CircleDollarSign className="h-3.5 w-3.5" />
                                    Saldo Modal
                                </span>
                            </TableHead>
                            <TableHead className="text-right">
                                <span className="inline-flex items-center gap-1">
                                    <Wallet className="h-3.5 w-3.5" />
                                    Alokasi Aktif
                                </span>
                            </TableHead>
                            <TableHead className="text-right">Sisa Modal</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {investors.map((investor) => {
                            const connectedUser = users.find(u => u.id === investor.userId)
                            const summary = capitalSummaries?.get(investor.id) ?? null
                            return (
                                <TableRow key={investor.id}>
                                    <TableCell className="font-medium">{investor.name}</TableCell>
                                    <TableCell>{investor.contactInfo}</TableCell>
                                    <TableCell>{investor.marginPercentage}%</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {!isViewer ? (
                                                <Switch
                                                    checked={investor.isActive}
                                                    onCheckedChange={() => handleToggleActive(investor)}
                                                />
                                            ) : (
                                                <span className={`text-xs px-2 py-1 rounded-full ${investor.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {investor.isActive ? 'Aktif' : 'Nonaktif'}
                                                </span>
                                            )}
                                            <span className="text-xs text-muted-foreground w-14">
                                                {investor.isActive ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{investor.bankAccountDetails}</TableCell>
                                    <TableCell>
                                        {connectedUser ? (
                                            <span className="text-emerald-600 font-medium">{connectedUser.name}</span>
                                        ) : (
                                            <span className="text-muted-foreground italic text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <CapitalSummaryCell summary={summary} />
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {!isViewer ? (
                                                <>
                                                    <ManagedCapitalDialog
                                                        investor={investor}
                                                        currentSummary={summary}
                                                        onUpdate={fetchCapitalSummaries}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(investor)}
                                                    >
                                                        <Pencil className="h-4 w-4 mr-1" /> Edit
                                                    </Button>
                                                </>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Read-only</span>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={exportingInvestor === investor.id}
                                                    >
                                                        <Download className="h-4 w-4 mr-1" />
                                                        {exportingInvestor === investor.id ? "Exporting..." : "Ekspor"}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Format Laporan</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleExportXLSX(investor.id, investor.name)}
                                                        disabled={exportingInvestor === investor.id}
                                                    >
                                                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                        <span>Ekspor Excel (XLSX)</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleExportPDF(investor.id, investor.name)}
                                                        disabled={exportingInvestor === investor.id}
                                                    >
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        <span>Ekspor PDF</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {investors.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-4">
                                    Belum ada data pemodal.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div >
        </div >
    )
}
