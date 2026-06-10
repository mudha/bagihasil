"use client"

import { useState, useEffect, useRef } from "react"
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
import { Pencil, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const editSchema = z.object({
    transactionCode: z.string().min(1, "Kode transaksi harus diisi"),
    buyDate: z.string().min(1, "Tanggal beli harus diisi"),
    buyPrice: z.number().min(0, "Harga beli harus lebih dari 0"),
    initialInvestorCapital: z.number().optional().nullable(),
    initialManagerCapital: z.number().optional().nullable(),
    notes: z.string().optional(),
})

type EditFormValues = z.infer<typeof editSchema>

interface EditTransactionDetailsDialogProps {
    transaction: any
    onSuccess: () => void
    triggerClassName?: string
    triggerLabel?: string
}

export function EditTransactionDetailsDialog({ transaction, onSuccess, triggerClassName, triggerLabel = "Edit Detail" }: EditTransactionDetailsDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(transaction.buyProofImageUrl || null)

    // Ref to track last analyzed to prevent duplicates
    const isAnalyzingRef = useRef(false)

    const form = useForm<EditFormValues>({
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

            const responseData = await res.json()

            if (res.ok) {
                toast.success("Transaksi berhasil diupdate")
                setOpen(false)
                onSuccess()
            } else {
                toast.error(responseData.error || "Gagal mengupdate transaksi")
            }
        } catch (error) {
            console.error(error)
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    const analyzeImage = async (file: File) => {
        if (isAnalyzingRef.current) return

        isAnalyzingRef.current = true
        const toastId = toast.loading("Menganalisis bukti...")

        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/ai/parse-receipt', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || "Gagal analitik")
            }

            const result = await res.json()
            if (result.success && result.data) {
                const { amount, date, description } = result.data
                let updated = false

                // Update Buy Price if currently 0
                if (amount && typeof amount === 'number') {
                    if (form.getValues("buyPrice") === 0) {
                        form.setValue("buyPrice", amount)
                        updated = true
                    }
                }

                // Update Date
                if (date) {
                    if (!form.getValues("buyDate")) {
                        form.setValue("buyDate", date)
                        updated = true
                    }
                }

                // Update Notes
                if (description && !form.getValues("notes")) {
                    form.setValue("notes", description)
                    updated = true
                }

                if (updated) {
                    toast.success("Data transaksi terisi otomatis!", { id: toastId })
                } else {
                    toast.dismiss(toastId)
                }
            } else {
                toast.dismiss(toastId)
            }
        } catch (e) {
            console.error(e)
            toast.error("Gagal membaca bukti", { id: toastId })
        } finally {
            isAnalyzingRef.current = false
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className={triggerClassName}>
                    <Pencil className={cn("h-4 w-4", triggerLabel && "mr-2")} />
                    {triggerLabel}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            Edit Detail Transaksi
                        </span>
                        {isAnalyzingRef.current ? (
                            <span className="text-xs font-medium text-blue-600 animate-pulse flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                                <Sparkles className="h-3 w-3 text-blue-500 animate-spin-slow" />
                                AI Menganalisis...
                            </span>
                        ) : (
                            <span className="text-[10px] items-center gap-1 text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100 hidden sm:flex">
                                <Sparkles className="h-3 w-3 text-purple-400" />
                                AI Powered
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                        <div className="relative">
                                            <Input
                                                type="date"
                                                {...field}
                                                className={cn(
                                                    "transition-all duration-500",
                                                    isAnalyzingRef.current && "border-blue-400 bg-blue-50/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                                )}
                                            />
                                            {isAnalyzingRef.current && (
                                                <Sparkles className="h-4 w-4 text-blue-400 absolute right-8 top-1/2 -translate-y-1/2 animate-pulse" />
                                            )}
                                        </div>
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
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                            className={cn(
                                                "transition-all duration-500",
                                                isAnalyzingRef.current && "border-blue-400 bg-blue-50/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                            )}
                                        />
                                        {isAnalyzingRef.current && (
                                            <Sparkles className="h-4 w-4 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" />
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2 border p-4 rounded-md">
                            <h4 className="text-sm font-medium">Modal Awal (Opsional)</h4>
                            <p className="text-xs text-muted-foreground mb-4">Isi jika berbeda dengan harga beli</p>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                if (file) {
                                    analyzeImage(file)
                                }
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
