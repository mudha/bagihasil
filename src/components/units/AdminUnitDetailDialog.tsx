"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { FileText, Car, Fingerprint, Calendar, User, Hash, Image as ImageIcon } from "lucide-react"
import { ImageHoverPreview } from "@/components/ui/image-hover-preview"
import { useState } from "react"
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog"

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
    type?: string | null
    year?: string | null
    color?: string | null
    kilometer?: number | null
    stnkImageUrl?: string | null
    engineNumber?: string | null
    chassisNumber?: string | null
    createdAt?: string
}

interface AdminUnitDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    unit: Unit | null
}

export function AdminUnitDetailDialog({ open, onOpenChange, unit }: AdminUnitDetailDialogProps) {
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    if (!unit) return null

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "AVAILABLE":
                return <Badge variant="default" className="bg-green-600">Tersedia</Badge>
            case "SOLD":
                return <Badge variant="secondary">Terjual</Badge>
            case "MAINTENANCE":
                return <Badge variant="destructive">Perbaikan</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-lg border-teal-900/10 p-0">
                    <div className="bg-[#073f3b] p-5 text-white sm:p-6">
                    <DialogHeader>
                        <div className="flex justify-between items-start mr-8">
                            <div>
                                    <DialogTitle className="text-2xl font-black tracking-tight">{unit.name}</DialogTitle>
                                    <p className="mt-2 w-fit rounded-full bg-white/10 px-3 py-1 font-mono text-sm text-teal-50">{unit.plateNumber}</p>
                            </div>
                            {getStatusBadge(unit.status)}
                        </div>
                    </DialogHeader>
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-2">
                        {/* Left Column: Images & Basic Info */}
                        <div className="space-y-6">
                            {/* Images Section */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-medium mb-2 text-muted-foreground flex items-center gap-1">
                                        <ImageIcon className="h-3 w-3" /> Foto Unit
                                    </p>
                                    <div className="aspect-video overflow-hidden rounded-lg border border-teal-900/10 bg-slate-100 flex items-center justify-center">
                                        {unit.imageUrl ? (
                                            <ImageHoverPreview
                                                src={unit.imageUrl}
                                                alt="Foto Unit"
                                                className="w-full h-full"
                                            >
                                                <img
                                                    src={unit.imageUrl}
                                                    alt="Foto Unit"
                                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setPreviewImage(unit.imageUrl || null)}
                                                />
                                            </ImageHoverPreview>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Tidak ada foto</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-2 text-muted-foreground flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Foto STNK
                                    </p>
                                    <div className="aspect-video overflow-hidden rounded-lg border border-teal-900/10 bg-slate-100 flex items-center justify-center">
                                        {unit.stnkImageUrl ? (
                                            <ImageHoverPreview
                                                src={unit.stnkImageUrl}
                                                alt="Foto STNK"
                                                className="w-full h-full"
                                            >
                                                <img
                                                    src={unit.stnkImageUrl}
                                                    alt="Foto STNK"
                                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setPreviewImage(unit.stnkImageUrl || null)}
                                                />
                                            </ImageHoverPreview>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Tidak ada STNK</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Main Info */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Car className="h-4 w-4" /> Informasi Kendaraan
                                </h4>
                                <div className="grid grid-cols-2 gap-y-3 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Merek</p>
                                        <p className="font-medium">{unit.brand || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Model</p>
                                        <p className="font-medium">{unit.model || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Tipe</p>
                                        <p className="font-medium">{unit.type || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Tahun</p>
                                        <p className="font-medium">{unit.year || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Warna</p>
                                        <p className="font-medium">{unit.color || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Kilometer</p>
                                        <p className="font-medium">{unit.kilometer ? `${unit.kilometer.toLocaleString("id-ID")} km` : "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Jenis</p>
                                        <p className="font-medium">{unit.vehicleType || "-"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Technical & Admin */}
                        <div className="space-y-6">
                            {/* Technical Specs */}
                            <div className="space-y-3 rounded-lg border border-teal-900/10 bg-teal-50/60 p-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Fingerprint className="h-4 w-4" /> Detail Teknis
                                </h4>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">No. Mesin</p>
                                        <p className="font-mono font-medium">{unit.engineNumber || "-"}</p>
                                    </div>
                                    <Separator />
                                    <div>
                                        <p className="text-muted-foreground text-xs">No. Rangka</p>
                                        <p className="font-mono font-medium">{unit.chassisNumber || "-"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Data */}
                            <div className="space-y-3 rounded-lg border border-teal-900/10 p-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Hash className="h-4 w-4" /> Data Administrasi
                                </h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-xs text-muted-foreground">Pemilik Modal</p>
                                            <p className="font-medium">{unit.investor?.name}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-xs text-muted-foreground">Jatuh Tempo Pajak</p>
                                            <p className={`font-medium ${unit.taxDueDate ? "text-foreground" : "text-muted-foreground italic"}`}>
                                                {unit.taxDueDate ? format(new Date(unit.taxDueDate), "dd MMMM yyyy", { locale: id }) : "Belum diatur"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-xs text-muted-foreground">Kode Unit</p>
                                            <p className="font-medium font-mono">{unit.code}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ImagePreviewDialog
                isOpen={!!previewImage}
                onOpenChange={(open) => !open && setPreviewImage(null)}
                src={previewImage || ""}
                title="Pratinjau Gambar"
            />
        </>
    )
}
