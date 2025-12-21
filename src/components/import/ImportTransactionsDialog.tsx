"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react"
import Papa from "papaparse"
import { toast } from "sonner"

interface ImportTransactionsDialogProps {
    onImportSuccess?: () => void
}

export function ImportTransactionsDialog({ onImportSuccess }: ImportTransactionsDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null)

    const downloadTemplate = () => {
        const headers = [
            "unitCode",
            "transactionCode",
            "buyDate",
            "buyPrice",
            "initialInvestorCapital",
            "initialManagerCapital",
            "status",
            "sellDate",
            "sellPrice",
            "biayaInspector",
            "biayaTransport",
            "biayaMakan",
            "biayaTol",
            "biayaIklan",
            "biayaPRUnit",
            "biayaBensin",
            "biayaParkir",
            "biayaMaterai",
            "biayaMakelar",
            "biayaLainLainPemodal"
        ]
        const sample = [
            "AVZ-001",
            "TRX-001",
            "07-08-2025",
            "150000000",
            "150000000",
            "0",
            "ON_PROCESS",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ]

        const csvContent = [
            headers.join(","),
            sample.join(",")
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "template_transactions.csv"
        a.click()
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsLoading(true)
        setResults(null)

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const response = await fetch("/api/import/transactions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ data: results.data }),
                    })

                    const data = await response.json()

                    if (!response.ok) throw new Error(data.error || "Import failed")

                    setResults({
                        success: data.count,
                        errors: data.errors || []
                    })
                    toast.success(`Berhasil mengimport ${data.count} transaksi`)

                    // Call the callback to refresh the transactions list
                    if (onImportSuccess) {
                        onImportSuccess()
                    }
                } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Gagal melakukan import")
                } finally {
                    setIsLoading(false)
                    // Reset input
                    event.target.value = ""
                }
            },
            error: (error) => {
                toast.error(`Error parsing CSV: ${error.message}`)
                setIsLoading(false)
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" /> Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import Data Transaksi</DialogTitle>
                    <DialogDescription>
                        Pastikan kode unit (Unit Code) sesuai dengan data unit yang sudah ada.
                    </DialogDescription>
                </DialogHeader>

                {results && (
                    <Alert variant={results.errors.length > 0 ? "destructive" : "default"} className="border-green-500/50 bg-green-500/10 text-green-600">
                        {results.errors.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <AlertTitle>Import Selesai</AlertTitle>
                        <AlertDescription>
                            Berhasil mengimport {results.success} data.
                            {results.errors.length > 0 && (
                                <div className="mt-2 text-red-600 bg-red-50 p-2 rounded text-xs font-mono max-h-40 overflow-y-auto">
                                    <p className="font-bold mb-1">Error ({results.errors.length}):</p>
                                    {results.errors.map((err, i) => (
                                        <div key={i}>{err}</div>
                                    ))}
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                        <div className="flex-1">
                            <h4 className="font-medium mb-1">1. Download Template</h4>
                            <p className="text-sm text-muted-foreground">
                                Template mencakup kolom wajib seperti Unit Code, Buy Price, dll.
                            </p>
                        </div>
                        <Button variant="outline" onClick={downloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />
                            Download CSV
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                        <div className="flex-1">
                            <h4 className="font-medium mb-1">2. Upload File</h4>
                            <p className="text-sm text-muted-foreground">
                                Upload file CSV transaksi.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="file"
                                accept=".csv"
                                className="w-[250px]"
                                onChange={handleFileUpload}
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
