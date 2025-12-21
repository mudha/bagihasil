"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Pencil } from "lucide-react"

interface EditStatusDialogProps {
    transaction: {
        id: string
        transactionCode: string
        status: string
    }
    onSuccess?: () => void
}

export function EditStatusDialog({ transaction, onSuccess }: EditStatusDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [status, setStatus] = useState(transaction.status)
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (status === transaction.status) {
            toast.info("Status tidak berubah")
            setIsOpen(false)
            return
        }

        setIsLoading(true)

        try {
            const res = await fetch(`/api/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })

            if (res.ok) {
                toast.success("Status transaksi berhasil diubah")
                setIsOpen(false)
                if (onSuccess) {
                    onSuccess()
                }
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal mengubah status")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Pencil className="h-4 w-4 mr-2" /> Status
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Status Transaksi</DialogTitle>
                    <DialogDescription>
                        Ubah status untuk transaksi {transaction.transactionCode}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger id="status">
                                <SelectValue placeholder="Pilih status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ON_PROCESS">ON_PROCESS</SelectItem>
                                <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Note: Mengubah ke COMPLETED memerlukan data sell date dan sell price yang sudah ada.
                        </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
