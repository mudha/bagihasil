"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useForm, Controller } from "react-hook-form"
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
import { DollarSign, Lightbulb, Loader2, Upload, X } from "lucide-react"
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
        control,
        formState: { errors },
    } = useForm<z.infer<typeof paymentSchema>>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            amount: 0, // Add default value to prevent uncontrolled->controlled error
            paymentDate: new Date().toISOString().split('T')[0],
            method: 'TRANSFER',
        }
    })

    // Ref for AI analysis
    const isAnalyzingRef = useRef(false)
    const idempotencyKeyRef = useRef<string | null>(null)
    const proofImageUrlRef = useRef<string | null>(null)

    const analyzeImage = useCallback(async (file: File) => {
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
    }, [setValue, watch])

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

                    proofImageUrlRef.current = null
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
    }, [isOpen, analyzeImage])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const validation = validateImageFile(file)
        if (!validation.valid) {
            toast.error(validation.error)
            return
        }

        proofImageUrlRef.current = null
        setImageFile(file)
        analyzeImage(file) // Trigger AI analysis

        const reader = new FileReader()
        reader.onloadend = () => {
            setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveImage = () => {
        proofImageUrlRef.current = null
        setImageFile(null)
        setImagePreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
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
        idempotencyKeyRef.current ??= crypto.randomUUID()

        try {
            let proofImageUrl = proofImageUrlRef.current
            if (imageFile && !proofImageUrl) {
                proofImageUrl = await uploadImage()
                if (!proofImageUrl) {
                    setIsLoading(false)
                    return
                }
                proofImageUrlRef.current = proofImageUrl
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
                    idempotencyKey: idempotencyKeyRef.current,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw Object.assign(new Error(error.error || 'Gagal menambahkan pembayaran'), {
                    status: response.status,
                })
            }

            const result = await response.json()

            toast.success(`Pembayaran berhasil ditambahkan! Status: ${result.paymentStatus}`)
            setIsOpen(false)
            reset()
            handleRemoveImage()
            idempotencyKeyRef.current = null
            proofImageUrlRef.current = null

            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error('Error adding payment:', error)
            if (error.status === 400 || error.status === 409) {
                // A corrected submission is a new logical request, but reuse the
                // already-uploaded proof URL to avoid creating an orphan upload.
                idempotencyKeyRef.current = null
            }
            toast.error(error.message || 'Gagal menambahkan pembayaran')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            idempotencyKeyRef.current = null
            proofImageUrlRef.current = null
        }
        setIsOpen(open)
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Tambah Pembayaran
                </Button>
            </DialogTrigger>
            <DialogContent className="grid h-[min(92dvh,760px)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:rounded-2xl">
                <DialogHeader className="border-b bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-16 text-left text-white sm:px-6 sm:py-5 sm:pr-20">
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            Tambah Pembayaran
                        </span>
                        {isAnalyzingRef.current ? (
                            <span className="text-xs font-medium text-blue-600 animate-pulse flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                                <Loader2 className="h-3 w-3 text-blue-500 animate-spin motion-reduce:animate-none" />
                                AI Menganalisis...
                            </span>
                        ) : (
                            <span className="text-[10px] items-center text-muted-foreground bg-muted/50 px-2 py-1 rounded-full border border-border hidden sm:inline-flex">
                                AI Powered
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-teal-50/75">
                        Catat pembayaran bagi hasil kepada pemodal
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Jumlah (Rp)</Label>
                        <div className="relative">
                            <Controller
                                control={control}
                                name="amount"
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        placeholder="Masukkan jumlah"
                                        value={field.value === 0 ? '' : field.value}
                                        onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                        className={cn(
                                            "transition-all duration-500",
                                            isAnalyzingRef.current && "border-blue-400 dark:border-blue-300 bg-blue-50/50 shadow-[0_0_10px_rgba(59,130,246,0.2)] dark:bg-blue-950/35"
                                        )}
                                    />
                                )}
                            />
                            {isAnalyzingRef.current && (
                                <Loader2 className="h-4 w-4 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse motion-reduce:animate-none dark:text-blue-300" />
                            )}
                        </div>
                        {errors.amount && (
                            <p className="text-sm text-red-500 dark:text-red-400">{errors.amount.message}</p>
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
                            <p className="text-sm text-red-500 dark:text-red-400">{errors.paymentDate.message}</p>
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
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="proofImage">Bukti Transfer (Opsional)</Label>
                            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{imageFile ? 1 : 0}/1</span>
                        </div>
                        <input
                            ref={fileInputRef}
                            id="proofImage"
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,application/pdf"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        {!imagePreview ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:hover:border-blue-300 dark:hover:bg-blue-950/40 dark:ring-blue-950/40"
                            >
                                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40"><Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" /></span>
                                <span className="text-sm font-medium text-foreground">Klik untuk Upload</span>
                                <span className="mt-1 text-xs text-muted-foreground">Pilih file atau paste (Ctrl+V)</span>
                            </button>
                        ) : (
                            <div className="relative overflow-hidden rounded-lg border bg-muted/50 p-2">
                                <div className="relative h-40 w-full">
                                    {imageFile?.type.startsWith('image/') ? (
                                        <Image src={imagePreview} alt="Preview bukti transfer" fill className="rounded object-contain" style={{ top: 0, left: 0 }} />
                                    ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{imageFile?.name}</div>}
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span className="truncate">{imageFile?.name}</span><span>{imageFile && formatFileSize(imageFile.size)}</span>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-9 w-9 bg-card/90 text-red-600 dark:text-red-400 shadow" onClick={handleRemoveImage} aria-label="Hapus bukti"><X className="h-4 w-4" /></Button>
                            </div>
                        )}
                        <div className="flex items-start gap-1.5 rounded-lg border border-blue-200 dark:border-blue-300 bg-blue-50 dark:bg-blue-950/40 p-3 text-xs text-blue-800 dark:text-blue-300"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" /> <span>Copy gambar dari WhatsApp, lalu tekan <kbd className="rounded border border-blue-300 dark:border-blue-300 bg-card px-1.5 py-0.5 font-mono">Ctrl+V</kbd> untuk paste langsung.</span></div>
                        <p className="text-xs text-muted-foreground">Format: JPG, PNG, atau PDF (Maks. 5MB)</p>
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
                            onClick={() => handleDialogOpenChange(false)}
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
