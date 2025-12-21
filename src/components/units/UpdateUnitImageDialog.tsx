"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { MultipleImageUpload, ImageFileWithDescription } from "@/components/ui/multi-image-upload"

interface UpdateUnitImageDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    unit: any
    onSuccess: () => void
}

export function UpdateUnitImageDialog({
    open,
    onOpenChange,
    unit,
    onSuccess
}: UpdateUnitImageDialogProps) {
    const [images, setImages] = useState<ImageFileWithDescription[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (open && unit?.imageUrl) {
            setImages([{
                id: 'existing-image',
                file: null,
                preview: unit.imageUrl,
                description: ""
            }])
        } else if (open) {
            setImages([])
        }
    }, [open, unit])

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)

            // Upload new image if present
            let imageUrl = unit.imageUrl

            const newImage = images.find(img => img.file)
            if (newImage && newImage.file) {
                const formData = new FormData()
                formData.append('file', newImage.file)

                // Using existing upload endpoint or we might need a general one
                // Let's use the payment-proof one for now as it just returns a URL
                // ideally we should have a generic upload
                const uploadRes = await fetch('/api/upload/payment-proof', {
                    method: 'POST',
                    body: formData
                })

                if (!uploadRes.ok) throw new Error("Failed to upload image")
                const uploadData = await uploadRes.json()
                imageUrl = uploadData.url
            } else if (images.length === 0) {
                imageUrl = null // Removed
            }

            const res = await fetch(`/api/units/${unit.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    investorId: unit.investorId,
                    name: unit.name,
                    plateNumber: unit.plateNumber,
                    code: unit.code,
                    status: unit.status,
                    imageUrl: imageUrl
                })
            })

            if (!res.ok) {
                const data = await res.json()
                // handle zod error
                if (data.error && Array.isArray(data.error)) {
                    const msgs = data.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
                    throw new Error(msgs)
                }
                throw new Error(data.error || "Failed to update unit")
            }

            toast.success("Foto unit berhasil diperbarui")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Terjadi kesalahan")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Update Foto Unit</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <MultipleImageUpload
                        key={open ? 'open' : 'closed'} // Force reset when reopening
                        initialImages={images}
                        onImagesChange={(newImages) => {
                            setImages(newImages)
                        }}
                        maxImages={1}
                    />

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
