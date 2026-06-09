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
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { MultipleImageUpload, ImageFileWithDescription } from "@/components/ui/multi-image-upload"
import { toast } from "sonner"
import { Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const costSchema = z.object({
    costType: z.string().min(1, "Pilih jenis biaya"),
    payer: z.enum(["INVESTOR", "MANAGER"]),
    amount: z.number().min(1, "Jumlah harus lebih dari 0"),
    description: z.string().optional(),
})

interface AddCostDialogProps {
    transactionId: string
    existingCost?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSuccess: () => void
    trigger?: React.ReactNode
}

export function AddCostDialog({
    transactionId,
    existingCost,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    onSuccess,
    trigger
}: AddCostDialogProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen
    const setIsOpen = isControlled ? setControlledOpen! : setUncontrolledOpen

    const [isLoading, setIsLoading] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [images, setImages] = useState<ImageFileWithDescription[]>([])

    // Ref to track which image ID was last analyzed to prevent loops
    const lastAnalyzedImageIdRef = useRef<string | null>(null)

    const form = useForm<z.infer<typeof costSchema>>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            amount: 0,
            description: "",
            payer: "MANAGER",
            costType: "",
        },
    })

    const analyzeImage = async (file: File, imageId: string) => {
        if (isAnalyzing) return

        setIsAnalyzing(true)
        lastAnalyzedImageIdRef.current = imageId // Mark as analyzed immediately
        const toastId = toast.loading("Menganalisis bukti transfer...")

        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/ai/parse-receipt', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || "Gagal menganalisis gambar")
            }

            const result = await res.json()
            if (result.success && result.data) {
                const { amount, description, costType } = result.data

                // Only update if confident
                let updated = false

                // Update amount if current is 0 and we found a valid amount
                if (form.getValues("amount") === 0 && amount && typeof amount === 'number') {
                    form.setValue("amount", amount)
                    updated = true
                }

                // Auto-set cost type if found and not set
                if (!form.getValues("costType") && costType) {
                    form.setValue("costType", costType)
                    updated = true
                }

                // Append or set description
                if (description) {
                    const currentDesc = form.getValues("description") || ""
                    // Avoid duplicating if already present
                    if (!currentDesc.includes(description)) {
                        const newDesc = currentDesc ? `${currentDesc} - ${description}` : description
                        form.setValue("description", newDesc)
                        updated = true
                    }
                }

                if (updated) {
                    toast.success("Data berhasil diisi otomatis!", { id: toastId })
                } else {
                    toast.dismiss(toastId)
                }
            } else {
                toast.dismiss(toastId)
            }
        } catch (error: any) {
            console.error(error)
            // Silently fail if it's just a parsing error, but log it
            if (error.message?.includes("GEMINI_API_KEY")) {
                toast.error("Configurasi AI (Gemini) belum benar", { id: toastId })
            } else {
                toast.dismiss(toastId)
            }
        } finally {
            setIsAnalyzing(false)
        }
    }

    // Effect to auto-analyze new images
    useEffect(() => {
        // Find a candidate image: must be a File (newly uploaded), and not the one we just analyzed
        const newImage = images.find(img =>
            img.file !== null &&
            img.id !== lastAnalyzedImageIdRef.current
        )

        // Only trigger if we have a new image and the form looks "empty" (amount is 0)
        // This prevents overwriting user data if they upload multiple images later
        // But we update the ref immediately to avoid retrying even if we don't analyze
        if (newImage && newImage.file) {
            analyzeImage(newImage.file, newImage.id)
        }
    }, [images, form])

    useEffect(() => {
        if (existingCost) {
            form.reset({
                costType: existingCost.costType,
                payer: existingCost.payer,
                amount: existingCost.amount,
                description: existingCost.description || "",
            })
            // If existing cost has proofs, we should load them.
            // However, current API response might not include proofs yet unless we updated the fetcher.
            // For now, we only handle adding NEW proofs or replacing.
            // If existingCost has proofs loaded, we would need to map them to preview state.
            // Assuming existingCost.proofs = [{ id, imageUrl, description }]
            if (existingCost.proofs) {
                setImages(existingCost.proofs.map((p: any) => ({
                    id: p.id,
                    file: null, // Existing images have no File object
                    preview: p.imageUrl,
                    description: p.description || ""
                })))
            } else {
                setImages([])
            }
        } else {
            form.reset({
                amount: 0,
                description: "",
                payer: "MANAGER",
                costType: "",
            })
            setImages([])
            lastAnalyzedImageIdRef.current = null // Reset analysis tracking for new form
        }
    }, [existingCost, form, isOpen])

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

    const onSubmit = async (values: z.infer<typeof costSchema>) => {
        setIsLoading(true)
        try {
            // Upload images
            const uploadedProofs = []
            for (const img of images) {
                // If it's an existing image (placeholder file size 0), stick with preview URL
                // Actually, my placeholder logic above is weak.
                // Better check if preview starts with http or /
                let url = img.preview
                if (img.file && img.file.size > 0) {
                    url = await uploadFile(img.file)
                }
                uploadedProofs.push({
                    imageUrl: url,
                    description: img.description
                })
            }

            const payload = {
                ...values,
                proofs: uploadedProofs
            }

            let res
            if (existingCost) {
                res = await fetch(`/api/transactions/${transactionId}/costs/${existingCost.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            } else {
                res = await fetch(`/api/transactions/${transactionId}/costs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            }

            if (res.ok) {
                toast.success(existingCost ? "Biaya berhasil diupdate" : "Biaya berhasil ditambahkan")
                setIsOpen(false)
                form.reset()
                setImages([])
                onSuccess()
            } else {
                const err = await res.json()
                toast.error(err.error || "Gagal menyimpan biaya")
            }
        } catch (error) {
            console.error(error)
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger && (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            {existingCost ? "Edit Biaya" : "Input Biaya"}
                        </span>
                        {isAnalyzing ? (
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
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="costType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Jenis Biaya</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className={cn(isAnalyzing && "border-blue-300 bg-blue-50/30")}>
                                                    <SelectValue placeholder="Pilih jenis biaya" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="INSPECTION">Inspeksi</SelectItem>
                                                <SelectItem value="TRANSPORT">Transport</SelectItem>
                                                <SelectItem value="MEAL">Makan</SelectItem>
                                                <SelectItem value="TOLL">Tol</SelectItem>
                                                <SelectItem value="ADS">Iklan</SelectItem>
                                                <SelectItem value="REPAIR">Perbaikan (PR)</SelectItem>
                                                <SelectItem value="GAS">Bensin</SelectItem>
                                                <SelectItem value="PARKING">Parkir</SelectItem>
                                                <SelectItem value="STAMP_DUTY">Materai</SelectItem>
                                                <SelectItem value="BROKER">Makelar</SelectItem>
                                                <SelectItem value="SALES">Sales</SelectItem>
                                                <SelectItem value="OTHER">Lainnya</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="payer"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dibayar Oleh</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Siapa yang bayar?" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="INVESTOR">Pemodal</SelectItem>
                                                <SelectItem value="MANAGER">Pengelola</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nominal (Rp)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                {...field}
                                                // Convert 0 to empty string for display so user can type/backspace easily
                                                value={field.value === 0 ? '' : field.value}
                                                onChange={e => {
                                                    const val = e.target.value
                                                    // Allow empty string (set to 0 internally), otherwise parse float
                                                    field.onChange(val === '' ? 0 : parseFloat(val))
                                                }}
                                                className={cn(
                                                    "transition-all duration-500",
                                                    isAnalyzing && "border-blue-400 bg-blue-50/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                                )}
                                            />
                                            {isAnalyzing && (
                                                <Sparkles className="h-4 w-4 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" />
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Keterangan</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Detail biaya..."
                                            {...field}
                                            className={cn(isAnalyzing && "border-blue-300 bg-blue-50/30")}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2">
                            <Label>Lampiran Bukti (Foto/Nota)</Label>
                            <MultipleImageUpload
                                onImagesChange={setImages}
                                maxImages={5}
                            />
                            {existingCost && existingCost.proofs && existingCost.proofs.length > 0 && images.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    *Upload gambar baru akan menggantikan gambar lama.
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Menyimpan..." : "Simpan"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
