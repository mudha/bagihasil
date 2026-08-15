"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Calendar, Car, FileText, Fingerprint, Gauge, Hash, Image as ImageIcon, Palette, User } from "lucide-react"
import { ImageHoverPreview } from "@/components/ui/image-hover-preview"
import Image from "next/image"
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
                return <Badge variant="default" className="rounded-full bg-green-600 px-3 py-1">Tersedia</Badge>
            case "SOLD":
                return <Badge variant="secondary" className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">Terjual</Badge>
            case "MAINTENANCE":
                return <Badge variant="destructive" className="rounded-full px-3 py-1">Perbaikan</Badge>
            default:
                return <Badge variant="outline" className="rounded-full px-3 py-1">{status}</Badge>
        }
    }

    const formattedTaxDate = unit.taxDueDate
        ? format(new Date(unit.taxDueDate), "dd MMMM yyyy", { locale: id })
        : "Belum diatur"

    const vehicleMeta = [
        unit.vehicleType,
        unit.year,
        unit.color,
    ].filter(Boolean)

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="grid h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border-teal-900/10 p-0 shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-5xl sm:rounded-2xl">
                    <div className="bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-14 text-white sm:px-6 sm:py-5 sm:pr-16">
                        <DialogHeader>
                            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 space-y-3">
                                    <div className="flex items-center gap-2 text-teal-100/80">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                            <Car className="h-5 w-5" />
                                        </span>
                                        <span className="text-xs font-black uppercase tracking-[0.16em]">Detail Unit</span>
                                    </div>
                                    <DialogTitle className="break-words text-2xl font-black tracking-tight text-white sm:text-3xl">
                                        {unit.name}
                                    </DialogTitle>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="inline-flex max-w-full rounded-lg bg-white/10 px-3 py-1 font-mono text-sm font-bold text-teal-50 [overflow-wrap:anywhere]">
                                            {unit.plateNumber || "-"}
                                        </span>
                                        <span className="inline-flex max-w-full rounded-lg bg-white/10 px-3 py-1 font-mono text-sm font-bold text-teal-50 [overflow-wrap:anywhere]">
                                            {unit.code}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-start lg:justify-end">
                                    {getStatusBadge(unit.status)}
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="min-h-0 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                            <section className="space-y-4">
                                <div className="rounded-xl border border-teal-900/10 bg-white p-4 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                                            <ImageIcon className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <h3 className="font-black text-slate-950">Foto & Dokumen</h3>
                                            <p className="text-xs text-slate-500">Foto unit dan STNK dalam satu tampilan.</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                                <ImageIcon className="h-3.5 w-3.5" />
                                                Foto Unit
                                            </p>
                                            <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 relative">
                                                {unit.imageUrl ? (
                                                    <ImageHoverPreview
                                                        src={unit.imageUrl}
                                                        alt="Foto Unit"
                                                        className="h-full w-full relative"
                                                    >
                                                        <button
                                                            type="button"
                                                            className="block h-full min-h-[180px] w-full cursor-pointer bg-slate-950 relative"
                                                            onClick={() => setPreviewImage(unit.imageUrl || null)}
                                                        >
                                                            <Image
                                                                src={unit.imageUrl}
                                                                alt="Foto Unit"
                                                                fill
                                                                className="object-contain transition-opacity hover:opacity-95"
                                                                style={{ top: 0, left: 0 }}
                                                            />
                                                        </button>
                                                    </ImageHoverPreview>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 p-6 text-center text-slate-500">
                                                        <ImageIcon className="h-9 w-9 opacity-30" />
                                                        <span className="text-sm font-semibold">Tidak ada foto</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                                <FileText className="h-3.5 w-3.5" />
                                                Foto STNK
                                            </p>
                                            <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 relative">
                                                {unit.stnkImageUrl ? (
                                                    <ImageHoverPreview
                                                        src={unit.stnkImageUrl}
                                                        alt="Foto STNK"
                                                        className="h-full w-full relative"
                                                    >
                                                        <button
                                                            type="button"
                                                            className="block h-full min-h-[180px] w-full cursor-pointer bg-slate-950 relative"
                                                            onClick={() => setPreviewImage(unit.stnkImageUrl || null)}
                                                        >
                                                            <Image
                                                                src={unit.stnkImageUrl}
                                                                alt="Foto STNK"
                                                                fill
                                                                className="object-contain transition-opacity hover:opacity-95"
                                                                style={{ top: 0, left: 0 }}
                                                            />
                                                        </button>
                                                    </ImageHoverPreview>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 p-6 text-center text-slate-500">
                                                        <FileText className="h-9 w-9 opacity-30" />
                                                        <span className="text-sm font-semibold">Tidak ada STNK</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-teal-900/10 bg-white p-4 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                            <Car className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <h3 className="font-black text-slate-950">Informasi Kendaraan</h3>
                                            <p className="text-xs text-slate-500">Spesifikasi utama kendaraan.</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <InfoTile label="Merek" value={unit.brand || "-"} />
                                        <InfoTile label="Model" value={unit.model || "-"} />
                                        <InfoTile label="Tipe" value={unit.type || "-"} />
                                        <InfoTile label="Tahun" value={unit.year || "-"} />
                                        <InfoTile label="Warna" value={unit.color || "-"} icon={<Palette className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />} />
                                        <InfoTile label="Kilometer" value={unit.kilometer ? `${unit.kilometer.toLocaleString("id-ID")} km` : "-"} icon={<Gauge className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />} />
                                        <InfoTile label="Jenis" value={unit.vehicleType || "-"} />
                                    </div>
                                </div>
                            </section>

                            <aside className="space-y-4">
                                <div className="rounded-xl border border-teal-900/10 bg-white p-4 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                                            <Fingerprint className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <h3 className="font-black text-slate-950">Detail Teknis</h3>
                                            <p className="text-xs text-slate-500">Nomor mesin dan rangka.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="rounded-lg bg-teal-50 p-3">
                                            <p className="text-xs font-semibold text-teal-900/60">No. Mesin</p>
                                            <p className="mt-1 font-mono font-bold text-teal-950 [overflow-wrap:anywhere]">{unit.engineNumber || "-"}</p>
                                        </div>
                                        <div className="rounded-lg bg-teal-50 p-3">
                                            <p className="text-xs font-semibold text-teal-900/60">No. Rangka</p>
                                            <p className="mt-1 font-mono font-bold text-teal-950 [overflow-wrap:anywhere]">{unit.chassisNumber || "-"}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-teal-900/10 bg-white p-4 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                            <Hash className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <h3 className="font-black text-slate-950">Data Administrasi</h3>
                                            <p className="text-xs text-slate-500">Pemilik, pajak, dan kode internal.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <AdminItem
                                            icon={<User className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
                                            label="Pemilik Modal"
                                            value={unit.investor?.name || "-"}
                                        />
                                        <AdminItem
                                            icon={<Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
                                            label="Jatuh Tempo Pajak"
                                            value={formattedTaxDate}
                                            muted={!unit.taxDueDate}
                                        />
                                        <AdminItem
                                            icon={<Hash className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
                                            label="Kode Unit"
                                            value={unit.code || "-"}
                                            mono
                                        />
                                    </div>
                                </div>

                                <div className="rounded-xl border border-teal-900/10 bg-white p-4 shadow-sm">
                                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Ringkasan</p>
                                    <p className="mt-2 break-words text-lg font-black leading-snug text-slate-950">{unit.name}</p>
                                    {vehicleMeta.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {vehicleMeta.map((item) => (
                                                <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </aside>
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

function InfoTile({
    label,
    value,
    icon,
}: {
    label: string
    value: string
    icon?: React.ReactNode
}) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-2 flex items-start gap-2 break-words font-bold text-slate-950">
                {icon}
                <span className="min-w-0 [overflow-wrap:anywhere]">{value}</span>
            </p>
        </div>
    )
}

function AdminItem({
    icon,
    label,
    value,
    muted = false,
    mono = false,
}: {
    icon: React.ReactNode
    label: string
    value: string
    muted?: boolean
    mono?: boolean
}) {
    return (
        <div className="flex gap-3 rounded-lg bg-slate-50 p-3">
            {icon}
            <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className={`mt-1 break-words font-bold [overflow-wrap:anywhere] ${muted ? "italic text-slate-500" : "text-slate-950"} ${mono ? "font-mono" : ""}`}>
                    {value}
                </p>
            </div>
        </div>
    )
}
