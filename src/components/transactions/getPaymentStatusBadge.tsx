/**
 * Payment status badge for a transaction.
 * Extracted from transactions/page.tsx for maintainability.
 *
 * This function is pure — no hooks, no network, no state.
 */
import React from "react"
import { Badge } from "../ui/badge"
import { CheckCircle2, AlertCircle } from "lucide-react"

export interface PaymentStatusTx {
    status: string
    sellDate?: string | null
    _count?: {
        paymentHistories: number
    }
}

export function getPaymentStatusBadge(transaction: PaymentStatusTx) {
    if (transaction.status !== "COMPLETED") {
        return <span className="text-xs text-muted-foreground">-</span>
    }

    // Check if legacy transaction (sold before: Jan 1, 2026)
    if (transaction.sellDate) {
        const sellDate = new Date(transaction.sellDate)
        const appCreationDate = new Date("2026-01-01")
        // Reset time part to compare dates only
        sellDate.setHours(0, 0, 0, 0)
        appCreationDate.setHours(0, 0, 0, 0)

        if (sellDate < appCreationDate) {
            return (
                <Badge variant="default" className="bg-emerald-600 gap-1 dark:bg-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Lunas
                </Badge>
            )
        }
    }

    const paymentCount = transaction._count?.paymentHistories || 0

    if (paymentCount > 0) {
        return (
            <Badge variant="default" className="bg-emerald-600 gap-1 dark:bg-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Lunas
            </Badge>
        )
    }

    return (
        <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 gap-1">
            <AlertCircle className="h-3 w-3" />
            Belum Bayar
        </Badge>
    )
}
