"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"
import { DollarSign, Upload, X, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { validateImageFile, formatFileSize } from "@/lib/image-utils"

const paymentSchema = z.object({
    amount: z.number().positive("Jumlah harus lebih dari 0"),
    paymentDate: z.string().min(1, "Tanggal pembayaran harus diisi"),
    method: z.enum(['TRANSFER', 'CASH']),
    notes: z.string().optional(),
})

interface AddPaymentDialogProps {
    transactionId: string
    investorId: string
    onSuccess?: () => void
}

export function AddPaymentDialog({ transactionId, investorId, onSuccess }: AddPaymentDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<z.infer<typeof paymentSchema>>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            paymentDate: new Date().toISOString().split('T')[0],
            method: 'TRANSFER',
        }
    })

    // Handle paste event for images from clipboard
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // Only handle paste when dialog is open
            if (!isOpen) return

            const items = e.clipboardData?.items
            if (!items) return

            for (let i = 0; i < items.length; i++) {
                const item = items[i]

                // Check if the item is an image
                if (item.type.startsWith('image/')) {
                    e.preventDefault()

                    const blob = item.getAsFile()
                    if (!blob) continue

                    // Convert blob to File object with a name
                    const file = new File(
                        [blob],
                        `pasted-image-${Date.now()}.${blob.type.split('/')[1]}`,
                        { type: blob.type }
                    )

                    const validation = validateImageFile(file)
                    if (!validation.valid) {
                        toast.error(validation.error)
                        return
                    }

                    setImageFile(file)
                    analyzeImage(file) // Trigger AI analysis

                    const reader = new FileReader()
                    reader.onloadend = () => {
                        setImagePreview(reader.result as string)
                    }
                    reader.readAsDataURL(file)

                    toast.success('Gambar berhasil di-paste!')
                    break
                }
            }
        }

        // Add event listener when dialog is open
        if (isOpen) {
            document.addEventListener('paste', handlePaste)
        }

        // Cleanup
        return () => {
            document.removeEventListener('paste', handlePaste)
        }
    }, [isOpen])


    // Ref for AI analysis
    const isAnalyzingRef = useRef(false)

    const analyzeImage = async (file: File) => {
        if (isAnalyzingRef.current) return

        isAnalyzingRef.current = true
        const toastId = toast.loading("Menganalisis bukti pembayaran...")

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

                // Update Amount
                if (amount && typeof amount === 'number') {
                    // Always update or check if 0/empty? 
                    // Usually payments are exact amounts from receipt.
                    // The default value is not set (undefined/empty).
                    // But schema default is undefined? No, defaultValues doesn't have amount.
                    setValue("amount", amount, { shouldValidate: true })
                    updated = true
                }

                // Update Date
                if (date) {
                    if (!watch("paymentDate")) {
                        setValue("paymentDate", date, { shouldValidate: true })
                        updated = true
                    }
                }

                // Update Notes
                if (description && !watch("notes")) {
                    setValue("notes", description, { shouldValidate: true })
                    updated = true
                }

                if (updated) {
                    toast.success("Data pembayaran terisi otomatis!", { id: toastId })
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const validation = validateImageFile(file)
        if (!validation.valid) {
            toast.error(validation.error)
            return
        }

        setImageFile(file)
        analyzeImage(file) // Trigger AI analysis

        const reader = new FileReader()
        reader.onloadend = () => {
            setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveImage = () => {
        setImageFile(null)
        setImagePreview(null)
    }

    const uploadImage = async (): Promise<string | null> => {
        if (!imageFile) return null

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', imageFile)

            const response = await fetch('/api/upload/payment-proof', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Gagal mengupload gambar')
            }

            const data = await response.json()
            return data.url
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Gagal mengupload bukti transfer')
            return null
        } finally {
            setIsUploading(false)
        }
    }

    const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
        setIsLoading(true)

        try {
            let proofImageUrl: string | null = null
            if (imageFile) {
                proofImageUrl = await uploadImage()
                if (!proofImageUrl) {
                    setIsLoading(false)
                    return
                }
            }

            const response = await fetch(`/api/transactions/${transactionId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    investorId,
                    amount: values.amount,
                    paymentDate: new Date(values.paymentDate).toISOString(),
                    method: values.method,
                    proofImageUrl,
                    notes: values.notes,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Gagal menambahkan pembayaran')
            }

            const result = await response.json()

            toast.success(`Pembayaran berhasil ditambahkan! Status: ${result.paymentStatus}`)
            setIsOpen(false)
            reset()
            handleRemoveImage()

            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error('Error adding payment:', error)
            toast.error(error.message || 'Gagal menambahkan pembayaran')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Tambah Pembayaran
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            Tambah Pembayaran
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
                    <DialogDescription>
                        Catat pembayaran bagi hasil kepada pemodal
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Jumlah (Rp)</Label>
                        <div className="relative">
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                placeholder="Masukkan jumlah"
                                {...register('amount', { valueAsNumber: true })}
                                className={cn(
                                    "transition-all duration-500",
                                    isAnalyzingRef.current && "border-blue-400 bg-blue-50/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                )}
                            />
                            {isAnalyzingRef.current && (
                                <Sparkles className="h-4 w-4 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" />
                            )}
                        </div>
                        {errors.amount && (
                            <p className="text-sm text-red-500">{errors.amount.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="paymentDate">Tanggal Pembayaran</Label>
                        <Input
                            id="paymentDate"
                            type="date"
                            {...register('paymentDate')}
                        />
                        {errors.paymentDate && (
                            <p className="text-sm text-red-500">{errors.paymentDate.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="method">Metode Pembayaran</Label>
                        <Select
                            value={watch('method')}
                            onValueChange={(value: string) => setValue('method', value as 'TRANSFER' | 'CASH')}
                        >
                            <SelectTrigger id="method">
                                <SelectValue placeholder="Pilih metode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TRANSFER">Transfer</SelectItem>
                                <SelectItem value="CASH">Cash</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="proofImage">Bukti Transfer (Opsional)</Label>
                        {!imagePreview ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Input
                                        ref={fileInputRef}
                                        id="proofImage"
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                                        onChange={handleFileChange}
                                    />
                                    <Upload className="h-4 w-4" />
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p className="text-xs text-blue-800 font-medium flex items-center gap-1">
                                        💡 <span>Tips: Copy gambar dari WhatsApp, lalu tekan <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-mono">Ctrl+V</kbd> untuk paste langsung!</span>
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="border rounded p-2">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        {imageFile?.type.startsWith('image/') ? (
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full h-32 object-contain rounded"
                                            />
                                        ) : (
                                            <div className="w-full h-32 flex items-center justify-center bg-muted rounded">
                                                <p className="text-sm">{imageFile?.name}</p>
                                            </div>
                                        )}
                                        <p className="text-xs mt-1">
                                            {imageFile && formatFileSize(imageFile.size)}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveImage}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Format: JPG, PNG, atau PDF (Maks. 5MB)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Catatan (Opsional)</Label>
                        <Input
                            id="notes"
                            placeholder="Catatan pembayaran"
                            {...register('notes')}
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            disabled={isLoading || isUploading}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={isLoading || isUploading}>
                            {isLoading ? "Menyimpan..." : isUploading ? "Mengupload..." : "Simpan"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
