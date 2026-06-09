"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import {
    Calendar,
    User,
    Hash,
    Image as ImageIcon,
    Receipt,
    Banknote,
    Tag,
    Clock,
    DollarSign,
    Car,
    Pencil,
    Eye
} from "lucide-react"
import { ImageHoverPreview } from "@/components/ui/image-hover-preview"
import { useState } from "react"
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog"

interface Transaction {
    id: string
    transactionCode: string
    buyDate: string
    buyPrice: number
    sellDate?: string | null
    sellPrice?: number | null
    status: string
    unit: {
        name: string
        plateNumber: string
        investorId: string
        imageUrl?: string | null
        vehicleType?: string | null
        brand?: string | null
        model?: string | null
        year?: string | null
        color?: string | null
        investor: {
            name: string
        }
    }
    initialInvestorCapital?: number | null
    initialManagerCapital?: number | null
    buyProofImageUrl?: string | null
    buyProofDescription?: string | null
    notes?: string | null
    costs?: {
        amount: number
        description: string
    }[]
}

interface AdminTransactionDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: Transaction | null
    onEdit?: () => void
    onViewDetail?: () => void
}

export function AdminTransactionDetailDialog({ open, onOpenChange, transaction, onEdit, onViewDetail }: AdminTransactionDetailDialogProps) {
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    if (!transaction) return null

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val)

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "AVAILABLE":
                return <Badge variant="outline" className="border-green-600 text-green-600">Available</Badge>
            case "ON_PROCESS":
                return <Badge variant="secondary" className="bg-blue-100 text-blue-700">On Process</Badge>
            case "COMPLETED":
                return <Badge variant="default" className="bg-emerald-600">Completed</Badge>
            case "SOLD": // Assuming 'SOLD' maps to 'ON_PROCESS' or is a distinct status in your system. 
                // Check constants, but Badge variant handles display adequately.
                return <Badge variant="default" className="bg-blue-600">Sold</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <div className="flex justify-between items-start mr-8">
                            <div>
                                <DialogTitle className="text-xl flex items-center gap-2">
                                    <Receipt className="h-5 w-5" />
                                    Detail Transaksi
                                </DialogTitle>
                                <p className="text-muted-foreground font-mono mt-1">{transaction.transactionCode}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {getStatusBadge(transaction.status)}
                                {onEdit && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onEdit}
                                        className="gap-1.5"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                )}
                                {onViewDetail && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={onViewDetail}
                                        className="gap-1.5"
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        Detail
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Left Column: Unit & Transaction Info */}
                        <div className="space-y-6">

                            {/* Unit Info Card */}
                            <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                    <Car className="h-4 w-4" /> Unit Kendaraan
                                </h4>
                                <div className="flex gap-4">
                                    {transaction.unit.imageUrl ? (
                                        <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden border bg-white">
                                            <img
                                                src={transaction.unit.imageUrl}
                                                alt="Unit"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-16 w-16 shrink-0 rounded-md bg-slate-200 flex items-center justify-center text-slate-500">
                                            <Car className="h-6 w-6" />
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <p className="font-medium text-sm">{transaction.unit.name}</p>
                                        <p className="text-xs font-mono text-muted-foreground bg-white border px-1.5 py-0.5 rounded inline-block">
                                            {transaction.unit.plateNumber}
                                        </p>
                                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                            <span>{transaction.unit.year}</span>
                                            <span>•</span>
                                            <span>{transaction.unit.color}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Transaction Details */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Tag className="h-4 w-4" /> Informasi Utama
                                </h4>
                                <div className="grid grid-cols-2 gap-y-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs">Tanggal Beli</p>
                                        <div className="flex items-center gap-1.5 font-medium">
                                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                            {transaction.buyDate ? format(new Date(transaction.buyDate), "dd MMMM yyyy", { locale: id }) : "-"}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs">Harga Beli</p>
                                        <div className="flex items-center gap-1.5 font-medium">
                                            <DollarSign className="h-3.5 w-3.5 text-slate-500" />
                                            {formatCurrency(transaction.buyPrice)}
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <Separator className="my-1" />
                                    </div>

                                    {transaction.initialInvestorCapital !== null && transaction.initialInvestorCapital !== undefined && (
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground text-xs">Modal Pemodal</p>
                                            <p className="font-medium text-blue-600">
                                                {formatCurrency(transaction.initialInvestorCapital)}
                                            </p>
                                        </div>
                                    )}
                                    {transaction.initialManagerCapital !== null && transaction.initialManagerCapital !== undefined && (
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground text-xs">Modal Pengelola</p>
                                            <p className="font-medium text-orange-600">
                                                {formatCurrency(transaction.initialManagerCapital)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* Costs */}
                            {transaction.costs && transaction.costs.length > 0 && (
                                <div className="space-y-3 p-4 border rounded-lg bg-orange-50/50 border-orange-100">
                                    <h4 className="text-sm font-semibold flex items-center gap-2 text-orange-900">
                                        <Banknote className="h-4 w-4" /> Biaya & Pengeluaran
                                    </h4>
                                    <div className="space-y-2">
                                        {transaction.costs.map((cost, index) => (
                                            <div key={index} className="flex justify-between items-start text-sm">
                                                <span className="text-muted-foreground">{cost.description}</span>
                                                <span className="font-medium text-orange-700">
                                                    {formatCurrency(cost.amount)}
                                                </span>
                                            </div>
                                        ))}
                                        <Separator className="bg-orange-200" />
                                        <div className="flex justify-between items-center font-medium text-sm pt-1">
                                            <span>Total Biaya</span>
                                            <span className="text-orange-700">
                                                {formatCurrency(transaction.costs.reduce((acc, curr) => acc + curr.amount, 0))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}

                            {transaction.notes && (
                                <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-md">
                                    <p className="text-xs font-semibold text-yellow-800 mb-1">Catatan:</p>
                                    <p className="text-sm text-yellow-900">{transaction.notes}</p>
                                </div>
                            )}

                        </div>

                        {/* Right Column: Proofs & Status */}
                        <div className="space-y-6">
                            {/* Buy Proof */}
                            <div>
                                <p className="text-xs font-medium mb-2 text-muted-foreground flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3" /> Bukti Pembelian
                                </p>
                                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden border flex items-center justify-center relative group">
                                    {transaction.buyProofImageUrl ? (
                                        <ImageHoverPreview
                                            src={transaction.buyProofImageUrl}
                                            alt="Bukti Beli"
                                            className="w-full h-full"
                                        >
                                            <img
                                                src={transaction.buyProofImageUrl}
                                                alt="Bukti Beli"
                                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => setPreviewImage(transaction.buyProofImageUrl || null)}
                                            />
                                        </ImageHoverPreview>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <ImageIcon className="h-8 w-8 opacity-20" />
                                            <span className="text-xs">Tidak ada bukti foto</span>
                                        </div>
                                    )}
                                </div>
                                {transaction.buyProofDescription && (
                                    <p className="text-xs text-muted-foreground mt-1 italic text-center">
                                        "{transaction.buyProofDescription}"
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Additional Info */}
                            <div className="space-y-3 p-4 border rounded-lg">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Hash className="h-4 w-4" /> Detail Lainnya
                                </h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-xs text-muted-foreground">Pemilik Unit</p>
                                            <p className="font-medium">{transaction.unit.investor.name}</p>
                                        </div>
                                    </div>

                                    {transaction.status === "COMPLETED" && transaction.sellDate && (
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-emerald-600" />
                                            <div className="flex-1">
                                                <p className="text-xs text-muted-foreground">Tanggal Jual</p>
                                                <p className="font-medium text-emerald-700">
                                                    {format(new Date(transaction.sellDate), "dd MMMM yyyy", { locale: id })}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {transaction.status === "COMPLETED" && transaction.sellPrice && (
                                        <div className="flex items-center gap-2">
                                            <Banknote className="h-4 w-4 text-emerald-600" />
                                            <div className="flex-1">
                                                <p className="text-xs text-muted-foreground">Harga Jual</p>
                                                <p className="font-medium text-emerald-700">
                                                    {formatCurrency(transaction.sellPrice)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
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
                title="Pratinjau Bukti"
            />
        </>
    )
}
