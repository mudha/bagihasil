"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { SingleImageUpload } from "@/components/ui/single-image-upload"
import { toast } from "sonner"
import { validateImageFile } from "@/lib/image-utils"
import { DollarSign } from "lucide-react"

const sellSchema = z.object({
    sellDate: z.string().min(1, "Tanggal jual harus diisi"),
    sellPrice: z.number().min(0, "Harga laku harus lebih dari 0"),
    investorSharePercentage: z.number().min(0).max(100),
    managerSharePercentage: z.number().min(0).max(100),
    notes: z.string().optional(),
})

type SellFormValues = z.infer<typeof sellSchema>

interface FinalizeTransactionDialogProps {
    transactionId: string
    onSuccess: () => void
    defaultShares?: { investor: number, manager: number }
}

export function FinalizeTransactionDialog({ transactionId, onSuccess, defaultShares = { investor: 40, manager: 60 } }: FinalizeTransactionDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    const form = useForm<SellFormValues>({
        resolver: zodResolver(sellSchema),
        defaultValues: {
            sellDate: new Date().toISOString().split('T')[0],
            sellPrice: 0,
            investorSharePercentage: defaultShares.investor,
            managerSharePercentage: defaultShares.manager,
            notes: "",
        },
    })

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                const file = items[i].getAsFile()
                if (file) {
                    const validation = validateImageFile(file)
                    if (!validation.valid) {
                        toast.error(validation.error)
                        return
                    }

                    const reader = new FileReader()
                    reader.onloadend = () => {
                        const result = reader.result as string
                        setImageFile(file)
                        setImagePreview(result)
                        toast.success("Gambar berhasil dipaste!")
                    }
                    reader.readAsDataURL(file)
                    break
                }
            }
        }
    }

    const uploadFile = async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload/payment-proof', {
            method: 'POST',
            body: formData,
        })
        if (!res.ok) throw new Error("Upload failed")
        const data = await res.json()
        return data.url
    }

    const onSubmit = async (values: z.infer<typeof sellSchema>) => {
        setIsLoading(true)
        try {
            let proofUrl = undefined
            if (imageFile) {
                proofUrl = await uploadFile(imageFile)
            }

            const payload = {
                ...values,
                status: 'COMPLETED',
                sellProofImageUrl: proofUrl,
                sellProofDescription: "Bukti Pelunasan Unit"
            }

            // Using PUT to update transaction status and details
            const res = await fetch(`/api/transactions/${transactionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                toast.success("Transaksi berhasil diselesaikan!")
                setOpen(false)
                onSuccess()
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal menyelesaikan transaksi")
            }
        } catch (error) {
            console.error(error)
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
                    <DollarSign className="mr-2 h-4 w-4" /> Finalisasi Penjualan
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onPaste={handlePaste}>
                <DialogHeader>
                    <DialogTitle>Finalisasi Penjualan Unit</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="sellDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tanggal Laku</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sellPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Harga Laku (Rp)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2">
                            <SingleImageUpload
                                label="Bukti Pelunasan / Transfer"
                                value={imagePreview}
                                onChange={(file, preview) => {
                                    setImageFile(file)
                                    setImagePreview(preview)
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="investorSharePercentage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bagi Hasil Pemodal (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="managerSharePercentage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bagi Hasil Pengelola (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Catatan Penjualan</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Catatan akhir..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
                            {isLoading ? "Memproses..." : "Proses & Simpan"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
