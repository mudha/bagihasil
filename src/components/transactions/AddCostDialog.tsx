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
import { Plus } from "lucide-react"

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
    const [images, setImages] = useState<ImageFileWithDescription[]>([])

    const form = useForm<z.infer<typeof costSchema>>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            amount: 0,
            description: "",
            payer: "INVESTOR",
            costType: "",
        },
    })

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
                    file: new File([], "existing_image"), // Placeholder file
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
                payer: "INVESTOR",
                costType: "",
            })
            setImages([])
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingCost ? "Edit Biaya Operasional" : "Input Biaya Operasional"}
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="costType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Jenis Biaya</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
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
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Keterangan</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Detail biaya..." {...field} />
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
