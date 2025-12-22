"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface InvestmentUnit {
    id: string
    name: string
    plateNumber: string | null
    status: string
    capital: number
    transactionStatus: string
}

interface InvestmentsTableProps {
    data: InvestmentUnit[]
}

export function InvestmentsTable({ data }: InvestmentsTableProps) {
    const [sortConfig, setSortConfig] = useState<{ key: keyof InvestmentUnit, direction: "asc" | "desc" } | null>(null)

    const sortedData = [...data].sort((a, b) => {
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

    const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val)

    return (
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
                        <TableCell colSpan={4} className="text-center">Belum ada investasi</TableCell>
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
                            <TableCell>
                                {unit.transactionStatus}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    )
}
