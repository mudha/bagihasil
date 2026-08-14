"use client"

import { useState, useEffect } from "react"
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
    } | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSuccess?: () => void
}

export function EditStatusDialog({ transaction, open, onOpenChange, onSuccess }: EditStatusDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [status, setStatus] = useState(transaction?.status || "ON_PROCESS")
    const [isLoading, setIsLoading] = useState(false)

    // Derived state for controlled vs uncontrolled
    const isControlled = open !== undefined && onOpenChange !== undefined
    const isOpen = isControlled ? open : internalOpen
    const setOpen = isControlled ? onOpenChange : setInternalOpen

    useEffect(() => {
        if (transaction) {
            setStatus(transaction.status)
        }
    }, [transaction, isOpen])


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!transaction) return

        if (status === transaction.status) {
            toast.info("Status tidak berubah")
            setOpen(false)
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
                setOpen(false)
                if (onSuccess) {
                    onSuccess()
                }
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal mengubah status")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    if (!transaction && isControlled) return null

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <Pencil className="h-4 w-4 mr-2" /> Status
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Status Transaksi</DialogTitle>
                    <DialogDescription>
                        Ubah status untuk transaksi {transaction?.transactionCode}
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
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
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
