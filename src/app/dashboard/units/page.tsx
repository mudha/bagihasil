"use client"

import { Suspense } from "react"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { useSearchParams } from "next/navigation"
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
    DialogDescription,
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
import { Plus, MoreHorizontal, Pencil, Trash, ArrowUp, ArrowDown, ArrowUpDown, Car, CheckCircle2, Loader2, Repeat, Scan, Wrench } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { getInvestorInitials } from "@/lib/investor-initials"
import { getInvestorToneTheme } from "@/lib/investor-tone"
import { ImportUnitsDialog } from "@/components/import/ImportUnitsDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format, isPast, isWithinInterval, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { getTaxStatus } from "@/lib/unit-tax-status"
import { OperationalPageHeader } from "@/components/mudha/OperationalPageHeader"
import { SummaryMetric } from "@/components/mudha/SummaryMetric"
import { LoadingState } from "@/components/mudha/LoadingState"
import { ErrorState } from "@/components/mudha/ErrorState"
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
import { UnitCardMobile } from "@/components/units/UnitCardMobile"
import { formatOdometer, compareOdometer } from "@/lib/odometer-format"
import { createUnitSelectState, updateUnitSelectState, type UnitSelectState } from "@/lib/unit-form-select-state"
import { VEHICLE_TYPES, BRANDS, MODELS, COLORS, YEARS, getDuplicateInfo } from "@/components/units/unit-data"



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




