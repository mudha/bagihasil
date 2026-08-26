"use client"

import { Suspense } from "react"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
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
import { Plus, MoreHorizontal, Eye, Pencil, Trash, ArrowUp, ArrowDown, ArrowUpDown, Car, CheckCircle2, Wrench, Sparkles } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { getInvestorInitials } from "@/lib/investor-initials"
import { getInvestorTone } from "@/lib/investor-tone"
import { ImportUnitsDialog } from "@/components/import/ImportUnitsDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format, isPast, isWithinInterval, addDays, differenceInCalendarMonths, differenceInDays } from "date-fns"
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
    type: z.string().optional().nullable(),
    year: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    kilometer: z.number().optional().nullable(),
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
        isActive?: boolean
    }
    imageUrl?: string | null
    taxDueDate?: string | Date | null
    vehicleType?: string | null
    brand?: string | null
    model?: string | null
    type?: string | null
    year?: string | null
    color?: string | null
    kilometer?: number | null
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

// Helper function to get tax status with months difference
// Helper function to get tax status with months difference
const getTaxStatus = (dateInput: Date | string) => {
    const taxDate = new Date(dateInput)
    const now = new Date()
    // Reset time components for accurate date comparisons
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDate = new Date(taxDate.getFullYear(), taxDate.getMonth(), taxDate.getDate())

    // differenceInCalendarMonths(dateLeft, dateRight) -> months
    // If targetDate < today, diff is negative. e.g. target(Jan) - today(Feb) = -1
    const monthsDiff = differenceInCalendarMonths(targetDate, today)

    // Helper to format months as "X tahun Y bulan"
    const formatMonths = (totalMonths: number) => {
        const years = Math.floor(totalMonths / 12)
        const months = totalMonths % 12

        if (years === 0) {
            return `${months} bulan`
        } else if (months === 0) {
            return `${years} tahun`
        } else {
            return `${years} tahun ${months} bulan`
        }
    }

    if (monthsDiff < 0) {
        // Overdue status (Target date is in a past month relative to today)
        const monthsOverdue = Math.abs(monthsDiff)
        return {
            text: `Mati ${formatMonths(monthsOverdue)}`,
            color: "text-red-600"
        }
    } else if (monthsDiff === 0) {
        // Same month
        const daysDiff = differenceInDays(targetDate, today)

        if (daysDiff < 0) {
            // Overdue by days in the same month
            const daysOverdue = Math.abs(daysDiff)
            return {
                text: `Mati kelewat ${daysOverdue} hari`,
                color: "text-red-600"
            }
        } else if (daysDiff === 0) {
            return {
                text: "Hari ini jatuh tempo",
                color: "text-amber-600"
            }
        } else {
            // Future in same month
            return {
                text: `Kurang ${daysDiff} hari lagi`,
                color: "text-amber-600"
            }
        }
    } else if (monthsDiff <= 3) {
        return {
            text: `Kurang ${monthsDiff} bulan lagi`,
            color: "text-amber-600"
        }
    } else {
        return {
            text: `Kurang ${formatMonths(monthsDiff)} lagi`,
            color: "text-green-600"
        }
    }
}


