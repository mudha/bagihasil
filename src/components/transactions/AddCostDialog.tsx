"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { COST_TYPE_OPTIONS } from "@/lib/cost-types"

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

    const analyzeImage = useCallback(async (file: File, imageId: string) => {
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
    }, [form, isAnalyzing])

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
    }, [images, analyzeImage])

    useEffect(() => {
        if (existingCost) {
            form.reset({
                costType: existingCost.costType,
                payer: existingCost.payer,
                amount: existingCost.amount,
                description: existingCost.description || "",
            })
            // Bukti biaya dikelola melalui dialog khusus agar edit metadata
            // tidak pernah menghapus atau mengganti lampiran secara tidak sengaja.
            setImages([])
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
            const payload: z.infer<typeof costSchema> & {
                proofs?: { imageUrl: string; description: string }[]
            } = { ...values }

            // Lampiran hanya dikirim saat membuat biaya baru. Saat mengedit,
            // tidak adanya field `proofs` membuat API mempertahankan bukti lama.
            if (!existingCost) {
                const uploadedProofs = []
                for (const img of images) {
                    let url = img.preview
                    if (img.file && img.file.size > 0) {
                        url = await uploadFile(img.file)
                    }
                    uploadedProofs.push({
                        imageUrl: url,
                        description: img.description
                    })
                }
                payload.proofs = uploadedProofs
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
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 animate-pulse flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-full border border-blue-100">
                                <Sparkles className="h-3 w-3 text-blue-500 dark:text-blue-400 animate-spin-slow" />
                                AI Menganalisis...
                            </span>
                        ) : (
                            <span className="text-[10px] items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-1 rounded-full border border-border hidden sm:flex">
                                <Sparkles className="h-3 w-3 text-purple-400 dark:text-purple-300" />
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
                                                <SelectTrigger className={cn(isAnalyzing && "border-blue-300 dark:border-blue-300 bg-blue-50/30")}>
                                                    <SelectValue placeholder="Pilih jenis biaya" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="z-[110]">
                                                {COST_TYPE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
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
                                            <SelectContent className="z-[110]">
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
                                                    isAnalyzing && "border-blue-400 dark:border-blue-300 bg-blue-50/50 shadow-[0_0_10px_rgba(59,130,246,0.2)] dark:bg-blue-950/35"
                                                )}
                                            />
                                            {isAnalyzing && (
                                                <Sparkles className="h-4 w-4 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse dark:text-blue-300" />
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
                                            className={cn(isAnalyzing && "border-blue-300 dark:border-blue-300 bg-blue-50/30")}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {existingCost ? (
                            <div className="rounded-lg border border-blue-200 dark:border-blue-300 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-900 dark:text-blue-300">
                                <p className="font-medium">Bukti biaya tetap tersimpan saat data ini diedit.</p>
                                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                                    Gunakan tombol Kelola Bukti pada tabel jika ingin menambah atau menghapus lampiran.
                                    {existingCost.proofs?.length > 0 && ` Saat ini ada ${existingCost.proofs.length} bukti.`}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Lampiran Bukti (Foto/Nota)</Label>
                                <MultipleImageUpload
                                    onImagesChange={setImages}
                                    maxImages={5}
                                />
                            </div>
                        )}

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
