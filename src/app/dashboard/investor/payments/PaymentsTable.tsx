"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { ViewImageDialog } from "@/components/ui/view-image-dialog"

interface PaymentData {
    id: string
    paymentDate: Date | string
    amount: number
    method: string
    proofImageUrl: string | null
    notes: string | null
    transaction: {
        unit: {
            name: string
        }
    } | null
}

interface PaymentsTableProps {
    data: PaymentData[]
}

export function PaymentsTable({ data }: PaymentsTableProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>({
        key: 'paymentDate',
        direction: 'desc'
    })

    const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val)

    const filteredData = data.filter(pay => {
        const unitName = pay.transaction?.unit.name.toLowerCase() || ""
        const notes = pay.notes?.toLowerCase() || ""
        const query = searchQuery.toLowerCase()
        return unitName.includes(query) || notes.includes(query)
    })

    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0
        const { key, direction } = sortConfig

        let valA: any
        let valB: any

        if (key === 'unitName') {
            valA = a.transaction?.unit.name || ""
            valB = b.transaction?.unit.name || ""
        } else {
            valA = (a as any)[key]
            valB = (b as any)[key]
        }

        if (valA < valB) return direction === "asc" ? -1 : 1
        if (valA > valB) return direction === "asc" ? 1 : -1
        return 0
    })

    const requestSort = (key: string) => {
        let direction: "asc" | "desc" = "asc"
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc"
        }
        setSortConfig({ key, direction })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 max-w-sm">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari unit atau catatan..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("paymentDate")} className="hover:bg-transparent px-0 font-bold">
                                    Tanggal
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("unitName")} className="hover:bg-transparent px-0 font-bold">
                                    Unit
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("amount")} className="hover:bg-transparent px-0 font-bold">
                                    Jumlah
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("method")} className="hover:bg-transparent px-0 font-bold">
                                    Metode
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>Bukti</TableHead>
                            <TableHead>Catatan</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada riwayat pembayaran"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedData.map(pay => (
                                <TableRow key={pay.id}>
                                    <TableCell>
                                        {format(new Date(pay.paymentDate), "dd MMM yyyy", { locale: id })}
                                    </TableCell>
                                    <TableCell>
                                        {pay.transaction?.unit.name || "-"}
                                    </TableCell>
                                    <TableCell className="font-bold text-emerald-600">
                                        {formatCurrency(pay.amount)}
                                    </TableCell>
                                    <TableCell>{pay.method}</TableCell>
                                    <TableCell>
                                        <ViewImageDialog imageUrl={pay.proofImageUrl || ""} />
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={pay.notes || ""}>
                                        {pay.notes || "-"}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
