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
            className="overflow-hidden rounded-lg border bg-card shadow-sm"
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
                                className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border"
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
                            <div className="relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border">
                                <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground">
                                    <span className="text-[10px]">No Img</span>
                                </div>
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-teal-50 dark:bg-teal-950/35 px-2 py-1 font-mono text-xs font-bold text-teal-700 dark:text-teal-300 [overflow-wrap:anywhere]">{unit.code}</span>
                                <Badge variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'} className="h-5 rounded-full py-0 text-[10px]">
                                    {unit.status}
                                </Badge>
                            </div>
                            <div className="mt-2 text-base font-black leading-snug text-foreground [overflow-wrap:anywhere]">{unit.name}</div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span className="[overflow-wrap:anywhere]">{unit.plateNumber}</span>
                                {duplicateInfo.isBuyback ? (
                                    <Badge variant="outline" className="text-[9px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-300 py-0 h-4">
                                        🔄 Buyback (Ke-{duplicateInfo.purchaseNumber})
                                    </Badge>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
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
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] rounded-lg border-border px-3 text-xs font-bold text-foreground hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-300"
                    onClick={onDetail}
                >
                    <Eye className="mr-1.5 h-4 w-4" /> Detail
                </Button>
                {!isViewer && (
                    <div className="mt-3 flex justify-end border-t border-border pt-3">
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
                                    onSelect={onEdit}
                                >
                                    <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/35 text-teal-700 dark:text-teal-300">
                                        <Pencil className="h-4 w-4" />
                                    </span>
                                    Edit Unit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-2" />
                                <DropdownMenuItem
                                    onSelect={onDelete}
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
            </div>
        </div>
    )
}
