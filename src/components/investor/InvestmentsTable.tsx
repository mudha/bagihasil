"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"

import { ImageHoverPreview } from "@/components/ui/image-hover-preview"
import { UnitDetailModal } from "./UnitDetailModal"

interface InvestmentUnit {
    id: string
    name: string
    plateNumber: string | null
    status: string
    capital: number
    sellPrice: number
    transactionStatus: string
    imageUrl?: string | null
    transactionId: string
}

interface InvestmentsTableProps {
    data: InvestmentUnit[]
    defaultFilter?: string
}

export function InvestmentsTable({ data, defaultFilter = "" }: InvestmentsTableProps) {
    const [searchQuery, setSearchQuery] = useState(defaultFilter)
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [sortOption, setSortOption] = useState("NEWEST")
    const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)

    // Update searchQuery when defaultFilter changes from parent
    useEffect(() => {
        if (defaultFilter) {
            setSearchQuery(defaultFilter)
        }
    }, [defaultFilter])

    const filteredData = data.filter(unit => {
        const query = searchQuery.toLowerCase()
        const matchesSearch = (
            unit.name.toLowerCase().includes(query) ||
            (unit.plateNumber?.toLowerCase().includes(query) ?? false) ||
            unit.status.toLowerCase().includes(query) ||
            unit.transactionStatus.toLowerCase().includes(query)
        )

        let matchesStatus = true
        if (statusFilter === "ACTIVE") {
            matchesStatus = unit.status !== "SOLD"
        } else if (statusFilter === "SOLD") {
            matchesStatus = unit.status === "SOLD"
        }

        return matchesSearch && matchesStatus
    })

    const sortedData = [...filteredData].sort((a, b) => {
        switch (sortOption) {
            case "PRICE_HIGH":
                return (b.capital || 0) - (a.capital || 0)
            case "PRICE_LOW":
                return (a.capital || 0) - (b.capital || 0)
            case "NAME_ASC":
                return a.name.localeCompare(b.name)
            case "NEWEST":
            default:
                // Assuming original order is newest (or simply stable) - no date field in interface currently
                // Ideally we'd sort by transaction date if available on the unit object
                return 0
        }
    })

    const requestSort = (key: keyof InvestmentUnit) => {
        // Legacy support if needed or remove if strictly using dropdown
        // Keeping it empty or adapting:
        if (key === 'capital') setSortOption(sortOption === "PRICE_HIGH" ? "PRICE_LOW" : "PRICE_HIGH")
        if (key === 'name') setSortOption("NAME_ASC")
    }

    const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

    const handleUnitClick = (transactionId: string) => {
        setSelectedTransactionId(transactionId)
        setModalOpen(true)
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari unit atau status..."
                        className="pl-8 pr-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setSearchQuery("")}
                        >
                            <span className="sr-only">Clear search</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </Button>
                    )}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <select
                        className="h-10 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">Semua Status</option>
                        <option value="ACTIVE">Sedang Berjalan</option>
                        <option value="SOLD">Terjual</option>
                    </select>

                    <select
                        className="h-10 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                    >
                        <option value="NEWEST">Terbaru</option>
                        <option value="PRICE_HIGH">Harga Tertinggi</option>
                        <option value="PRICE_LOW">Harga Terendah</option>
                        <option value="NAME_ASC">Nama (A-Z)</option>
                    </select>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {sortedData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada investasi"}
                    </div>
                ) : (
                    sortedData.map((unit, index) => (
                        <div
                            key={unit.id}
                            className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                            onClick={() => handleUnitClick(unit.transactionId)}
                        >
                            <div className="flex gap-4">
                                {unit.imageUrl && (
                                    <div className="relative h-24 w-24 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 border">
                                        <Image
                                            src={unit.imageUrl}
                                            alt={unit.name}
                                            className="h-full w-full object-cover"
                                            width={96}
                                            height={96}
                                        />
                                    </div>
                                )}
                                <div className="flex-1 space-y-3 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-base truncate">{unit.name}</h3>
                                            <p className="text-sm text-muted-foreground truncate">{unit.plateNumber}</p>
                                        </div>
                                        <Badge variant={unit.status === "SOLD" ? "secondary" : "default"} className="flex-shrink-0">
                                            {unit.status}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Modal Awal</p>
                                            <p className="font-medium truncate">{unit.capital > 0 ? formatCurrency(unit.capital) : "-"}</p>
                                        </div>
                                        {unit.sellPrice > 0 && (
                                            <div>
                                                <p className="text-muted-foreground text-xs">Harga Jual</p>
                                                <p className="font-medium text-emerald-600 truncate">{formatCurrency(unit.sellPrice)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t mt-3">
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
                            <TableHead className="w-[80px]">Gambar</TableHead>
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
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada investasi"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedData.map((unit, index) => (
                                <TableRow
                                    key={unit.id}
                                    className={`cursor-pointer ${index % 2 === 0 ? "bg-white hover:bg-slate-100" : "bg-slate-50 hover:bg-slate-100"}`}
                                    onClick={() => handleUnitClick(unit.transactionId)}
                                >
                                    <TableCell>
                                        {unit.imageUrl ? (
                                            <div className="h-12 w-12 rounded overflow-hidden bg-gray-100 border">
                                                <ImageHoverPreview
                                                    src={unit.imageUrl}
                                                    alt={unit.name}
                                                    className="h-full w-full object-cover"
                                                    width={48}
                                                    height={48}
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                                No Img
                                            </div>
                                        )}
                                    </TableCell>
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

            {/* Unit Detail Modal */}
            <UnitDetailModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                transactionId={selectedTransactionId}
            />
        </div>
    )
}
