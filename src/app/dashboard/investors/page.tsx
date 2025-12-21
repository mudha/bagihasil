"use client"

import { useEffect, useState } from "react"
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Plus, Pencil, Download, FileText, FileSpreadsheet } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { exportInvestorReportXLSX, exportInvestorReportPDF } from "@/lib/export-utils"

const investorSchema = z.object({
    name: z.string().min(1, "Nama wajib diisi"),
    contactInfo: z.string().optional(),
    bankAccountDetails: z.string().optional(),
    notes: z.string().optional(),
    marginPercentage: z.coerce.number().default(50),
})

interface Investor {
    id: string
    name: string
    contactInfo: string
    bankAccountDetails: string
    notes: string
    marginPercentage: number
}

export default function InvestorsPage() {
    const [investors, setInvestors] = useState<Investor[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)
    const [exportingInvestor, setExportingInvestor] = useState<string | null>(null)

    const form = useForm<z.infer<typeof investorSchema>>({
        resolver: zodResolver(investorSchema),
        defaultValues: {
            name: "",
            contactInfo: "",
            bankAccountDetails: "",
            notes: "",
            marginPercentage: 50,
        },
    })

    const fetchInvestors = async () => {
        const res = await fetch('/api/investors')
        const data = await res.json()
        setInvestors(data)
    }

    useEffect(() => {
        fetchInvestors()
    }, [])

    useEffect(() => {
        if (editingInvestor) {
            form.reset({
                name: editingInvestor.name,
                contactInfo: editingInvestor.contactInfo || "",
                bankAccountDetails: editingInvestor.bankAccountDetails || "",
                notes: editingInvestor.notes || "",
                marginPercentage: editingInvestor.marginPercentage || 50,
            })
        } else {
            form.reset({
                name: "",
                contactInfo: "",
                bankAccountDetails: "",
                notes: "",
                marginPercentage: 50,
            })
        }
    }, [editingInvestor, form])

    async function onSubmit(values: z.infer<typeof investorSchema>) {
        try {
            if (editingInvestor) {
                // Update existing investor
                const res = await fetch(`/api/investors/${editingInvestor.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values),
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
                // Create new investor
                const res = await fetch('/api/investors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values),
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
        } catch (error) {
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
        setExportingInvestor(investorId)
        toast.loading(`Mengekspor laporan Excel untuk ${investorName}...`)

        const result = await exportInvestorReportXLSX(investorId, investorName)

        toast.dismiss()
        if (result.success) {
            toast.success("Laporan Excel berhasil diunduh!")
        } else {
            toast.error(result.error || "Gagal mengekspor laporan Excel")
        }
        setExportingInvestor(null)
    }

    const handleExportPDF = async (investorId: string, investorName: string) => {
        setExportingInvestor(investorId)
        toast.loading(`Mengekspor laporan PDF untuk ${investorName}...`)

        const result = await exportInvestorReportPDF(investorId, investorName)

        toast.dismiss()
        if (result.success) {
            toast.success("Laporan PDF berhasil diunduh!")
        } else {
            toast.error(result.error || "Gagal mengekspor laporan PDF")
        }
        setExportingInvestor(null)
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Data Pemodal</h2>
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
                                <Button type="submit" className="w-full">
                                    {editingInvestor ? "Update" : "Simpan"}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Kontak</TableHead>
                            <TableHead>Margin (%)</TableHead>
                            <TableHead>Rekening</TableHead>
                            <TableHead>Catatan</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {investors.map((investor) => (
                            <TableRow key={investor.id}>
                                <TableCell className="font-medium">{investor.name}</TableCell>
                                <TableCell>{investor.contactInfo}</TableCell>
                                <TableCell>{investor.marginPercentage}%</TableCell>
                                <TableCell>{investor.bankAccountDetails}</TableCell>
                                <TableCell>{investor.notes}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(investor)}
                                        >
                                            <Pencil className="h-4 w-4 mr-2" /> Edit
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={exportingInvestor === investor.id}
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
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
                        ))}
                        {investors.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">
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
