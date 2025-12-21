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

interface ImportUnitsDialogProps {
    onImportSuccess?: () => void
}

export function ImportUnitsDialog({ onImportSuccess }: ImportUnitsDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null)

    const downloadTemplate = () => {
        const headers = ["investorName", "name", "plateNumber", "code", "status"]
        const sample = ["Budi Santoso", "Toyota Avanza 2020", "B 1234 ABC", "AVZ-001", "AVAILABLE"]

        const csvContent = [
            headers.join(","),
            sample.join(",")
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "template_units.csv"
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
                    const response = await fetch("/api/import/units", {
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
                    toast.success(`Berhasil mengimport ${data.count} unit`)

                    // Call the callback to refresh the units list
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
                    <DialogTitle>Import Data Unit</DialogTitle>
                    <DialogDescription>
                        Pastikan nama pemodal sudah terdaftar di sistem sebelum melakukan import.
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
                                Gunakan template ini untuk memastikan format data benar.
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
                                Upload file CSV yang sudah diisi.
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
