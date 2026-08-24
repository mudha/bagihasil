"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, CircleDollarSign, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatRupiahOrNull } from "@/lib/rupiah-format"
import {
    formatManagedCapitalTimestamp,
    getManagedCapitalSummaryFromResponse,
    getSelfManagedCapitalUnavailableLabel,
} from "@/lib/managed-capital-self-ui"
import type { ManagedCapitalSummary } from "@/lib/managed-capital-ui-contract"

type SelfViewState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "loaded"; summary: ManagedCapitalSummary }
    | { kind: "missing" }

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-950 [overflow-wrap:anywhere]">{value}</p>
        </div>
    )
}

export function ManagedCapitalSelfCard() {
    const [state, setState] = useState<SelfViewState>({ kind: "loading" })
    const requestId = useRef(0)
    const controller = useRef<AbortController | null>(null)

    const fetchSummary = useCallback(async () => {
        const id = ++requestId.current
        controller.current?.abort()
        const nextController = new AbortController()
        controller.current = nextController
        setState({ kind: "loading" })
        try {
            const response = await fetch("/api/investors/me/capital-summary", {
                signal: nextController.signal,
                cache: "no-store",
            })
            if (id !== requestId.current) return
            if (response.status === 404) {
                setState({ kind: "missing" })
                return
            }
            if (!response.ok) {
                setState({ kind: "error", message: getSelfManagedCapitalUnavailableLabel("error") })
                return
            }
            const data: unknown = await response.json()
            const summary = getManagedCapitalSummaryFromResponse(data)
            if (!summary) {
                setState({ kind: "missing" })
                return
            }
            setState({ kind: "loaded", summary })
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return
            if (id === requestId.current) setState({ kind: "error", message: getSelfManagedCapitalUnavailableLabel("error") })
        }
    }, [])

    useEffect(() => {
        void fetchSummary()
        return () => controller.current?.abort()
    }, [fetchSummary])

    if (state.kind === "loading") {
        return <Card aria-busy="true" className="border-teal-900/10 shadow-sm"><CardContent className="p-5"><div className="h-24 animate-pulse rounded-md bg-slate-100" aria-label="Memuat ringkasan modal kelolaan" /></CardContent></Card>
    }

    if (state.kind === "error" || state.kind === "missing") {
        return (
            <Card className="border-teal-900/10 shadow-sm">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <p role="alert" className="text-sm text-muted-foreground">{state.kind === "error" ? state.message : getSelfManagedCapitalUnavailableLabel("missing")}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void fetchSummary()}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
                    </Button>
                </CardContent>
            </Card>
        )
    }

    const { summary } = state
    return (
        <Card className="border-teal-900/10 bg-white shadow-sm">
            <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-950">
                    <CircleDollarSign className="h-5 w-5 text-teal-700" aria-hidden="true" />
                    Modal Kelolaan Saya
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-2 sm:p-5 sm:pt-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Metric label="Saldo Modal Kelolaan Saat Ini" value={formatRupiahOrNull(summary.managedCapitalBalance)} />
                    <Metric label="Modal Sedang Dialokasikan" value={formatRupiahOrNull(summary.activeAllocatedInvestorCapital)} />
                    <Metric label="Sisa Modal Tersedia" value={formatRupiahOrNull(summary.availableManagedCapital)} />
                </div>
                {summary.managedCapitalBalanceUpdatedAt && (
                    <p className="text-xs text-muted-foreground">
                        Saldo manual terakhir diperbarui: {formatManagedCapitalTimestamp(summary.managedCapitalBalanceUpdatedAt)}
                    </p>
                )}
                {summary.warnings.map((warning) => (
                    <Alert key={warning.code} variant="destructive" role="alert">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        <AlertDescription>{warning.message}</AlertDescription>
                    </Alert>
                ))}
            </CardContent>
        </Card>
    )
}
