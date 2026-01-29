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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, isPast, isWithinInterval, addDays } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { AdminUnitDetailDialog } from "@/components/units/AdminUnitDetailDialog"
import { compressImage } from "@/lib/image-compression"


const unitSchema = z.object({
    name: z.string().min(1, "Nama unit wajib diisi"),
    plateNumber: z.string().min(1, "Nomor polisi wajib diisi"),
    code: z.string().min(1, "Kode unit wajib diisi"),
    investorId: z.string().min(1, "Pemodal wajib dipilih"),
    status: z.enum(["AVAILABLE", "SOLD", "MAINTENANCE"]).optional(),
    imageUrl: z.string().optional().nullable(),
    taxDueDate: z.date().optional().nullable(),
    vehicleType: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    year: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    stnkImageUrl: z.string().optional().nullable(),
    engineNumber: z.string().optional().nullable(),
    chassisNumber: z.string().optional().nullable(),
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
    taxDueDate?: string | Date | null
    vehicleType?: string | null
    brand?: string | null
    model?: string | null
    year?: string | null
    color?: string | null
    stnkImageUrl?: string | null
    engineNumber?: string | null
    chassisNumber?: string | null
    createdAt?: string
}

interface Investor {
    id: string
    name: string
}

const VEHICLE_TYPES = ["Mobil", "Motor"] as const;

const BRANDS = {
    Mobil: [
        "Toyota", "Honda", "Daihatsu", "Mitsubishi", "Suzuki", "Wuling", "Hyundai", "Nissan", "Mazda", "BMW", "Mercedes-Benz", "Lexus", "Isuzu", "Kia", "Lainnya"
    ],
    Motor: [
        "Yamaha", "Honda", "Suzuki", "Kawasaki", "Vespa", "Piaggio", "BMW", "Ducati", "Harley-Davidson", "KTM", "Royal Enfield", "Lainnya"
    ]
};

const MODELS: Record<string, Record<string, string[]>> = {
    Mobil: {
        Toyota: ["Avanza", "Innova", "Fortuner", "Alphard", "Veloz", "Rush", "Raize", "Agya", "Calya", "Yaris", "Camry"],
        Honda: ["Brio", "HR-V", "BR-V", "CR-V", "Civic", "City", "Mobilio", "Jazz", "WR-V"],
        Daihatsu: ["Xenia", "Terios", "Sigra", "Ayla", "Rocky", "Gran Max", "Luxio"],
        Mitsubishi: ["Xpander", "Xpander Cross", "Pajero Sport", "Triton", "L300"],
        Suzuki: ["Ertiga", "XL7", "Baleno", "Ignis", "Jimny", "S-Presso"],
    },
    Motor: {
        Yamaha: ["NMAX", "XMAX", "Aerox", "Lexi", "Fazzio", "Grand Filano", "Mio", "Vixion", "R15", "R25", "MT-15", "MT-25"],
        Honda: ["Beat", "Vario", "Scoopy", "PCX", "ADV", "Genio", "CBR150R", "CBR250RR", "CRF150L", "CB150R", "Sonic", "Supra X", "Revo"],
        Suzuki: ["Satria F150", "GSX-R150", "Address", "Nex II"],
        Kawasaki: ["Ninja 250", "KLX 150", "W175"],
        Vespa: ["Primavera", "Sprint", "LX", "S"],
    }
};

const COLORS = ["Hitam", "Putih", "Silver", "Abu-abu", "Merah", "Biru", "Cokelat", "Hijau", "Kuning", "Oranye", "Ungu", "Lainnya"];
const YEARS = Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() + 1 - i).toString());

// Helper function to get duplicate information for a unit based on plate number
const getDuplicateInfo = (units: Unit[], currentUnit: Unit) => {
    // Safety check: return no duplicate if plateNumber is  missing
    if (!currentUnit.plateNumber || !currentUnit.plateNumber.trim()) {
        return { isDuplicate: false, purchaseNumber: 1, totalDuplicates: 1 }
    }

    const samePlateUnits = units
        .filter(u => u.plateNumber && u.plateNumber.toLowerCase().trim() === currentUnit.plateNumber.toLowerCase().trim())
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())

    const index = samePlateUnits.findIndex(u => u.id === currentUnit.id)
    const purchaseNumber = index + 1
    const totalDuplicates = samePlateUnits.length

    // Determine if this specific unit instance is a buyback (not the first one)
    const isBuyback = purchaseNumber > 1

    return {
        isDuplicate: totalDuplicates > 1,
        purchaseNumber,
        totalDuplicates,
        isBuyback
    }
}


