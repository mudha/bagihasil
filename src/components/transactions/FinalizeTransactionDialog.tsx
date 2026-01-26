"use client"

import { useState, useRef } from "react"
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
import { MultipleImageUpload } from "@/components/ui/multiple-image-upload"
import { toast } from "sonner"
import { DollarSign, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { validateImageFile } from "@/lib/image-utils"

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
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [imagePreview, setImagePreview] = useState<string | null>(null) // Deprecated, but keeping for compatibility if needed, though MultipleImageUpload handles previews internally

    // Ref for AI analysis
    const isAnalyzingRef = useRef(false)

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
        const newFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                const file = items[i].getAsFile()
                if (file) {
                    const validation = validateImageFile(file)
                    if (!validation.valid) {
                        toast.error(validation.error)
                        continue
                    }
                    newFiles.push(file)
                }
            }
        }

        if (newFiles.length > 0) {
            setImageFiles(prev => [...prev, ...newFiles])
            toast.success(`${newFiles.length} gambar berhasil dipaste!`)
            // Trigger analysis for new files
            analyzeImages([...imageFiles, ...newFiles])
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
            const proofUrls: string[] = []
            if (imageFiles.length > 0) {
                // Upload all files in parallel
                const uploadPromises = imageFiles.map(file => uploadFile(file))
                const urls = await Promise.all(uploadPromises)
                proofUrls.push(...urls)
            }

            // If we have multiple URLs, we'll store them as a JSON string or comma separated if needed.
            // Assuming the schema sellProofImageUrl is a String, we might need to store it as JSON string if we want to keep multiple.
            // Or if the backend expects a single URL, we might need a workaround.
            // For now, let's store the first one as primary IF the backend blindly uses it as URL, 
            // BUT since we want multiple, let's store JSON string. The frontend displaying it needs to handle this check.
            // Ideally schema should change to String[] but for quick implementation we use JSON string if possible.
            // Let's assume we store the stringified array if > 1, or just the url if 1 to try and keep some compat.
            // Actually better to always store consistent format if possible, but let's stick to "if array then json" approach.

            let finalProofUrl = null
            if (proofUrls.length === 1) {
                finalProofUrl = proofUrls[0]
            } else if (proofUrls.length > 1) {
                finalProofUrl = JSON.stringify(proofUrls)
            }

            const payload = {
                ...values,
                status: 'COMPLETED',
                sellProofImageUrl: finalProofUrl,
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

    const analyzeImages = async (files: File[]) => {
        if (isAnalyzingRef.current || files.length === 0) return

        isAnalyzingRef.current = true
        const toastId = toast.loading(`Menganalisis ${files.length} bukti pelunasan...`)

        try {
            const formData = new FormData()
            files.forEach(file => {
                formData.append('files', file) // Append all files with same key 'files'
            })

            const res = await fetch('/api/ai/parse-receipt', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || "Gagal analitik")
            }

            const result = await res.json()
            console.log('AI Result:', result) // Debug log
            if (result.success && result.data) {
                const { totalAmount, latestDate, combinedDescription } = result.data
                console.log('Extracted data:', { totalAmount, latestDate, combinedDescription }) // Debug log
                let updated = false

                // Update Sell Price if 0 or update it to total
                if (totalAmount && typeof totalAmount === 'number') {
                    // Always update if it comes from AI to reflect sum of all
                    form.setValue("sellPrice", totalAmount)
                    updated = true
                }

                // Update Date - ALWAYS update to latest date if available
                if (latestDate) {
                    console.log('Setting sellDate to:', latestDate) // Debug log
                    form.setValue("sellDate", latestDate)
                    updated = true
                }

                // Update Notes
                if (combinedDescription) {
                    const currentNotes = form.getValues("notes")
                    const newNotes = currentNotes ? `${currentNotes}\n\n${combinedDescription}` : combinedDescription
                    form.setValue("notes", newNotes)
                    updated = true
                }

                if (updated) {
                    toast.success("Data pelunasan terisi otomatis (Total Dijumlahkan)!", { id: toastId })
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
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
                    <DollarSign className="mr-2 h-4 w-4" /> Finalisasi Penjualan
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onPaste={handlePaste}>
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            Finalisasi Penjualan Unit
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
                        <FormField
                            control={form.control}
                            name="sellDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tanggal Laku</FormLabel>
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
                        <FormField
                            control={form.control}
                            name="sellPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Harga Laku (Rp)</FormLabel>
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

                        <div className="space-y-2">


                            <MultipleImageUpload
                                initialImages={imageFiles.map(file => ({
                                    id: file.name,
                                    file: file,
                                    preview: URL.createObjectURL(file),
                                    description: ""
                                }))}
                                onImagesChange={(images) => {
                                    const files = images.map(img => img.file).filter((f): f is File => f !== null)
                                    setImageFiles(files)
                                    if (files.length > 0) {
                                        analyzeImages(files)
                                    }
                                }}
                                maxImages={5}
                                uploadLabel="Upload Bukti Transfer (Bisa Banyak)"
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
