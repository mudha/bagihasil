"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface InvestmentUnit {
    id: string
    name: string
    plateNumber: string | null
    status: string
    capital: number
    sellPrice: number
    transactionStatus: string
}

interface InvestmentsTableProps {
    data: InvestmentUnit[]
}

export function InvestmentsTable({ data }: InvestmentsTableProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [sortConfig, setSortConfig] = useState<{ key: keyof InvestmentUnit, direction: "asc" | "desc" } | null>(null)

    const filteredData = data.filter(unit => {
        const query = searchQuery.toLowerCase()
        return (
            unit.name.toLowerCase().includes(query) ||
            (unit.plateNumber?.toLowerCase().includes(query) ?? false) ||
            unit.status.toLowerCase().includes(query) ||
            unit.transactionStatus.toLowerCase().includes(query)
        )
    })

    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0

        const { key, direction } = sortConfig

        if (a[key] === null) return 1
        if (b[key] === null) return -1
        if (a[key] === null && b[key] === null) return 0

        if (a[key] < b[key]) {
            return direction === "asc" ? -1 : 1
        }
        if (a[key] > b[key]) {
            return direction === "asc" ? 1 : -1
        }
        return 0
    })

    const requestSort = (key: keyof InvestmentUnit) => {
        let direction: "asc" | "desc" = "asc"
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc"
        }
        setSortConfig({ key, direction })
    }

    const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari unit atau status..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {sortedData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada investasi"}
                    </div>
                ) : (
                    sortedData.map(unit => (
                        <div key={unit.id} className="border rounded-lg p-4 space-y-3 bg-card">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-base">{unit.name}</h3>
                                    <p className="text-sm text-muted-foreground">{unit.plateNumber}</p>
                                </div>
                                <Badge variant={unit.status === "SOLD" ? "secondary" : "default"} className="ml-2">
                                    {unit.status}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs">Modal Awal</p>
                                    <p className="font-medium">{unit.capital > 0 ? formatCurrency(unit.capital) : "-"}</p>
                                </div>
                                {unit.sellPrice > 0 && (
                                    <div>
                                        <p className="text-muted-foreground text-xs">Harga Jual</p>
                                        <p className="font-medium text-emerald-600">{formatCurrency(unit.sellPrice)}</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground">Kondisi</p>
                                <p className="text-sm font-medium">{unit.transactionStatus}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("name")} className="hover:bg-transparent px-0 font-bold">
                                    Unit
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("status")} className="hover:bg-transparent px-0 font-bold">
                                    Status
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("capital")} className="hover:bg-transparent px-0 font-bold">
                                    Modal Awal
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("sellPrice")} className="hover:bg-transparent px-0 font-bold">
                                    Harga Jual
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => requestSort("transactionStatus")} className="hover:bg-transparent px-0 font-bold">
                                    Kondisi
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada investasi"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedData.map(unit => (
                                <TableRow key={unit.id}>
                                    <TableCell className="font-medium">
                                        {unit.name} <br />
                                        <span className="text-xs text-muted-foreground">{unit.plateNumber}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={unit.status === "SOLD" ? "secondary" : "default"}>
                                            {unit.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {unit.capital > 0 ? formatCurrency(unit.capital) : "-"}
                                    </TableCell>
                                    <TableCell className="text-emerald-600 font-medium">
                                        {unit.sellPrice > 0 ? formatCurrency(unit.sellPrice) : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {unit.transactionStatus}
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
