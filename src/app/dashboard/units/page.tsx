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
import { MultipleImageUpload, ImageFileWithDescription } from "@/components/ui/multi-image-upload"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, MoreHorizontal, Pencil, Trash, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { ImportUnitsDialog } from "@/components/import/ImportUnitsDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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

const unitSchema = z.object({
    name: z.string().min(1, "Nama unit wajib diisi"),
    plateNumber: z.string().min(1, "Nomor polisi wajib diisi"),
    code: z.string().min(1, "Kode unit wajib diisi"),
    investorId: z.string().min(1, "Pemodal wajib dipilih"),
    status: z.enum(["AVAILABLE", "SOLD", "MAINTENANCE"]).optional(),
    imageUrl: z.string().optional().nullable(),
})

interface Unit {
    id: string
    name: string
    plateNumber: string
    code: string
    status: "AVAILABLE" | "SOLD" | "MAINTENANCE"
    investorId: string
    investor: {
        name: string
    }
    imageUrl?: string | null
}

interface Investor {
    id: string
    name: string
}

export default function UnitsPage() {
    const [units, setUnits] = useState<Unit[]>([])
    const [investors, setInvestors] = useState<Investor[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [unitImages, setUnitImages] = useState<ImageFileWithDescription[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [sortBy, setSortBy] = useState<string>("code")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

    const form = useForm<z.infer<typeof unitSchema>>({
        resolver: zodResolver(unitSchema),
        defaultValues: {
            name: "",
            plateNumber: "",
            code: "",
            investorId: "",
            status: "AVAILABLE",
        },
    })

    const fetchUnits = async () => {
        const res = await fetch('/api/units')
        const data = await res.json()
        setUnits(data)
    }

    const fetchInvestors = async () => {
        const res = await fetch('/api/investors')
        const data = await res.json()
        setInvestors(data)
    }

    useEffect(() => {
        fetchUnits()
        fetchInvestors()
    }, [])

    useEffect(() => {
        if (isOpen && !editingUnit) {
            fetch('/api/units/next-code')
                .then(res => res.json())
                .then(data => {
                    if (data.code) {
                        form.setValue('code', data.code)
                    }
                })
                .catch(err => console.error("Failed to fetch next unit code", err))
        }
    }, [isOpen, editingUnit, form])

    useEffect(() => {
        if (editingUnit) {
            form.reset({
                name: editingUnit.name,
                plateNumber: editingUnit.plateNumber,
                code: editingUnit.code,
                investorId: editingUnit.investorId,
                status: editingUnit.status,
                imageUrl: editingUnit.imageUrl,
            })
            if (editingUnit.imageUrl) {
                setUnitImages([{
                    id: 'existing',
                    file: new File([], "existing"),
                    preview: editingUnit.imageUrl,
                    description: ""
                }])
            } else {
                setUnitImages([])
            }
        } else {
            form.reset({
                name: "",
                plateNumber: "",
                code: "",
                investorId: "",
                status: "AVAILABLE",
                imageUrl: null
            })
            setUnitImages([])
        }
    }, [editingUnit, form])

    async function onSubmit(values: z.infer<typeof unitSchema>) {
        try {
            const url = editingUnit ? `/api/units/${editingUnit.id}` : '/api/units'
            const method = editingUnit ? 'PUT' : 'POST'

            // Handle image upload
            let imageUrl = values.imageUrl

            const newImage = unitImages.find(img => img.file && img.file.size > 0)
            if (newImage && newImage.file) {
                const formData = new FormData()
                formData.append('file', newImage.file)

                const uploadRes = await fetch('/api/upload/payment-proof', {
                    method: 'POST',
                    body: formData
                })

                if (!uploadRes.ok) throw new Error("Failed to upload image")
                const uploadData = await uploadRes.json()
                imageUrl = uploadData.url
            } else if (unitImages.length === 0) {
                imageUrl = null
            }

            const payload = { ...values, imageUrl }

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                toast.success(editingUnit ? "Unit berhasil diperbarui" : "Unit berhasil ditambahkan")
                setIsOpen(false)
                setEditingUnit(null)
                fetchUnits()
            } else {
                toast.error(editingUnit ? "Gagal memperbarui unit" : "Gagal menambahkan unit")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    async function handleDelete() {
        if (!deleteId) return

        try {
            const res = await fetch(`/api/units/${deleteId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                toast.success("Unit berhasil dihapus")
                fetchUnits()
            } else {
                toast.error("Gagal menghapus unit")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        } finally {
            setDeleteId(null)
        }
    }

    const filteredUnits = units.filter(unit => {
        const matchesSearch = (unit.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (unit.plateNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (unit.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (unit.investor?.name || "").toLowerCase().includes(searchQuery.toLowerCase())

        const matchesInvestor = selectedInvestorId === "all" || unit.investorId === selectedInvestorId

        return matchesSearch && matchesInvestor
    }).sort((a, b) => {
        let compareValue = 0

        switch (sortBy) {
            case "code":
                compareValue = a.code.localeCompare(b.code)
                break
            case "name":
                compareValue = a.name.localeCompare(b.name)
                break
            case "plateNumber":
                compareValue = a.plateNumber.localeCompare(b.plateNumber)
                break
            case "investor":
                compareValue = a.investor.name.localeCompare(b.investor.name)
                break
            case "status":
                compareValue = a.status.localeCompare(b.status)
                break
            default:
                compareValue = 0
        }

        return sortOrder === "asc" ? compareValue : -compareValue
    })

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredUnits.map(u => u.id))
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
            const res = await fetch('/api/units', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            })

            if (res.ok) {
                toast.success(`${selectedIds.length} unit berhasil dihapus`)
                setSelectedIds([])
                fetchUnits()
            } else {
                toast.error("Gagal menghapus unit")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        }
    }

    // ... existing onSubmit ...

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Manajemen Unit</h2>
                <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash className="mr-2 h-4 w-4" /> Hapus ({selectedIds.length})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus {selectedIds.length} Unit?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tindakan ini tidak dapat dibatalkan. Data unit yang dipilih akan dihapus permanen.
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
                    )}
                    <ImportUnitsDialog onImportSuccess={fetchUnits} />
                    <Dialog open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open)
                        if (!open) setEditingUnit(null)
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Tambah Unit
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingUnit ? "Edit Unit" : "Tambah Unit Baru"}</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                    <div className="mb-4">
                                        <Label>Foto Unit (Opsional)</Label>
                                        <div className="mt-2">
                                            <MultipleImageUpload
                                                initialImages={unitImages}
                                                onImagesChange={setUnitImages}
                                                maxImages={1}
                                            />
                                        </div>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nama Unit</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Toyota Avanza 2020" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="plateNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>No. Polisi</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="B 1234 ABC" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="code"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Kode Unit</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="UNT-001" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="investorId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Pemilik Modal</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Pilih Pemodal" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {investors.map((investor) => (
                                                            <SelectItem key={investor.id} value={investor.id}>
                                                                {investor.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {editingUnit && (
                                        <FormField
                                            control={form.control}
                                            name="status"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Status</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Pilih Status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="AVAILABLE">Available</SelectItem>
                                                            <SelectItem value="SOLD">Sold</SelectItem>
                                                            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    <Button type="submit" className="w-full">{editingUnit ? "Simpan Perubahan" : "Simpan"}</Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center justify-between py-4">
                <Input
                    placeholder="Cari unit..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="max-w-sm"
                />
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

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={filteredUnits.length > 0 && selectedIds.length === filteredUnits.length}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                            </TableHead>
                            <TableHead className="w-[80px]">Foto</TableHead>

                            <TableHead>
                                <Button
                                    variant="ghost"
                                    className="p-0 hover:bg-transparent font-semibold"
                                    onClick={() => {
                                        if (sortBy === "code") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("code")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Kode
                                    {sortBy === "code" ? (
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
                                        if (sortBy === "name") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("name")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Nama Unit
                                    {sortBy === "name" ? (
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
                                        if (sortBy === "plateNumber") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("plateNumber")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    No. Polisi
                                    {sortBy === "plateNumber" ? (
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
                                    Pemilik
                                    {sortBy === "investor" ? (
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
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUnits.map((unit) => (
                            <TableRow key={unit.id}>
                                <TableCell>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={selectedIds.includes(unit.id)}
                                        onChange={(e) => handleSelectOne(unit.id, e.target.checked)}
                                    />
                                </TableCell>
                                <TableCell>
                                    {unit.imageUrl ? (
                                        <div
                                            className="h-10 w-10 rounded-md overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => unit.imageUrl && window.open(unit.imageUrl, '_blank')}
                                        >
                                            <img
                                                src={unit.imageUrl}
                                                alt={unit.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                                            <span className="text-xs">No Img</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{unit.code}</TableCell>
                                <TableCell>{unit.name}</TableCell>
                                <TableCell>{unit.plateNumber}</TableCell>
                                <TableCell>{unit.investor.name}</TableCell>
                                <TableCell>
                                    <Badge variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'}>
                                        {unit.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingUnit(unit)
                                                setIsOpen(true)
                                            }}
                                        >
                                            <Pencil className="h-4 w-4 mr-2" /> Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteId(unit.id)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash className="h-4 w-4 mr-2" /> Hapus
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredUnits.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-4">
                                    {searchQuery ? "Tidak ada unit yang cocok." : "Belum ada data unit."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apakah anda yakin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Data unit akan dihapus permanen dari sistem.
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
        </div>
    )
}
