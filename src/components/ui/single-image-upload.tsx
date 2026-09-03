"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { X, Upload } from "lucide-react"
import { toast } from "sonner"
import { validateImageFile } from "@/lib/image-utils"
import { ImageHoverPreview } from "./image-hover-preview"

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
                    className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors dark:hover:border-blue-300 dark:hover:bg-blue-950/40"
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-2 dark:bg-blue-950/50">
                        <Upload className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Klik untuk Upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        atau Paste (Ctrl+V)
                    </p>
                </div>
            ) : (
                <div className="relative border rounded-lg overflow-hidden group bg-muted">
                    <ImageHoverPreview
                        src={preview}
                        alt="Preview"
                        previewSize="lg"
                        className="h-48 w-full flex items-center justify-center relative"
                    >
                        <Image src={preview} alt="Preview" fill className="object-contain cursor-pointer" style={{ top: 0, left: 0 }} />
                    </ImageHoverPreview>
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
