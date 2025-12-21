"use client"

import { useState, useEffect } from "react"
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
import { Pencil } from "lucide-react"

const editSchema = z.object({
    transactionCode: z.string().min(1, "Kode transaksi harus diisi"),
    buyDate: z.string().min(1, "Tanggal beli harus diisi"),
    buyPrice: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? Number(val) : val),
    initialInvestorCapital: z.union([z.string(), z.number()]).optional().transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }),
    initialManagerCapital: z.union([z.string(), z.number()]).optional().transform((val) => {
        if (val === "" || val === null || val === undefined) return undefined
        return typeof val === 'string' ? Number(val) : val
    }),
    notes: z.string().optional(),
})

interface EditTransactionDetailsDialogProps {
    transaction: any
    onSuccess: () => void
}

export function EditTransactionDetailsDialog({ transaction, onSuccess }: EditTransactionDetailsDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(transaction.buyProofImageUrl || null)

    const form = useForm<z.infer<typeof editSchema>>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            transactionCode: transaction.transactionCode,
            buyDate: transaction.buyDate ? new Date(transaction.buyDate).toISOString().split('T')[0] : "",
            buyPrice: transaction.buyPrice,
            initialInvestorCapital: transaction.initialInvestorCapital,
            initialManagerCapital: transaction.initialManagerCapital,
            notes: transaction.notes || "",
        },
    })

    useEffect(() => {
        if (open) {
            form.reset({
                transactionCode: transaction.transactionCode,
                buyDate: transaction.buyDate ? new Date(transaction.buyDate).toISOString().split('T')[0] : "",
                buyPrice: transaction.buyPrice,
                initialInvestorCapital: transaction.initialInvestorCapital,
                initialManagerCapital: transaction.initialManagerCapital,
                notes: transaction.notes || "",
            })
            setImagePreview(transaction.buyProofImageUrl || null)
        }
    }, [open, transaction, form])

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

    const onSubmit = async (values: z.infer<typeof editSchema>) => {
        setIsLoading(true)
        try {
            let proofUrl = transaction.buyProofImageUrl
            if (imageFile) {
                proofUrl = await uploadFile(imageFile)
            } else if (imagePreview === null) {
                // Handle deletion if logic requires (optional, here we assume keeping old unless invalid)
                // But SingleImageUpload sets preview null on remove.
                // If preview is null, we should probably clear the field?
                if (!imageFile && transaction.buyProofImageUrl) {
                    // Logic to clear field? Zod schema is optional.
                    // Let's assume blanking it out if preview is null.
                    proofUrl = null // Simplified
                }
            }

            // Note: SingleImageUpload logic: 
            // - If user removes: onChange(null, null) -> imageFile=null, preview=null.
            // - If user keeps existing: imageFile=null, preview=url.
            // So if preview is null, we pass empty text?
            // Actually, my API update schema accepts optional string. null might be okay if I transform.
            // But Prisma expects string | null.

            const payload = {
                ...values,
                buyProofImageUrl: imagePreview === null ? null : (imageFile ? proofUrl : (transaction.buyProofImageUrl || null)),
                buyProofDescription: imagePreview ? "Bukti Pembelian Unit" : null
            }

            const res = await fetch(`/api/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                toast.success("Transaksi berhasil diupdate")
                setOpen(false)
                onSuccess()
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal mengupdate transaksi")
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
                <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Detail
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Detail Transaksi</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="transactionCode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kode Transaksi</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="buyDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tanggal Beli</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="buyPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Harga Beli (Rp)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2 border p-4 rounded-md">
                            <h4 className="text-sm font-medium">Modal Awal (Opsional)</h4>
                            <p className="text-xs text-muted-foreground mb-4">Isi jika berbeda dengan harga beli</p>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="initialInvestorCapital"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Modal Pemodal</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="initialManagerCapital"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Modal Pengelola</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <SingleImageUpload
                            label="Bukti Pembelian (Kwintansi/Nota)"
                            value={imagePreview}
                            onChange={(file, preview) => {
                                setImageFile(file)
                                setImagePreview(preview)
                            }}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Catatan</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Menyimpan..." : "Update"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
