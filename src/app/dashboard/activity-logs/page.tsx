"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
import { OperationalPageHeader } from "@/components/mudha/OperationalPageHeader"
import { LoadingState } from "@/components/mudha/LoadingState"
import { ErrorState } from "@/components/mudha/ErrorState"
import { EmptyState } from "@/components/mudha/EmptyState"

interface Log {
    id: string
    action: string
    entity: string
    entityId: string
    details: string
    userName: string
    createdAt: string
}

export default function ActivityLogsPage() {
    const [logs, setLogs] = useState<Log[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [retryNonce, setRetryNonce] = useState(0)

    useEffect(() => {
        const fetchLogs = async () => {
            setLogs([])
            setError(null)
            setIsLoading(true)
            try {
                const res = await fetch("/api/activity-logs")
                if (res.status === 401 || res.status === 403) {
                    setError("Akses tidak tersedia")
                    return
                }
                if (!res.ok) {
                    throw new Error("Gagal memuat log aktivitas")
                }
                const data = await res.json()
                setLogs(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data")
            } finally {
                setIsLoading(false)
            }
        }
        fetchLogs()
    }, [retryNonce])

    if (isLoading) {
        return (
            <div className="flex-1 space-y-4">
                <OperationalPageHeader title="Log Aktivitas" description="Mencatat 50 aktivitas terakhir di sistem." />
                <LoadingState variant="table" label="Memuat log aktivitas…" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex-1 space-y-4">
                <OperationalPageHeader title="Log Aktivitas" description="Mencatat 50 aktivitas terakhir di sistem." />
                <ErrorState title="Gagal memuat log aktivitas" description={error} onRetry={() => setRetryNonce((n) => n + 1)} />
            </div>
        )
    }

    const getActionColor = (action: string) => {
        switch (action) {
            case "CREATE": return "default"
            case "UPDATE": return "outline"
            case "DELETE": return "destructive"
            default: return "secondary"
        }
    }

    return (
        <div className="flex-1 space-y-4">
            <OperationalPageHeader title="Log Aktivitas" description="Mencatat 50 aktivitas terakhir di sistem." />

            <Card className="border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] shadow-[var(--mudha-shadow-xs)]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Riwayat Perubahan Data
                    </CardTitle>
                    <CardDescription>
                        {logs.length === 0
                            ? "Belum ada aktivitas tercatat."
                            : `Menampilkan ${logs.length} aktivitas terakhir.`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <EmptyState
                            title="Belum ada aktivitas"
                            description="Aktivitas akan muncul di sini setelah ada perubahan data."
                            icon={<History className="h-6 w-6" />}
                        />
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="space-y-4 lg:hidden">
                                {logs.map((log) => (
                                    <div key={log.id} className="rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-4 shadow-[var(--mudha-shadow-xs)] space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={getActionColor(log.action) as any} className="text-[10px] h-5 px-1.5">
                                                    {log.action}
                                                </Badge>
                                                <span className="text-xs font-mono text-[var(--mudha-text-muted)] bg-[var(--mudha-surface-subtle)] px-1.5 py-0.5 rounded">
                                                    {log.entity}
                                                </span>
                                            </div>
                                            <span className="text-xs text-[var(--mudha-text-muted)] whitespace-nowrap">
                                                {format(new Date(log.createdAt), "dd MMM HH:mm", { locale: id })}
                                            </span>
                                        </div>

                                        <div className="text-sm">
                                            <p className="line-clamp-3 text-[var(--mudha-text)]">{log.details || "-"}</p>
                                        </div>

                                        <div className="pt-2 border-t border-[var(--mudha-border-subtle)] mt-2 flex items-center gap-2 text-xs text-[var(--mudha-text-muted)]">
                                            <div className="w-5 h-5 rounded-full bg-[var(--mudha-surface-subtle)] flex items-center justify-center text-[10px] font-bold text-[var(--mudha-text-secondary)]">
                                                {(log.userName || "S").charAt(0).toUpperCase()}
                                            </div>
                                            <span>{log.userName || "System"}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden lg:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Waktu</TableHead>
                                            <TableHead>User</TableHead>
                                            <TableHead>Aksi</TableHead>
                                            <TableHead>Entitas</TableHead>
                                            <TableHead>Detail</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="whitespace-nowrap font-medium">
                                                    {format(new Date(log.createdAt), "dd MMM HH:mm", { locale: id })}
                                                </TableCell>
                                                <TableCell>{log.userName || "System"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getActionColor(log.action) as any}>
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{log.entity}</TableCell>
                                                <TableCell className="max-w-md truncate" title={log.details}>
                                                    {log.details || "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}