
"use client"

import { useState } from "react"
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { toast } from "sonner"
import { Pencil } from "lucide-react"

const profitSharingSchema = z.object({
    investorSharePercentage: z.number().min(0).max(100),
    managerSharePercentage: z.number().min(0).max(100),
}).refine(data => Math.abs((data.investorSharePercentage + data.managerSharePercentage) - 100) < 0.1, {
    message: "Total persentase harus 100%",
    path: ["managerSharePercentage"] // Attach error to manager share
})

type ProfitSharingFormValues = z.infer<typeof profitSharingSchema>

interface EditProfitSharingDialogProps {
    transactionId: string
    currentInvestorShare: number
    currentManagerShare: number
    onSuccess: () => void
}

export function EditProfitSharingDialog({
    transactionId,
    currentInvestorShare,
    currentManagerShare,
    onSuccess
}: EditProfitSharingDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<ProfitSharingFormValues>({
        resolver: zodResolver(profitSharingSchema),
        defaultValues: {
            investorSharePercentage: currentInvestorShare,
            managerSharePercentage: currentManagerShare,
        },
    })

    const onSubmit = async (values: z.infer<typeof profitSharingSchema>) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/transactions/${transactionId}/profit-sharing`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })

            if (res.ok) {
                toast.success("Pembagian profit berhasil diupdate")
                setOpen(false)
                onSuccess()
            } else {
                const error = await res.json()
                toast.error(error.error || "Gagal mengupdate pembagian profit")
            }
        } catch (error) {
            console.error(error)
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                    <Pencil className="h-4 w-4 text-green-700" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Edit Pembagian Profit</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="investorSharePercentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bagi Hasil Pemodal (%)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value) || 0
                                                field.onChange(val)
                                                // Auto-calculate manager share
                                                if (val <= 100) {
                                                    form.setValue('managerSharePercentage', 100 - val)
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="managerSharePercentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bagi Hasil Pengelola (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
