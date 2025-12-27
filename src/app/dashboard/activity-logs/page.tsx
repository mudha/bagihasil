"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { History, Loader2 } from "lucide-react"

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

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch("/api/activity-logs")
                if (res.ok) {
                    const data = await res.json()
                    setLogs(data)
                }
            } catch (error) {
                console.error("Failed to fetch logs", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchLogs()
    }, [])

    const getActionColor = (action: string) => {
        switch (action) {
            case "CREATE": return "default"
            case "UPDATE": return "outline" // blue-ish usually
            case "DELETE": return "destructive"
            default: return "secondary"
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Log Aktivitas</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Riwayat Perubahan Data
                    </CardTitle>
                    <CardDescription>
                        Mencatat 50 aktivitas terakhir di sistem.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4">
                                {logs.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm border rounded-md bg-slate-50">
                                        Belum ada aktivitas tercatat.
                                    </div>
                                ) : (
                                    logs.map((log) => (
                                        <div key={log.id} className="border rounded-lg p-4 space-y-3 bg-white dark:bg-slate-950 shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={getActionColor(log.action) as any} className="text-[10px] h-5 px-1.5">
                                                        {log.action}
                                                    </Badge>
                                                    <span className="text-xs font-mono text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {log.entity}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(log.createdAt), "dd MMM HH:mm", { locale: id })}
                                                </span>
                                            </div>

                                            <div className="text-sm">
                                                <p className="line-clamp-3 text-foreground/90">{log.details || "-"}</p>
                                            </div>

                                            <div className="pt-2 border-t mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {(log.userName || "S").charAt(0).toUpperCase()}
                                                </div>
                                                <span>{log.userName || "System"}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block">
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
                                        {logs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">
                                                    Belum ada aktivitas tercatat.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            logs.map((log) => (
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
                                            ))
                                        )}
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
