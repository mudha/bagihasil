"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { MultipleImageUpload, ImageFileWithDescription } from "@/components/ui/multi-image-upload"

interface UpdateTransactionProofDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: any
    type: 'BUY' | 'SELL'
    onSuccess: () => void
}

export function UpdateTransactionProofDialog({
    open,
    onOpenChange,
    transaction,
    type,
    onSuccess,
}: UpdateTransactionProofDialogProps) {
    // Stores the list of proofs
    const [proofs, setProofs] = useState<ImageFileWithDescription[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (open && transaction) {
            let initialProofs: ImageFileWithDescription[] = []

            const relevantProofs = transaction.proofs?.filter((p: any) => p.proofType === type) || []

            if (relevantProofs.length > 0) {
                initialProofs = relevantProofs.map((p: any) => ({
                    id: p.id,
                    file: new File([], "existing-image"), // Dummy file
                    preview: p.imageUrl,
                    description: p.description || ""
                }))
            } else {
                // Fallback to legacy fields
                const legacyUrl = type === 'BUY' ? transaction.buyProofImageUrl : transaction.sellProofImageUrl
                const legacyDesc = type === 'BUY' ? transaction.buyProofDescription : transaction.sellProofDescription

                if (legacyUrl) {
                    initialProofs.push({
                        id: 'legacy',
                        file: new File([], "existing-image"), // Dummy file
                        preview: legacyUrl,
                        description: legacyDesc || ""
                    })
                }
            }

            setProofs(initialProofs)
        }
    }, [open, transaction, type])

    const handleSubmit = async () => {
        try {
            setIsLoading(true)

            // 1. Upload new files
            const uploadedProofs = await Promise.all(
                proofs.map(async (proof) => {
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
                    return { imageUrl: proof.preview, description: proof.description }
                })
            )

            // 2. Prepare payload
            const updatePayload: any = {
                unitId: transaction.unitId,
                transactionCode: transaction.transactionCode,
                buyDate: transaction.buyDate,
                buyPrice: transaction.buyPrice,
                status: transaction.status,
                // Preserve legacy text fields if needed, or we can just ignore them as we move to proofs relation
            }

            if (type === 'BUY') {
                updatePayload.buyProofs = uploadedProofs
                // Explicitly clear legacy fields to prevent fallback issues
                updatePayload.buyProofImageUrl = null
                updatePayload.buyProofDescription = null
                // Preserve sell legacy fields if not touched
                if (transaction.sellProofImageUrl) updatePayload.sellProofImageUrl = transaction.sellProofImageUrl
                if (transaction.sellProofDescription) updatePayload.sellProofDescription = transaction.sellProofDescription
            } else {
                updatePayload.sellProofs = uploadedProofs
                // Explicitly clear legacy fields to prevent fallback issues
                updatePayload.sellProofImageUrl = null
                updatePayload.sellProofDescription = null
                // Preserve buy legacy fields if not touched
                if (transaction.buyProofImageUrl) updatePayload.buyProofImageUrl = transaction.buyProofImageUrl
                if (transaction.buyProofDescription) updatePayload.buyProofDescription = transaction.buyProofDescription
            }

            // Add other preserved fields
            if (transaction.sellDate) updatePayload.sellDate = transaction.sellDate
            if (transaction.sellPrice) updatePayload.sellPrice = transaction.sellPrice
            if (transaction.initialInvestorCapital) updatePayload.initialInvestorCapital = transaction.initialInvestorCapital
            if (transaction.initialManagerCapital) updatePayload.initialManagerCapital = transaction.initialManagerCapital
            if (transaction.notes) updatePayload.notes = transaction.notes

            const res = await fetch(`/api/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload),
            })

            if (res.ok) {
                toast.success("Bukti berhasil disimpan")
                onSuccess()
                onOpenChange(false)
            } else {
                const errorData = await res.json()
                let errorMessage = "Gagal menyimpan bukti"

                if (errorData.error) {
                    if (Array.isArray(errorData.error)) {
                        // Handle Zod array errors
                        errorMessage = errorData.error.map((e: any) => e.message || "Invalid input").join(", ")
                    } else if (typeof errorData.error === 'object') {
                        errorMessage = JSON.stringify(errorData.error)
                    } else {
                        errorMessage = errorData.error
                    }
                }

                toast.error(errorMessage)
            }
        } catch (error) {
            console.error("Submit error:", error)
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    const title = type === 'BUY' ? "Bukti Pembelian Unit (Dari Seller)" : "Bukti Penjualan Unit (Dari Pembeli)"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                    <MultipleImageUpload
                        key={type + open} // Force reset
                        initialImages={proofs}
                        onImagesChange={setProofs}
                        className="w-full"
                    />

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