function UnitsPageContent() {
    const { data: session } = useSession()
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === "dark"
    const searchParams = useSearchParams()
    const isViewer = session?.user?.role === "VIEWER"

    const [units, setUnits] = useState<Unit[]>([])
    const [investors, setInvestors] = useState<Investor[]>([])
    const [unitsLoading, setUnitsLoading] = useState(true)
    const [unitsError, setUnitsError] = useState<string | null>(null)
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
    const [unitSelectState, setUnitSelectState] = useState<UnitSelectState>(createUnitSelectState)
    const [customModel, setCustomModel] = useState<string>("")
    const [customColor, setCustomColor] = useState<string>("")

    const { vehicleType, brand, model, year, color } = unitSelectState
    const setVehicleType = useCallback((value: string) => setUnitSelectState((state: UnitSelectState) => updateUnitSelectState(state, {
        type: "vehicleType",
        value,
        validBrands: BRANDS[value as keyof typeof BRANDS] || [],
    })), [])
    const setBrand = useCallback((value: string) => setUnitSelectState((state: UnitSelectState) => updateUnitSelectState(state, {
        type: "brand",
        value,
        validModels: MODELS[vehicleType]?.[value] || [],
    })), [vehicleType])
    const setModel = useCallback((value: string) => setUnitSelectState((state: UnitSelectState) => updateUnitSelectState(state, { type: "model", value })), [])
    const setYear = useCallback((value: string) => setUnitSelectState((state: UnitSelectState) => updateUnitSelectState(state, { type: "year", value })), [])
    const setColor = useCallback((value: string) => setUnitSelectState((state: UnitSelectState) => updateUnitSelectState(state, { type: "color", value })), [])

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
        try {
            setUnitsLoading(true)
            setUnitsError(null)
            const res = await fetch('/api/units')
            if (!res.ok) throw new Error('Gagal memuat data unit')
            const data = await res.json()
            setUnits(data)
        } catch (err: any) {
            setUnitsError(err.message || 'Terjadi kesalahan')
        } finally {
            setUnitsLoading(false)
        }
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

            setUnitSelectState({
                vehicleType: vType,
                brand: vBrand,
                model: vModel,
                year: vYear,
                color: vColor,
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

                    const brandList = BRANDS[data.vehicleType] || [];

                    // Map Brand (only if vehicle type is valid)
                    if (data.brand) {
                        // 1. Try exact match first (case-insensitive)
                        let matchedBrand = brandList.find((b: string) => b.toLowerCase() === data.brand.toLowerCase());

                        // 2. If no exact match, try fuzzy match
                        if (!matchedBrand) {
                            matchedBrand = brandList.find((b: string) => data.brand.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(data.brand.toLowerCase()));
                        }

                        if (matchedBrand) {
                            setBrand(matchedBrand);

                            // Use another setTimeout for model to ensure brand state propagates
                            setTimeout(() => {

                                // Map Model
                                if (data.model) {
                                    const modelList = MODELS[data.vehicleType]?.[matchedBrand] || [];

                                    // 1. Try exact match first
                                    let matchedModel = modelList.find((m: string) => m.toLowerCase() === data.model.toLowerCase());

                                    // 2. If no exact match, match by inclusion
                                    if (!matchedModel) {
                                        matchedModel = modelList.find((m: string) => m.toLowerCase().includes(data.model.toLowerCase()) || data.model.toLowerCase().includes(m.toLowerCase()));
                                    }
                                    if (matchedModel) {
                                        setModel(matchedModel);
                                    } else {
                                        setModel("Lainnya");
                                        setCustomModel(data.model);
                                    }
                                }
                            }, 50); // 50ms delay for model
                        }
                    } else {
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
            case "kilometer":
                return compareOdometer(a.kilometer, b.kilometer, sortOrder)
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
            <OperationalPageHeader
                title="Unit Kendaraan"
                description="Kelola stok aktif, unit terjual, pajak, foto kendaraan, dan data STNK."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryMetric label="Total" value={unitSummary.total} icon={<Car className="h-4 w-4" />} tone="neutral" loading={unitsLoading || !!unitsError} />
                <SummaryMetric label="Aktif" value={unitSummary.available} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" loading={unitsLoading || !!unitsError} />
                <SummaryMetric label="Terjual" value={unitSummary.sold} icon={<Car className="h-4 w-4" />} tone="info" loading={unitsLoading || !!unitsError} />
                <SummaryMetric label="Servis" value={unitSummary.maintenance} icon={<Wrench className="h-4 w-4" />} tone="warning" loading={unitsLoading || !!unitsError} />
            </div>

            {!isViewer && (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card/85 p-3 shadow-sm backdrop-blur [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:w-full lg:flex lg:justify-end lg:[&_[data-slot=button]]:w-auto">
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
                                    <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">
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
                                    form.reset()
                                    setUnitSelectState(createUnitSelectState())
                                    setCustomModel("")
                                    setCustomColor("")
                                    setUnitImages([])
                                    setStnkImages([])
                                }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="h-11 rounded-lg px-3 font-semibold sm:px-4">
                                <Plus className="mr-1.5 h-4 w-4 sm:mr-2" /> Tambah Unit
                            </Button>
                        </DialogTrigger>
                                <DialogContent className="grid h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 border-border p-0 shadow-2xl shadow-slate-950/20 sm:h-[92dvh] sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:rounded-2xl sm:border">
                                    <DialogHeader className="border-b border-[var(--mudha-border)] bg-[var(--mudha-surface-subtle)] px-4 py-4 pr-16 text-left sm:px-7 sm:py-5 sm:pr-20">
                                        <div className="w-fit rounded-full bg-[var(--mudha-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--mudha-text-muted)]">
                                            {editingUnit ? "Mode edit" : "Unit baru"}
                                        </div>
                                        <DialogTitle className="mt-2 text-xl font-bold tracking-tight text-[var(--mudha-text)] sm:text-2xl">{editingUnit ? "Edit Unit" : "Tambah Unit Baru"}</DialogTitle>
                                        <DialogDescription className="sr-only">
                                            {editingUnit ? "Formulir untuk memperbarui data unit kendaraan." : "Formulir untuk menambahkan unit kendaraan."}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-col overflow-hidden">
                                            <div className="touch-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 pb-6 [&_[data-slot=input]]:h-11 [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full sm:p-6 sm:pb-8">

                                            <section className="space-y-4">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-[var(--mudha-text)]">Foto kendaraan</h3>
                                                    <p className="mt-1 text-xs text-muted-foreground">Opsional. Foto dapat dipilih langsung dari galeri HP.</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                                                        <MultipleImageUpload
                                                            initialImages={unitImages}
                                                            onImagesChange={setUnitImages}
                                                            maxImages={1}
                                                            uploadLabel="Upload Foto Unit"
                                                        />
                                                    </div>
                                                    <div className="rounded-xl border border-border bg-muted/50 p-4">
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
                                                            {isScanningStnk ? (
                                                                <>
                                                                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                                                    Scanning...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Scan className="h-4 w-4" aria-hidden="true" />
                                                                    Scan AI
                                                                </>
                                                            )}
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

                                            <section className="space-y-4 rounded-xl border border-border bg-primary/5 p-4 sm:p-5">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-[var(--mudha-text)]">Data kendaraan</h3>
                                                    <p className="mt-1 text-xs text-muted-foreground">Lengkapi informasi utama untuk membentuk nama unit.</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label>Jenis Kendaraan</Label>
                                                        <Select value={vehicleType} onValueChange={setVehicleType}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Pilih Jenis" />
                                                            </SelectTrigger>
                                                            <SelectContent className="z-[110]">
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
                                                            <SelectContent className="z-[110]">
                                                                {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Merek</Label>
                                                    <Select value={brand} onValueChange={setBrand} disabled={!vehicleType}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={vehicleType ? "Pilih Merek" : "Pilih Jenis dulu"} />
                                                        </SelectTrigger>
                                                        <SelectContent className="z-[110]">
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
                                                            <SelectContent className="z-[110]">
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
                                                        <SelectContent className="z-[110]">
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
                                                    <div className="mt-1 rounded-lg border border-border bg-card p-3 text-sm font-black text-teal-950 dark:text-teal-100">
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

                                            <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-[var(--mudha-text)]">Identitas & kepemilikan</h3>
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
                                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Pilih Pemodal" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="z-[110]">
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
                                                                <SelectContent className="z-[110]">
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
                                            <div className="safe-pb shrink-0 border-t border-border bg-card/95 px-4 pt-3 shadow-[var(--mudha-shadow-sm)] backdrop-blur sm:px-6 sm:pb-4">
                                                <Button type="submit" disabled={form.formState.isSubmitting} className="h-12 w-full rounded-xl bg-teal-600 text-base font-black shadow-lg shadow-teal-600/20 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 disabled:opacity-50">{form.formState.isSubmitting ? "Menyimpan..." : editingUnit ? "Simpan Perubahan" : "Simpan Unit"}</Button>
                                            </div>
                                        </form>
                                    </Form>
                                </DialogContent>
                    </Dialog>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur lg:grid-cols-[minmax(240px,1fr)_150px_150px_220px] lg:items-center lg:gap-3">
                    <div className="relative col-span-2 w-full lg:col-span-1">
                        <Input
                            placeholder="Cari unit..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="h-11 w-full rounded-lg border-border bg-card pr-10"
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
                        <SelectTrigger className="h-11 w-full rounded-lg border-border bg-card">
                            <SelectValue placeholder="Status Pemodal" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Pemodal Aktif</SelectItem>
                            <SelectItem value="inactive">Pemodal Arsip</SelectItem>
                            <SelectItem value="all">Semua Pemodal</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-11 w-full rounded-lg border-border bg-card">
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
                            <SelectTrigger className="h-11 w-full rounded-lg border-border bg-card">
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
                    <SelectTrigger className="h-11 w-full rounded-lg border-border bg-card">
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

            {unitsLoading ? (
                <LoadingState variant="table" label="Memuat data unit..." />
            ) : unitsError ? (
                <ErrorState title="Gagal memuat data unit" description={unitsError} onRetry={fetchUnits} />
            ) : (
            <>
            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
                {paginatedUnits.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-card/80 p-8 text-center text-muted-foreground">
                        {searchQuery ? "Tidak ada unit yang cocok." : "Belum ada data unit."}
                    </div>
                ) : (
                    paginatedUnits.map((unit) => {
                        const investorTone = getInvestorToneTheme(unit.investor.name || unit.investorId, isDark)
                        return (
                            <UnitCardMobile
                                key={unit.id}
                                unit={unit}
                                duplicateInfo={getDuplicateInfo(units, unit)}
                                isViewer={isViewer}
                                investorTone={investorTone}
                                onDetail={() => setViewingUnit(unit)}
                                onEdit={() => {
                                    setViewingUnit(null)
                                    setEditingUnit(unit)
                                    setIsOpen(true)
                                }}
                                onDelete={() => {
                                    setViewingUnit(null)
                                    setDeleteId(unit.id)
                                }}
                            />
                        )
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm lg:block">
                <Table className="min-w-[1260px]">
                    <TableHeader className="bg-teal-50/70 dark:bg-teal-950/40">
                        <TableRow className="hover:bg-teal-50/70 dark:hover:bg-teal-950/40">
                            <TableHead className="w-[50px]">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
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
                            <TableHead className="whitespace-nowrap">No. Polisi</TableHead>
                            <TableHead className="whitespace-nowrap text-right">
                                <Button
                                    variant="ghost"
                                    className="flex h-auto w-full justify-end whitespace-nowrap p-0 font-semibold hover:bg-transparent"
                                    aria-label="Urutkan berdasarkan Odometer"
                                    onClick={() => {
                                        if (sortBy === "kilometer") {
                                            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                        } else {
                                            setSortBy("kilometer")
                                            setSortOrder("asc")
                                        }
                                    }}
                                >
                                    Odometer
                                    {sortBy === "kilometer" ? (
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
                            const investorTone = getInvestorToneTheme(unit.investor.name || unit.investorId, isDark)

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
                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary disabled:opacity-50"
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
                                            className="h-10 w-10 rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity relative"
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
                                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                                            <span className="text-xs">No Img</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-mono text-sm font-bold text-teal-700 dark:text-teal-300 [overflow-wrap:anywhere]">{unit.code}</TableCell>
                                <TableCell className="max-w-[360px] whitespace-normal font-semibold leading-relaxed text-foreground [overflow-wrap:anywhere]">{unit.name}</TableCell>
                                <TableCell className="max-w-[220px] whitespace-normal">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="[overflow-wrap:anywhere]">{unit.plateNumber}</span>
                                        {(() => {
                                            const duplicateInfo = getDuplicateInfo(units, unit)
                                            return duplicateInfo.isBuyback ? (
                                                <Badge variant="outline" className="inline-flex items-center gap-1 text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-300">
                                                    <Repeat className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                    Buyback (Ke-{duplicateInfo.purchaseNumber})
                                                </Badge>
                                            ) : null
                                        })()}
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right font-mono text-sm tabular-nums" title={formatOdometer(unit.kilometer)}>
                                    {formatOdometer(unit.kilometer)}
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
                                                isPast(new Date(unit.taxDueDate)) ? "text-red-600 dark:text-red-400" :
                                                    isWithinInterval(new Date(unit.taxDueDate), {
                                                        start: new Date(),
                                                        end: addDays(new Date(), 90)
                                                    }) ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
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
                                                    <Button variant="outline" size="sm" className="min-h-[44px] rounded-lg border-border px-3 text-xs font-bold text-foreground hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-300">
                                                        <MoreHorizontal className="mr-1.5 h-5 w-5" />
                                                        Aksi
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="min-w-48 rounded-xl border-border bg-card p-2 shadow-2xl shadow-black/15">
                                                    <DropdownMenuLabel className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Menu Unit</DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        className="h-11 rounded-lg text-sm font-bold text-foreground focus:bg-teal-50 focus:text-teal-700 dark:focus:bg-teal-950/40 dark:focus:text-teal-300"
                                                        onSelect={() => {
                                                            setViewingUnit(null)
                                                            setEditingUnit(unit)
                                                            setIsOpen(true)
                                                        }}
                                                    >
                                                        <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/35 text-teal-700 dark:text-teal-300">
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
                                                        className="h-11 rounded-lg text-sm font-bold text-red-600 dark:text-red-400 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/40 dark:focus:text-red-300"
                                                    >
                                                        <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
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
            </>
            )}

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
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">
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
        <Suspense fallback={<div className="p-8">Memuat...</div>}>
            <UnitsPageContent />
        </Suspense>
    )
}