export default function UnitsPage() {
    const { data: session } = useSession()
    // @ts-ignore
    const isViewer = session?.user?.role === "VIEWER"

    const [units, setUnits] = useState<Unit[]>([])
    const [investors, setInvestors] = useState<Investor[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
    const [viewingUnit, setViewingUnit] = useState<Unit | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [unitImages, setUnitImages] = useState<ImageFileWithDescription[]>([])
    const [stnkImages, setStnkImages] = useState<ImageFileWithDescription[]>([])
    const [isScanningStnk, setIsScanningStnk] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [sortBy, setSortBy, sortOrder, setSortOrder] = usePersistedSort("units-sort", "code", "asc")
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Unit Form State
    const [vehicleType, setVehicleType] = useState<string>("")
    const [brand, setBrand] = useState<string>("")
    const [model, setModel] = useState<string>("")
    const [customModel, setCustomModel] = useState<string>("")
    const [year, setYear] = useState<string>("")
    const [color, setColor] = useState<string>("")
    const [customColor, setCustomColor] = useState<string>("")

    const form = useForm<z.infer<typeof unitSchema>>({
        resolver: zodResolver(unitSchema),
        defaultValues: {
            name: "",
            plateNumber: "",
            code: "",
            investorId: "",
            status: "AVAILABLE",
            taxDueDate: null,
            vehicleType: null,
            brand: null,
            model: null,
            year: null,
            color: null,
            stnkImageUrl: null,
            engineNumber: null,
            chassisNumber: null,
        },
    })

    const selectedInvestorForm = form.watch("investorId")

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

    // Fetch next code based on selected investor
    useEffect(() => {
        if (isOpen && !editingUnit && selectedInvestorForm) {
            fetch(`/api/units/next-code?investorId=${selectedInvestorForm}`)
                .then(res => res.json())
                .then(data => {
                    if (data.code) {
                        form.setValue('code', data.code)
                    }
                })
                .catch(err => console.error("Failed to fetch next unit code", err))
        }
    }, [isOpen, editingUnit, selectedInvestorForm, form])

    useEffect(() => {
        if (editingUnit) {
            form.reset({
                name: editingUnit.name || "",
                plateNumber: editingUnit.plateNumber || "",
                code: editingUnit.code || "",
                investorId: editingUnit.investorId,
                status: editingUnit.status,
                imageUrl: editingUnit.imageUrl,
                taxDueDate: editingUnit.taxDueDate ? new Date(editingUnit.taxDueDate) : null,
                vehicleType: editingUnit.vehicleType,
                brand: editingUnit.brand,
                model: editingUnit.model,
                year: editingUnit.year,
                year: editingUnit.year,
                color: editingUnit.color,
                stnkImageUrl: editingUnit.stnkImageUrl,
                engineNumber: editingUnit.engineNumber,
                chassisNumber: editingUnit.chassisNumber,
            })

            // Populate dropdown states from editingUnit OR parse from name if missing
            let vType = editingUnit.vehicleType || ""
            let vBrand = editingUnit.brand || ""
            let vModel = editingUnit.model || ""
            let vYear = editingUnit.year || ""
            let vColor = editingUnit.color || ""

            // Parsing logic for legacy data
            if (!vBrand && editingUnit.name) {
                const nameLower = editingUnit.name.toLowerCase()

                // 1. Detect Brand & Type
                for (const [type, brands] of Object.entries(BRANDS)) {
                    for (const b of brands) {
                        if (nameLower.includes(b.toLowerCase()) && b !== "Lainnya") {
                            vBrand = b
                            vType = type
                            break
                        }
                    }
                    if (vBrand) break
                }

                // 2. Detect Model (if Brand found)
                if (vType && vBrand) {
                    // @ts-ignore
                    const possibleModels = MODELS[vType]?.[vBrand] || []
                    for (const m of possibleModels) {
                        if (nameLower.includes(m.toLowerCase())) {
                            vModel = m
                            break
                        }
                    }
                }

                // 3. Detect Year
                for (const y of YEARS) {
                    if (new RegExp(`\\b${y}\\b`).test(editingUnit.name)) {
                        vYear = y
                        break
                    }
                }

                // 4. Detect Color
                for (const c of COLORS) {
                    if (c !== "Lainnya" && nameLower.includes(c.toLowerCase())) {
                        vColor = c
                        break
                    }
                }
            }

            setVehicleType(vType)
            setBrand(vBrand)
            setModel(vModel)
            setYear(vYear)
            setColor(vColor)

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

            if (editingUnit.stnkImageUrl) {
                setStnkImages([{
                    id: 'existing-stnk',
                    file: new File([], "existing-stnk"),
                    preview: editingUnit.stnkImageUrl,
                    description: ""
                }])
            } else {
                setStnkImages([])
            }
        } else {
            form.reset({
                name: "",
                plateNumber: "",
                code: "",
                investorId: "",
                status: "AVAILABLE",
                imageUrl: null,
                vehicleType: null,
                brand: null,
                model: null,
                year: null,
                year: null,
                color: null,
                stnkImageUrl: null,
                engineNumber: null,
                chassisNumber: null,
            })
            setUnitImages([])
            setStnkImages([])
            setVehicleType("")
            setBrand("")
            setModel("")
            setCustomModel("")
            setYear("")
            setColor("")
            setCustomColor("")
        }
    }, [editingUnit, form])

    // Update name based on selections
    useEffect(() => {
        if (isOpen) {
            const selectedModelFinal = model === "Lainnya" ? customModel : model;
            const selectedColorFinal = color === "Lainnya" ? customColor : color;

            const parts = [
                brand !== "Lainnya" ? brand : "",
                selectedModelFinal,
                year,
                selectedColorFinal ? `warna ${selectedColorFinal}` : ""
            ].filter(Boolean);

            if (parts.length > 0) {
                const generatedName = parts.join(" ");
                // Set name if we have generated parts. 
                // For editing, we might overwrite existing name, BUT user asked for dropdowns to be easy.
                // So if they touch the dropdowns, it updates the name.
                form.setValue("name", generatedName);

                // Also update form values for structured data
                form.setValue("vehicleType", vehicleType)
                form.setValue("brand", brand)
                form.setValue("model", selectedModelFinal)
                form.setValue("year", year)
                form.setValue("color", selectedColorFinal)
            }
        }
    }, [vehicleType, brand, model, customModel, year, color, customColor, isOpen, form]);

    const handleScanStnk = async () => {
        const file = stnkImages[0]?.file;
        if (!file || file.size === 0) {
            toast.error("Upload foto STNK terlebih dahulu");
            return;
        }

        setIsScanningStnk(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/ai/parse-stnk", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Gagal scan STNK");
            }

            const data = await res.json();

            if (data.plateNumber) form.setValue("plateNumber", data.plateNumber);
            if (data.taxDueDate) form.setValue("taxDueDate", new Date(data.taxDueDate));
            if (data.engineNumber) form.setValue("engineNumber", data.engineNumber);
            if (data.chassisNumber) form.setValue("chassisNumber", data.chassisNumber);
            if (data.color) {
                // Try to match with existing colors
                const matchedColor = COLORS.find(c => c.toLowerCase() === data.color.toLowerCase())
                    || (data.color.length < 20 ? data.color : "Lainnya");
                setColor(matchedColor);
                if (!COLORS.includes(matchedColor)) setCustomColor(data.color);
            }

            // Map Vehicle Type
            if (data.vehicleType && ["Mobil", "Motor"].includes(data.vehicleType)) {
                setVehicleType(data.vehicleType);

                // Map Brand (only if vehicle type is valid)
                if (data.brand) {
                    // @ts-ignore
                    const brandList = BRANDS[data.vehicleType] || [];
                    // Fuzzy match brand
                    const matchedBrand = brandList.find((b: string) => b.toLowerCase() === data.brand.toLowerCase());

                    if (matchedBrand) {
                        setBrand(matchedBrand);

                        // Map Model (only if brand is valid)
                        if (data.model) {
                            // @ts-ignore
                            const modelList = MODELS[data.vehicleType]?.[matchedBrand] || [];
                            const matchedModel = modelList.find((m: string) => m.toLowerCase().includes(data.model.toLowerCase()) || data.model.toLowerCase().includes(m.toLowerCase()));

                            if (matchedModel) {
                                setModel(matchedModel);
                            } else {
                                setModel("Lainnya");
                                setCustomModel(data.model);
                            }
                        }
                    } else {
                        // If brand not found, we can't select it in dropdown easily without "Lainnya" logic for brand (which we don't have in UI yet for Brand)
                        // But if user allows generic "Lainnya"? 
                        // Check constants again: Brands has "Lainnya".
                        setBrand("Lainnya");
                        // If brand is Lainnya, model is free text?
                        // UI for Brand "Lainnya" isn't explicitly shown in my mental model, need to double check if Brand select handles "Lainnya" well.
                        // For now, let's assume if brand not found, we leave it empty or user fills it.
                        // Or try to set it if "Lainnya" exists.
                        if (brandList.includes("Lainnya")) {
                            setBrand("Lainnya");
                        }
                    }
                }
            }

            if (data.year) {
                setYear(data.year.toString());
            }

            toast.success("STNK berhasil discan!");
        } catch (error: any) {
            console.error("Scan error:", error);
            toast.error(error.message || "Gagal scan STNK");
        } finally {
            setIsScanningStnk(false);
        }
    };

    async function onSubmit(values: z.infer<typeof unitSchema>) {
        try {
            const url = editingUnit ? `/api/units/${editingUnit.id}` : '/api/units'
            const method = editingUnit ? 'PUT' : 'POST'

            // Handle image upload
            let imageUrl = values.imageUrl
            let stnkImageUrl = values.stnkImageUrl

            const newImage = unitImages.find(img => img.file && img.file.size > 0)
            if (newImage && newImage.file) {
                let fileToUpload = newImage.file
                // File is already compressed by MultipleImageUpload
                fileToUpload = newImage.file

                const formData = new FormData()
                formData.append('file', fileToUpload)

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

            // Handle STNK Upload
            const newStnkImage = stnkImages.find(img => img.file && img.file.size > 0)
            if (newStnkImage && newStnkImage.file) {
                let fileToUpload = newStnkImage.file
                // File is already compressed by MultipleImageUpload
                fileToUpload = newStnkImage.file

                const formData = new FormData()
                formData.append('file', fileToUpload)

                const uploadRes = await fetch('/api/upload/payment-proof', {
                    method: 'POST',
                    body: formData
                })

                if (!uploadRes.ok) throw new Error("Failed to upload STNK")
                const uploadData = await uploadRes.json()
                stnkImageUrl = uploadData.url
            } else if (stnkImages.length === 0) {
                stnkImageUrl = null
            }

            const payload = { ...values, imageUrl, stnkImageUrl }

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
                const data = await res.json()
                const errorMessage = data.error
                    ? (Array.isArray(data.error) ? data.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') : data.error)
                    : (editingUnit ? "Gagal memperbarui unit" : "Gagal menambahkan unit")

                toast.error(errorMessage)
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

    // ... filtering and sorting logic
    const filteredAndSortedUnits = units.filter(unit => {
        const matchesSearch = (unit.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (unit.plateNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (unit.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (unit.investor?.name || "").toLowerCase().includes(searchQuery.toLowerCase())

        const matchesInvestor = selectedInvestorId === "all" || unit.investorId === selectedInvestorId
        const matchesStatus = statusFilter === "ALL" || unit.status === statusFilter

        return matchesSearch && matchesInvestor && matchesStatus
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
            case "createdAt":
                compareValue = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
                break
            default:
                compareValue = 0
        }

        return sortOrder === "asc" ? compareValue : -compareValue
    })

    // Pagination Logic
    const totalPages = Math.ceil(filteredAndSortedUnits.length / itemsPerPage)
    const paginatedUnits = filteredAndSortedUnits.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // Reset pagination when filters change (handled in useEffect below)

    // ... (unchanged helper functions) ...
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(paginatedUnits.map(u => u.id))
        } else {
            setSelectedIds([])
        }
    }

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, selectedInvestorId])

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

    // Custom Logic for Mobile Sort that mimics Investor Portal
    const handleMobileSort = (value: string) => {
        switch (value) {
            case "NEWEST":
                setSortBy("createdAt") // Ensure createdAt is handled in sort logic
                setSortOrder("desc")
                break
            case "NAME_ASC":
                setSortBy("name")
                setSortOrder("asc")
                break
            case "PLATE_ASC":
                setSortBy("plateNumber")
                setSortOrder("asc")
                break
            case "STATUS":
                setSortBy("status")
                setSortOrder("asc")
                break
            default:
                break
        }
    }

    // Helper to get current composite value
    const getMobileSortValue = () => {
        if (sortBy === "createdAt" && sortOrder === "desc") return "NEWEST"
        if (sortBy === "name" && sortOrder === "asc") return "NAME_ASC"
        if (sortBy === "plateNumber" && sortOrder === "asc") return "PLATE_ASC"
        if (sortBy === "status" && sortOrder === "asc") return "STATUS"
        return "NEWEST"
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Manajemen Unit</h2>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {/* ... (Alert Dialogs & Import Buttons) ... */}
                    {selectedIds.length > 0 && !isViewer && (
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
                    {!isViewer && (
                        <>
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
                                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>{editingUnit ? "Edit Unit" : "Tambah Unit Baru"}</DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                <div>
                                                    <Label>Foto Unit (Opsional)</Label>
                                                    <div className="mt-2">
                                                        <MultipleImageUpload
                                                            initialImages={unitImages}
                                                            onImagesChange={setUnitImages}
                                                            maxImages={1}
                                                            uploadLabel="Upload Foto Unit"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <Label>Foto STNK (Opsional)</Label>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            type="button"
                                                            onClick={handleScanStnk}
                                                            disabled={stnkImages.length === 0 || isScanningStnk}
                                                        >
                                                            {isScanningStnk ? "Scanning..." : "✨ Scan AI"}
                                                        </Button>
                                                    </div>
                                                    <div>
                                                        <MultipleImageUpload
                                                            initialImages={stnkImages}
                                                            onImagesChange={setStnkImages}
                                                            maxImages={1}
                                                            uploadLabel="Upload Foto STNK"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                        *Upload STNK lalu klik "Scan AI" untuk isi otomatis data kendaraan.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-4 border rounded-md p-4 bg-slate-50 dark:bg-slate-900">
                                                {/* ... existing vehicle details fields ... */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Jenis Kendaraan</Label>
                                                        <Select value={vehicleType} onValueChange={(v) => {
                                                            setVehicleType(v);
                                                            if (v !== vehicleType) {
                                                                setBrand("");
                                                                setModel("");
                                                            }
                                                        }}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Pilih Jenis" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {VEHICLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Tahun</Label>
                                                        <Select value={year} onValueChange={setYear}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Pilih Tahun" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Merek</Label>
                                                    <Select value={brand} onValueChange={(v) => {
                                                        setBrand(v);
                                                        if (v !== brand) setModel("");
                                                    }} disabled={!vehicleType}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={vehicleType ? "Pilih Merek" : "Pilih Jenis dulu"} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {vehicleType && BRANDS[vehicleType as keyof typeof BRANDS]?.map(b => (
                                                                <SelectItem key={b} value={b}>{b}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {brand && (
                                                    <div className="space-y-2">
                                                        <Label>Model</Label>
                                                        <Select value={model} onValueChange={setModel}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Pilih Model" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {/* @ts-ignore */}
                                                                {MODELS[vehicleType]?.[brand]?.map(m => (
                                                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                                                ))}
                                                                <SelectItem value="Lainnya">Lainnya / Manual input</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {model === "Lainnya" && (
                                                            <Input
                                                                placeholder="Ketik nama model..."
                                                                value={customModel}
                                                                onChange={e => setCustomModel(e.target.value)}
                                                                className="mt-2"
                                                            />
                                                        )}
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <Label>Warna</Label>
                                                    <Select value={color} onValueChange={setColor}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Pilih Warna" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    {color === "Lainnya" && (
                                                        <Input
                                                            placeholder="Ketik warna..."
                                                            value={customColor}
                                                            onChange={e => setCustomColor(e.target.value)}
                                                            className="mt-2"
                                                        />
                                                    )}
                                                </div>

                                                <div className="mt-4 pt-4 border-t">
                                                    <Label className="text-xs text-muted-foreground">Preview Nama Unit:</Label>
                                                    <div className="text-sm font-medium mt-1">
                                                        {form.watch("name") || "(Lengkapi form di atas)"}
                                                    </div>
                                                    <input type="hidden" {...form.register("name")} />
                                                    <input type="hidden" {...form.register("vehicleType")} />
                                                    <input type="hidden" {...form.register("brand")} />
                                                    <input type="hidden" {...form.register("model")} />
                                                    <input type="hidden" {...form.register("year")} />
                                                    <input type="hidden" {...form.register("color")} />
                                                </div>
                                            </div>

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
                                                                <Input placeholder="UNT-INV-001" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="engineNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>No. Mesin</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Contoh: JM01E..." {...field} value={field.value || ""} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="chassisNumber"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>No. Rangka</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Contoh: MHF..." {...field} value={field.value || ""} />
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

                                            <FormField
                                                control={form.control}
                                                name="taxDueDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>Jatuh Tempo Pajak (Opsional)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="date"
                                                                value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                                                                onChange={(e) => {
                                                                    const dateValue = e.target.value
                                                                    if (dateValue) {
                                                                        field.onChange(new Date(dateValue))
                                                                    } else {
                                                                        field.onChange(null)
                                                                    }
                                                                }}
                                                                className="w-full"
                                                                min="2000-01-01"
                                                                max={`${new Date().getFullYear() + 10}-12-31`}
                                                            />
                                                        </FormControl>
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
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1">
                    <Input
                        placeholder="Cari unit..."
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
                                <SelectItem value="AVAILABLE">Available</SelectItem>
                                <SelectItem value="SOLD">Sold</SelectItem>
                                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
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
                                    <SelectItem value="NAME_ASC">Nama (A-Z)</SelectItem>
                                    <SelectItem value="PLATE_ASC">Plat Nomor</SelectItem>
                                    <SelectItem value="STATUS">Status</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

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

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {paginatedUnits.length === 0 ? (
                    <div className="text-center p-8 border rounded-md text-muted-foreground bg-slate-50">
                        {searchQuery ? "Tidak ada unit yang cocok." : "Belum ada data unit."}
                    </div>
                ) : (
                    paginatedUnits.map((unit) => (
                        <div key={unit.id} className="border rounded-lg p-4 space-y-3 bg-white dark:bg-slate-950 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    {unit.imageUrl ? (
                                        <ImageHoverPreview
                                            src={unit.imageUrl}
                                            alt={unit.name}
                                            previewSize="lg"
                                            className="h-16 w-16 rounded-md overflow-hidden border border-slate-200 flex-shrink-0 relative group"
                                        >
                                            <img
                                                src={unit.imageUrl}
                                                alt={unit.name}
                                                className="h-full w-full object-cover transition-transform group-hover:scale-105 cursor-pointer"
                                                onClick={() => unit.imageUrl && setPreviewUrl(unit.imageUrl)}
                                            />
                                        </ImageHoverPreview>
                                    ) : (
                                        <div
                                            className="h-16 w-16 rounded-md overflow-hidden border border-slate-200 cursor-pointer flex-shrink-0 relative group"
                                        >
                                            <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <span className="text-[10px]">No Img</span>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">{unit.code}</span>
                                            <Badge variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'} className="text-[10px] py-0 h-5">
                                                {unit.status}
                                            </Badge>
                                        </div>
                                        <div className="font-semibold text-base mt-1">{unit.name}</div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>{unit.plateNumber}</span>
                                            {(() => {
                                                const duplicateInfo = getDuplicateInfo(units, unit)
                                                return duplicateInfo.isBuyback ? (
                                                    <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-300 py-0 h-4">
                                                        🔄 Buyback (Ke-{duplicateInfo.purchaseNumber})
                                                    </Badge>
                                                ) : null
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t text-sm">
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Pemilik</span>
                                    <span className="font-medium">{unit.investor.name}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Jatuh Tempo Pajak</span>
                                    {unit.taxDueDate ? (
                                        <span className={cn(
                                            "font-medium",
                                            isPast(new Date(unit.taxDueDate)) ? "text-red-600" :
                                                isWithinInterval(new Date(unit.taxDueDate), {
                                                    start: new Date(),
                                                    end: addDays(new Date(), 30)
                                                }) ? "text-amber-600" : "text-green-600"
                                        )}>
                                            {format(new Date(unit.taxDueDate), "dd MMM yyyy")}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground italic">-</span>
                                    )}
                                </div>
                            </div>

                            {!isViewer && (
                                <div className="flex justify-end pt-2 border-t mt-3">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-9">
                                                <MoreHorizontal className="h-4 w-4 mr-2" />
                                                Aksi
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setEditingUnit(unit)
                                                    setIsOpen(true)
                                                }}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" /> Edit Unit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => setDeleteId(unit.id)}
                                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                            >
                                                <Trash className="mr-2 h-4 w-4" /> Hapus
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
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
                                    checked={paginatedUnits.length > 0 && selectedIds.length === paginatedUnits.length}
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
                            <TableHead>Pajak</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedUnits.map((unit) => (
                            <TableRow
                                key={unit.id}
                                className="cursor-pointer hover:bg-slate-50"
                                onClick={(e) => {
                                    // Prevent click if clicking checkbox or action buttons
                                    if (
                                        (e.target as HTMLElement).closest("input[type='checkbox']") ||
                                        (e.target as HTMLElement).closest("button") ||
                                        (e.target as HTMLElement).closest(".prevent-row-click")
                                    ) {
                                        return
                                    }
                                    setViewingUnit(unit)
                                }}
                            >
                                <TableCell>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                                        checked={selectedIds.includes(unit.id)}
                                        onChange={(e) => handleSelectOne(unit.id, e.target.checked)}
                                        disabled={isViewer}
                                    />
                                </TableCell>
                                <TableCell>
                                    {unit.imageUrl ? (
                                        <ImageHoverPreview
                                            src={unit.imageUrl}
                                            alt={unit.name}
                                            previewSize="lg"
                                            className="h-10 w-10 rounded-md overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity"
                                        >
                                            <img
                                                src={unit.imageUrl}
                                                alt={unit.name}
                                                className="h-full w-full object-cover cursor-pointer"
                                                onClick={() => unit.imageUrl && setPreviewUrl(unit.imageUrl)}
                                            />
                                        </ImageHoverPreview>
                                    ) : (
                                        <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                                            <span className="text-xs">No Img</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{unit.code}</TableCell>
                                <TableCell>{unit.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span>{unit.plateNumber}</span>
                                        {(() => {
                                            const duplicateInfo = getDuplicateInfo(units, unit)
                                            return duplicateInfo.isBuyback ? (
                                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300">
                                                    🔄 Buyback (Ke-{duplicateInfo.purchaseNumber})
                                                </Badge>
                                            ) : null
                                        })()}
                                    </div>
                                </TableCell>
                                <TableCell>{unit.investor.name}</TableCell>
                                <TableCell>
                                    <Badge variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'} className="rounded-sm">
                                        {unit.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {unit.taxDueDate ? (
                                        <span className={cn(
                                            "font-medium",
                                            isPast(new Date(unit.taxDueDate)) ? "text-red-600" :
                                                isWithinInterval(new Date(unit.taxDueDate), {
                                                    start: new Date(),
                                                    end: addDays(new Date(), 30)
                                                }) ? "text-amber-600" : "text-green-600"
                                        )}>
                                            {format(new Date(unit.taxDueDate), "dd MMM yyyy")}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground italic">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {!isViewer && (
                                        <div className="flex justify-end items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => {
                                                    setEditingUnit(unit)
                                                    setIsOpen(true)
                                                }}
                                                title="Edit Unit"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Open menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setEditingUnit(unit)
                                                            setIsOpen(true)
                                                        }}
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit Unit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => setDeleteId(unit.id)}
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    >
                                                        <Trash className="mr-2 h-4 w-4" /> Hapus
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

            <ImagePreviewDialog
                open={!!previewUrl}
                onOpenChange={(open) => !open && setPreviewUrl(null)}
                imageUrl={previewUrl || ""}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apakah anda yakin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Data unit ini akan dihapus permanen dari sistem.
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
            <AdminUnitDetailDialog
                open={!!viewingUnit}
                onOpenChange={(open) => !open && setViewingUnit(null)}
                unit={viewingUnit}
            />
        </div>
    )
}
