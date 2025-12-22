"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { MultipleImageUpload, ImageFileWithDescription } from "@/components/ui/multi-image-upload"

interface Cost {
    id: string
    costType: string
    payer: string
    amount: number
    description?: string
    proofs: { id?: string; imageUrl: string; description?: string }[]
}

interface ManageCostProofsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transactionId: string
    cost: Cost
    onSuccess: () => void
}

export function ManageCostProofsDialog({
    open,
    onOpenChange,
    transactionId,
    cost,
    onSuccess,
}: ManageCostProofsDialogProps) {
    const [proofs, setProofs] = useState<ImageFileWithDescription[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Transform initial cost proofs to ImageFileWithDescription format
    // Note: MultipleImageUpload expects file object for new images, but we only have URL for existing.
    // We need to support "existing images" in MultipleImageUpload? 
    // The current MultipleImageUpload logic seems to assume everything has a 'file' property (see handleRemove, render).
    // However, for existing images, we don't have a File object.
    // I should create a dummy File or update MultipleImageUpload to handle URL-only images.
    // Let's modify MultipleImageUpload to allow file as optional if preview is present?
    // In MultipleImageUpload: 
    // interface ImageFileWithDescription { id: string; file: File; ... }
    // It requires File.
    // Hack: Create a dummy File object for existing images.

    // Better: Update MultipleImageUpload to handle this properly, but for speed, I'll create dummy files.

    const getInitialImages = (): ImageFileWithDescription[] => {
        if (!cost?.proofs) return []
        return cost.proofs.map(p => ({
            id: p.id || Math.random().toString(36).substr(2, 9),
            file: new File([], "existing-image"), // Dummy file
            preview: p.imageUrl,
            description: p.description || ""
        }))
    }

    const handleSubmit = async () => {
        try {
            setIsLoading(true)

            // 1. Upload new files (those with real size > 0)
            const uploadedProofs = await Promise.all(
                proofs.map(async (proof) => {
                    // If it's a new file (size > 0), upload it
                    if (proof.file && proof.file.size > 0) {
                        const formData = new FormData()
                        formData.append('file', proof.file)

                        const uploadRes = await fetch('/api/upload/payment-proof', {
                            method: 'POST',
                            body: formData,
                        })

                        if (!uploadRes.ok) throw new Error('Gagal mengupload gambar')
                        const { url } = await uploadRes.json()
                        return { imageUrl: url, description: proof.description }
                    }
                    // If it's existing image (dummy file size 0), keep url
                    return { imageUrl: proof.preview, description: proof.description }
                })
            )

            // 2. Prepare full payload (Cost PUT requires all fields)
            const payload = {
                costType: cost.costType,
                payer: cost.payer,
                amount: cost.amount,
                description: cost.description || "",
                proofs: uploadedProofs
            }

            const res = await fetch(`/api/transactions/${transactionId}/costs/${cost.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                toast.success("Bukti biaya berhasil disimpan")
                onSuccess()
                onOpenChange(false)
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal menyimpan bukti biaya")
            }
        } catch (error) {
            console.error("Submit error details:", error)
            toast.error(error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan bukti")
        } finally {
            setIsLoading(false)
        }
    }

    // Force re-render when cost changes to reset initial images?
    // MultipleImageUpload uses initialImages in useState initializer, so it won't update on prop change unless we key it.

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Kelola Bukti Biaya: {cost.costType}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    <MultipleImageUpload
                        key={cost.id + open} // Force reset when opening
                        initialImages={getInitialImages()}
                        onImagesChange={setProofs}
                        className="w-full"
                    />

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Batal
                        </Button>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? "Menyimpan..." : "Simpan Bukti"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
