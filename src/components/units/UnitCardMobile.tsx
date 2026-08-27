import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImageHoverPreview } from "@/components/ui/image-hover-preview"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Eye, MoreHorizontal, Pencil, Trash } from "lucide-react"
import { cn } from "@/lib/utils"
import { getInvestorInitials } from "@/lib/investor-initials"
import { getTaxStatus } from "@/lib/unit-tax-status"
import { format, isPast, isWithinInterval, addDays } from "date-fns"
export interface UnitCardUnit {
    id: string
    name: string
    plateNumber: string
    code: string
    status: "AVAILABLE" | "SOLD" | "MAINTENANCE"
    investor: {
        name: string
    }
    imageUrl?: string | null
    taxDueDate?: string | Date | null
}

export interface InvestorTone {
    accent: string
    stripe: string
    chipBg: string
    chipText: string
}

export interface DuplicateInfo {
    isDuplicate: boolean
    purchaseNumber: number
    totalDuplicates: number
    isBuyback: boolean
}

export interface UnitCardMobileProps {
    unit: UnitCardUnit
    duplicateInfo: DuplicateInfo
    isViewer: boolean
    investorTone: InvestorTone
    onDetail: () => void
    onEdit: () => void
    onDelete: () => void
}

export function UnitCardMobile({
    unit,
    duplicateInfo,
    isViewer,
    investorTone,
    onDetail,
    onEdit,
    onDelete,
}: UnitCardMobileProps) {
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
                            <div className="relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-teal-900/10">
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
                                {duplicateInfo.isBuyback ? (
                                    <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-300 py-0 h-4">
                                        🔄 Buyback (Ke-{duplicateInfo.purchaseNumber})
                                    </Badge>
                                ) : null}
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
                    onClick={onDetail}
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
                                    onSelect={onEdit}
                                >
                                    <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                                        <Pencil className="h-4 w-4" />
                                    </span>
                                    Edit Unit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-2" />
                                <DropdownMenuItem
                                    onSelect={onDelete}
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
}
