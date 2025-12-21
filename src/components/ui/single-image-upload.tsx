"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Upload, Plus, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { validateImageFile, formatFileSize } from "@/lib/image-utils"

interface SingleImageUploadProps {
    value?: string | null
    onChange: (file: File | null, preview: string | null) => void
    label?: string
    description?: string
}

export function SingleImageUpload({ value, onChange, label = "Upload Gambar", description }: SingleImageUploadProps) {
    const [preview, setPreview] = useState<string | null>(value || null)
    const [fileName, setFileName] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (value) setPreview(value)
    }, [value])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const validation = validateImageFile(file)
        if (!validation.valid) {
            toast.error(validation.error)
            return
        }

        setFileName(file.name)
        const reader = new FileReader()
        reader.onloadend = () => {
            const result = reader.result as string
            setPreview(result)
            onChange(file, result)
        }
        reader.readAsDataURL(file)

        // Reset input to allow re-selecting same file
        e.target.value = ""
    }

    const handleRemove = () => {
        setPreview(null)
        setFileName(null)
        onChange(null, null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                const file = items[i].getAsFile()
                if (file) {
                    const validation = validateImageFile(file)
                    if (!validation.valid) {
                        toast.error(validation.error)
                        return
                    }

                    setFileName(`pasted-image-${Date.now()}.png`)
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        const result = reader.result as string
                        setPreview(result)
                        onChange(file, result)
                    }
                    reader.readAsDataURL(file)
                    break
                }
            }
        }
    }

    return (
        <div className="space-y-2" onPaste={handlePaste}>
            <div className="flex justify-between items-center">
                <Label>{label}</Label>
                {description && <span className="text-xs text-muted-foreground">{description}</span>}
            </div>

            {!preview ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                        <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Klik untuk Upload</p>
                    <p className="text-xs text-slate-500 mt-1">
                        atau Paste (Ctrl+V)
                    </p>
                </div>
            ) : (
                <div className="relative border rounded-lg overflow-hidden group bg-slate-50">
                    <div className="h-48 w-full flex items-center justify-center">
                        <img src={preview} alt="Preview" className="h-full w-full object-contain" />
                    </div>
                    <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handleRemove}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {fileName && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-1 px-2 text-xs truncate">
                            {fileName}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