function UnitsPageContent() {
    const { data: session } = useSession()
    const searchParams = useSearchParams()
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

    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [selectedInvestorId, setSelectedInvestorId] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [investorStatusFilter, setInvestorStatusFilter] = useState("active")

    // Retrieve unique existing types for autocomplete suggestions
    const existingTypes = Array.from(new Set(units.map(u => u.type).filter(Boolean))) as string[]

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
    // Gunakan key baru agar preferensi lama "kode terlama" di perangkat mobile
    // tidak menimpa urutan awal terbaru berdasarkan tanggal unit dibuat.
    const [sortBy, setSortBy, sortOrder, setSortOrder] = usePersistedSort("units-sort-v2", "createdAt", "desc")
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
            type: null,
            year: null,
            color: null,
            kilometer: null,
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
                type: editingUnit.type,
                year: editingUnit.year,
                color: editingUnit.color,
                kilometer: editingUnit.kilometer,
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
                type: null,
                year: null,
                color: null,
                kilometer: null,
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

    const typeValue = form.watch("type");

    // Update name based on selections
    useEffect(() => {
        if (isOpen) {
            const selectedModelFinal = model === "Lainnya" ? customModel : model;
            const selectedColorFinal = color === "Lainnya" ? customColor : color;

            const parts = [
                brand !== "Lainnya" ? brand : "",
                selectedModelFinal,
                typeValue,
                year,
                selectedColorFinal ? `warna ${selectedColorFinal}` : ""
            ].filter(Boolean);

            if (parts.length > 0) {
                const generatedName = parts.join(" ").replace(/\s+/g, ' ').trim();
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
    }, [vehicleType, brand, model, customModel, typeValue, year, color, customColor, isOpen, form]);

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

            console.log("[STNK Scan] API Response:", data);

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

                // Use setTimeout to ensure vehicleType state has propagated
                setTimeout(() => {

                    // @ts-expect-error -- legacy vehicle and investor types intentionally lag validated runtime data.
                    const brandList = BRANDS[data.vehicleType] || [];

                    // Map Brand (only if vehicle type is valid)
                    if (data.brand) {
                        console.log("[STNK Scan] Brand matching:", {
                            vehicleType: data.vehicleType,
                            apiBrand: data.brand,
                            brandList
                        });

                        // 1. Try exact match first (case-insensitive)
                        let matchedBrand = brandList.find((b: string) => b.toLowerCase() === data.brand.toLowerCase());

                        // 2. If no exact match, try fuzzy match
                        if (!matchedBrand) {
                            matchedBrand = brandList.find((b: string) => data.brand.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(data.brand.toLowerCase()));
                        }

                        console.log("[STNK Scan] Brand match result:", { matchedBrand });

                        if (matchedBrand) {
                            setBrand(matchedBrand);
                            console.log("[STNK Scan] setBrand called with:", matchedBrand);

                            // Use another setTimeout for model to ensure brand state propagates
                            setTimeout(() => {

                                // Map Model
                                if (data.model) {
                                    const modelList = MODELS[data.vehicleType]?.[matchedBrand] || [];
                                    console.log("[STNK Scan] Model matching:", {
                                        vehicleType: data.vehicleType,
                                        brand: matchedBrand,
                                        apiModel: data.model,
                                        modelList
                                    });

                                    // 1. Try exact match first
                                    let matchedModel = modelList.find((m: string) => m.toLowerCase() === data.model.toLowerCase());

                                    // 2. If no exact match, match by inclusion
                                    if (!matchedModel) {
                                        matchedModel = modelList.find((m: string) => m.toLowerCase().includes(data.model.toLowerCase()) || data.model.toLowerCase().includes(m.toLowerCase()));
                                    }

                                    console.log("[STNK Scan] Model match result:", { matchedModel });

                                    if (matchedModel) {
                                        setModel(matchedModel);
                                        console.log("[STNK Scan] setModel called with:", matchedModel);
                                    } else {
                                        setModel("Lainnya");
                                        setCustomModel(data.model);
                                    }
                                }
                            }, 50); // 50ms delay for model
                        }
                    } else {
                        console.log("[STNK Scan] Brand not matched, setting to Lainnya");
                        // If brand not found, defaulting to Lainnya
                        if (brandList.includes("Lainnya")) {
                            setBrand("Lainnya");
                        }
                    }
                }, 50); // 50ms delay for brand
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

                if (!uploadRes.ok) {
                    let errMsg = "Failed to upload image";
                    try {
                        const errData = await uploadRes.json();
                        errMsg = errData.error || errMsg;
                    } catch { }
                    throw new Error(errMsg);
                }
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

                if (!uploadRes.ok) {
                    let errMsg = "Failed to upload STNK";
                    try {
                        const errData = await uploadRes.json();
                        errMsg = errData.error || errMsg;
                    } catch { }
                    throw new Error(errMsg);
                }
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

                // Reset form and clear all state
                form.reset({
                    name: "",
                    plateNumber: "",
                    code: "",
                    investorId: "",
                    status: "AVAILABLE",
                    imageUrl: null,
                    taxDueDate: null,
                    vehicleType: null,
                    brand: null,
                    model: null,
                    type: null,
                    year: null,
                    color: null,
                    kilometer: null,
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

                setIsOpen(false)
                setEditingUnit(null)
                setViewingUnit(null)
                fetchUnits()
            } else {
                const data = await res.json()
                const errorMessage = data.error
                    ? (Array.isArray(data.error) ? data.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') : data.error)
                    : (editingUnit ? "Gagal memperbarui unit" : "Gagal menambahkan unit")

                toast.error(errorMessage)
            }
        } catch (error: any) {
            console.error("Submit error details:", error)
            toast.error(error.message || String(error) || "Terjadi kesalahan")
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
        } catch {
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

        // Investor Status Filter (handled client-side for now since we fetch all units)
        // Note: unit.investor might be missing in some cases if not joined correctly? 
        // Logic: if filter is active, check specific criteria.
        // Assuming unit object has investor details. The API returns include: { investor: true }
        // But investor object in UI might not have isActive field unless we update Unit interface or API response
        // Wait, the API returns what prisma returns. If we included investor, does it include isActive?
        // Yes, if we didn't select specific fields.
        // Let's verify Unit interface. It has investor: { name: string }. We need to extend it or cast it.
        // Actually, to be safe, let's look at getDuplicateInfo usage or fetching.
        // We fetch /api/units. Check API route. It includes investor: true. So it should have all fields.
        // I will trust that unit.investor has isActive.

        let matchesInvestorStatus = true
        if (investorStatusFilter === 'active') {
            matchesInvestorStatus = unit.investor?.isActive !== false // Default true
        } else if (investorStatusFilter === 'inactive') {
            matchesInvestorStatus = unit.investor?.isActive === false
        }

        return matchesSearch && matchesInvestor && matchesStatus && matchesInvestorStatus
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
        } catch {
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

    const unitSummary = {
        total: filteredAndSortedUnits.length,
        available: filteredAndSortedUnits.filter(unit => unit.status === "AVAILABLE").length,
        sold: filteredAndSortedUnits.filter(unit => unit.status === "SOLD").length,
        maintenance: filteredAndSortedUnits.filter(unit => unit.status === "MAINTENANCE").length,
    }

    return (
        <div className="space-y-5 lg:space-y-7">
            <section className="relative overflow-hidden rounded-lg bg-[#073f3b] text-white shadow-2xl shadow-teal-950/15">
                <div className="absolute -right-20 -top-24 size-72 rounded-full bg-teal-300/20 blur-3xl" />
                <div className="absolute -bottom-24 left-8 size-56 rounded-full bg-lime-300/20 blur-3xl" />
                <div className="relative flex min-w-0 flex-col gap-5 p-5 sm:p-6 2xl:flex-row 2xl:items-end 2xl:justify-between 2xl:p-8">
                    <div className="min-w-0 max-w-2xl space-y-3">
                        <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/15">
                            <Sparkles className="size-3" />
                            Garage view
                        </Badge>
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-100/75">Manajemen Unit</p>
                            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                                Semua kendaraan, lebih gampang dipantau.
                            </h1>
                        </div>
                        <p className="text-sm leading-6 text-teal-50/75 sm:text-base">
                            Kelola stok aktif, unit terjual, pajak, foto kendaraan, dan data STNK dari satu tampilan yang lebih ringan.
                        </p>
                    </div>
                    <div className="grid min-w-0 w-full grid-cols-2 gap-3 sm:grid-cols-4 2xl:min-w-[520px] 2xl:w-auto">
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <Car className="mb-3 size-5 text-lime-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Total</p>
                                <p className="mt-1 text-2xl font-black">{unitSummary.total}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <CheckCircle2 className="mb-3 size-5 text-lime-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Aktif</p>
                                <p className="mt-1 text-2xl font-black">{unitSummary.available}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <Car className="mb-3 size-5 text-sky-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Terjual</p>
                                <p className="mt-1 text-2xl font-black">{unitSummary.sold}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-lg border-white/10 bg-white/10 py-0 text-white shadow-none backdrop-blur">
                            <CardContent className="p-4">
                                <Wrench className="mb-3 size-5 text-amber-200" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/65">Servis</p>
                                <p className="mt-1 text-2xl font-black">{unitSummary.maintenance}</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {!isViewer && (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-teal-900/10 bg-white/85 p-3 shadow-sm backdrop-blur [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:w-full lg:flex lg:justify-end lg:[&_[data-slot=button]]:w-auto">
                    {selectedIds.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="col-span-2 min-h-[44px]">
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
                                if (!open) {
                                    setEditingUnit(null)
                                    setViewingUnit(null)
                                }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-lg bg-teal-600 px-3 font-black shadow-lg shadow-teal-600/20 hover:bg-teal-700 sm:px-4">
                                <Plus className="mr-1.5 h-4 w-4 sm:mr-2" /> Tambah Unit
                            </Button>
                        </DialogTrigger>
                                <DialogContent className="grid h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 border-teal-900/10 p-0 shadow-2xl shadow-slate-950/20 sm:h-[92dvh] sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:rounded-2xl sm:border">
                                    <DialogHeader className="bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-16 text-left text-white sm:px-7 sm:py-5 sm:pr-20">
                                        <div className="w-fit rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-teal-100">
                                            {editingUnit ? "Mode edit" : "Unit baru"}
                                        </div>
                                        <DialogTitle className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{editingUnit ? "Edit Unit" : "Tambah Unit Baru"}</DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-col overflow-hidden">
                                            <div className="touch-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 pb-6 [&_[data-slot=input]]:h-11 [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full sm:p-6 sm:pb-8">

                                            <section className="space-y-4">
                                                <div>
                                                    <h3 className="text-sm font-black text-teal-950">Foto kendaraan</h3>
                                                    <p className="mt-1 text-xs text-muted-foreground">Opsional. Foto dapat dipilih langsung dari galeri HP.</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                                        <MultipleImageUpload
                                                            initialImages={unitImages}
                                                            onImagesChange={setUnitImages}
                                                            maxImages={1}
                                                            uploadLabel="Upload Foto Unit"
                                                        />
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-xs font-medium text-muted-foreground">Baca data STNK otomatis</span>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            type="button"
                                                            onClick={handleScanStnk}
                                                            disabled={stnkImages.length === 0 || isScanningStnk}
                                                            className="h-9 shrink-0"
                                                        >
                                                            {isScanningStnk ? "Scanning..." : "✨ Scan AI"}
                                                        </Button>
                                                    </div>
                                                        <MultipleImageUpload
                                                            initialImages={stnkImages}
                                                            onImagesChange={setStnkImages}
                                                            maxImages={1}
                                                            uploadLabel="Upload Foto STNK"
                                                        />
                                                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                                            Upload STNK, lalu tekan “Scan AI” untuk mengisi data kendaraan otomatis.
                                                        </p>
                                                    </div>
                                                </div>
                                            </section>

                                            <section className="space-y-4 rounded-xl border border-teal-900/10 bg-teal-50/50 p-4 sm:p-5 dark:bg-slate-900">
                                                <div>
                                                    <h3 className="text-sm font-black text-teal-950 dark:text-teal-100">Data kendaraan</h3>
                                                    <p className="mt-1 text-xs text-muted-foreground">Lengkapi informasi utama untuk membentuk nama unit.</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="type"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Tipe</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Input placeholder="Contoh: 1.5 G CVT, ABS, TRD" list="existing-types" {...field} value={field.value || ""} />
                                                                    <datalist id="existing-types">
                                                                        {existingTypes.map((t) => (
                                                                            <option key={t} value={t} />
                                                                        ))}
                                                                    </datalist>
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

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
                                                </div>

                                                <FormField
                                                    control={form.control}
                                                    name="kilometer"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Kilometer</FormLabel>
                                                            <FormControl>
                                                                <Input 
                                                                    type="number" 
                                                                    placeholder="Contoh: 15000" 
                                                                    {...field} 
                                                                    value={field.value || ""} 
                                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className="mt-4 pt-4 border-t">
                                                    <Label className="text-xs text-muted-foreground">Preview Nama Unit:</Label>
                                                    <div className="mt-1 rounded-lg border border-teal-900/10 bg-white p-3 text-sm font-black text-teal-950">
                                                        {form.watch("name") || "(Lengkapi form di atas)"}
                                                    </div>
                                                    <input type="hidden" {...form.register("name")} />
                                                    <input type="hidden" {...form.register("vehicleType")} />
                                                    <input type="hidden" {...form.register("brand")} />
                                                    <input type="hidden" {...form.register("model")} />
                                                    <input type="hidden" {...form.register("year")} />
                                                    <input type="hidden" {...form.register("color")} />
                                                </div>
                                            </section>

                                            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                                                <div>
                                                    <h3 className="text-sm font-black text-teal-950">Identitas & kepemilikan</h3>
                                                    <p className="mt-1 text-xs text-muted-foreground">Nomor dokumen, pemodal, dan informasi pajak unit.</p>
                                                </div>
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                            </div>
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
                                            </section>
                                            </div>
                                            <div className="safe-pb shrink-0 border-t border-slate-200 bg-white/95 px-4 pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 sm:pb-4">
                                                <Button type="submit" className="h-12 w-full rounded-xl bg-teal-600 text-base font-black shadow-lg shadow-teal-600/20 hover:bg-teal-700">{editingUnit ? "Simpan Perubahan" : "Simpan Unit"}</Button>
                                            </div>
                                        </form>
                                    </Form>
                                </DialogContent>
                    </Dialog>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-teal-900/10 bg-white/95 p-3 shadow-sm backdrop-blur lg:grid-cols-[minmax(240px,1fr)_150px_150px_220px] lg:items-center lg:gap-3">
                    <div className="relative col-span-2 w-full lg:col-span-1">
                        <Input
                            placeholder="Cari unit..."
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
                        <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white">
                            <SelectValue placeholder="Status Pemodal" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Pemodal Aktif</SelectItem>
                            <SelectItem value="inactive">Pemodal Arsip</SelectItem>
                            <SelectItem value="all">Semua Pemodal</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white">
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
                    <div className="w-full lg:hidden">
                        <Select value={getMobileSortValue()} onValueChange={handleMobileSort}>
                            <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white">
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
                <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                    <SelectTrigger className="h-11 w-full rounded-lg border-teal-900/10 bg-white">
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
                {paginatedUnits.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-teal-900/20 bg-white/80 p-8 text-center text-muted-foreground">
                        {searchQuery ? "Tidak ada unit yang cocok." : "Belum ada data unit."}
                    </div>
                ) : (
                    paginatedUnits.map((unit) => {
                        const investorTone = getInvestorTone(unit.investor.name || unit.investorId)

                        return (
                        <div
                            key={unit.id}
                            className="overflow-hidden rounded-lg border bg-white shadow-sm"
                            style={{ borderColor: investorTone.accent }}
                        >
                            <div className="h-1.5" style={{ background: investorTone.stripe }} />
                            <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 gap-3">
                                    {unit.imageUrl ? (
                                        <ImageHoverPreview
                                            src={unit.imageUrl}
                                            alt={unit.name}
                                            previewSize="lg"
                                            className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-teal-900/10"
                                        >
                                            <div className="relative h-full w-full">
                                                <Image
                                                    src={unit.imageUrl}
                                                    alt={unit.name}
                                                    fill
                                                    className="object-cover transition-transform group-hover:scale-105 cursor-pointer"
                                                    style={{ top: 0, left: 0 }}
                                                />
                                            </div>
                                        </ImageHoverPreview>
                                    ) : (
                                        <div
                                            className="relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-teal-900/10"
                                        >
                                            <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <span className="text-[10px]">No Img</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-teal-50 px-2 py-1 font-mono text-xs font-bold text-teal-700 [overflow-wrap:anywhere]">{unit.code}</span>
                                            <Badge variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'} className="h-5 rounded-full py-0 text-[10px]">
                                                {unit.status}
                                            </Badge>
                                        </div>
                                         <div className="mt-2 text-base font-black leading-snug text-slate-950 [overflow-wrap:anywhere]">{unit.name}</div>
                                         <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                            <span className="[overflow-wrap:anywhere]">{unit.plateNumber}</span>
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

                             <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Pemilik</span>
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
                                            {getInvestorInitials(unit.investor.name)}
                                        </span>
                                        <span className="truncate [overflow-wrap:anywhere]">{unit.investor.name}</span>
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-1">Jatuh Tempo Pajak</span>
                                    {unit.taxDueDate ? (
                                        <div className="flex flex-col gap-0.5">
                                            <span className={cn(
                                                "font-medium text-sm",
                                                isPast(new Date(unit.taxDueDate)) ? "text-red-600" :
                                                    isWithinInterval(new Date(unit.taxDueDate), {
                                                        start: new Date(),
                                                        end: addDays(new Date(), 90)
                                                    }) ? "text-amber-600" : "text-green-600"
                                            )}>
                                                {format(new Date(unit.taxDueDate), "d MMMM yyyy")}
                                            </span>
                                            <span className={cn(
                                                "text-xs font-medium",
                                                getTaxStatus(new Date(unit.taxDueDate)).color
                                            )}>
                                                ({getTaxStatus(new Date(unit.taxDueDate)).text})
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground italic">-</span>
                                    )}
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] rounded-lg border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                                onClick={() => setViewingUnit(unit)}
                            >
                                <Eye className="mr-1.5 h-4 w-4" /> Detail
                            </Button>
                            {!isViewer && (
                                 <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="min-h-[44px] rounded-lg border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700">
                                                <MoreHorizontal className="mr-1.5 h-5 w-5" />
                                                Aksi
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="min-w-48 rounded-xl border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                                            <DropdownMenuLabel className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Menu Unit</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-teal-50 focus:text-teal-700"
                                                onSelect={() => {
                                                    setViewingUnit(null)
                                                    setEditingUnit(unit)
                                                    setIsOpen(true)
                                                }}
                                            >
                                                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                                                    <Pencil className="h-4 w-4" />
                                                </span>
                                                Edit Unit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="my-2" />
                                            <DropdownMenuItem
                                                onSelect={() => {
                                                    setViewingUnit(null)
                                                    setDeleteId(unit.id)
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
                                </div>
                            )}
                            </div>
                        </div>
                        )
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto rounded-lg border border-teal-900/10 bg-white shadow-sm lg:block">
                <Table className="min-w-[1180px]">
                    <TableHeader className="bg-teal-50/70">
                        <TableRow className="hover:bg-teal-50/70">
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
                            <TableHead className="w-[96px] text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedUnits.map((unit) => {
                            const investorTone = getInvestorTone(unit.investor.name || unit.investorId)

                            return (
                            <TableRow
                                key={unit.id}
                                className="cursor-pointer border-l-[6px] border-y-slate-100 border-r-slate-100 transition hover:brightness-[0.98]"
                                style={{
                                    backgroundColor: investorTone.rowBg,
                                    borderLeftColor: investorTone.accent,
                                }}
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
                                            className="h-10 w-10 rounded-md overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity relative"
                                        >
                                            <div className="relative h-full w-full">
                                                <Image
                                                    src={unit.imageUrl}
                                                    alt={unit.name}
                                                    fill
                                                    className="object-cover cursor-pointer"
                                                    style={{ top: 0, left: 0 }}
                                                />
                                            </div>
                                        </ImageHoverPreview>
                                    ) : (
                                        <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                                            <span className="text-xs">No Img</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-mono text-sm font-bold text-teal-700 [overflow-wrap:anywhere]">{unit.code}</TableCell>
                                <TableCell className="max-w-[360px] whitespace-normal font-semibold leading-relaxed text-slate-950 [overflow-wrap:anywhere]">{unit.name}</TableCell>
                                <TableCell className="max-w-[220px] whitespace-normal">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="[overflow-wrap:anywhere]">{unit.plateNumber}</span>
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
                                            {getInvestorInitials(unit.investor.name)}
                                        </span>
                                        <span className="truncate [overflow-wrap:anywhere]">{unit.investor.name}</span>
                                    </span>
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    <Badge variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'} className="rounded-full">
                                        {unit.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {unit.taxDueDate ? (
                                        <div className="flex flex-col gap-0.5">
                                            <span className={cn(
                                                "font-medium text-sm",
                                                isPast(new Date(unit.taxDueDate)) ? "text-red-600" :
                                                    isWithinInterval(new Date(unit.taxDueDate), {
                                                        start: new Date(),
                                                        end: addDays(new Date(), 90)
                                                    }) ? "text-amber-600" : "text-green-600"
                                            )}>
                                                {format(new Date(unit.taxDueDate), "d MMMM yyyy")}
                                            </span>
                                            <span className={cn(
                                                "text-xs font-medium",
                                                getTaxStatus(new Date(unit.taxDueDate)).color
                                            )}>
                                                ({getTaxStatus(new Date(unit.taxDueDate)).text})
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground italic">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {!isViewer && (
                                        <div className="flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" className="min-h-[44px] rounded-lg border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700">
                                                        <MoreHorizontal className="mr-1.5 h-5 w-5" />
                                                        Aksi
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="min-w-48 rounded-xl border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                                                    <DropdownMenuLabel className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Menu Unit</DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        className="h-11 rounded-lg text-sm font-bold text-slate-700 focus:bg-teal-50 focus:text-teal-700"
                                                        onSelect={() => {
                                                            setViewingUnit(null)
                                                            setEditingUnit(unit)
                                                            setIsOpen(true)
                                                        }}
                                                    >
                                                        <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                                                            <Pencil className="h-4 w-4" />
                                                        </span>
                                                        Edit Unit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="my-2" />
                                                    <DropdownMenuItem
                                                        onSelect={() => {
                                                            setViewingUnit(null)
                                                            setDeleteId(unit.id)
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
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

            <ImagePreviewDialog
                isOpen={!!previewUrl}
                onOpenChange={(open) => !open && setPreviewUrl(null)}
                src={previewUrl || ""}
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
                open={!!viewingUnit && !isOpen}
                onOpenChange={(open) => !open && setViewingUnit(null)}
                unit={viewingUnit}
            />
        </div>
    )
}

export default function UnitsPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading...</div>}>
            <UnitsPageContent />
        </Suspense>
    )
}
