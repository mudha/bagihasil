"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Upload, Plus, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { validateImageFile, formatFileSize } from "@/lib/image-utils"
import { cn } from "@/lib/utils"

export interface ImageFileWithDescription {
    id: string
    file: File | null
    preview: string
    description: string
}

interface MultipleImageUploadProps {
    onImagesChange: (images: ImageFileWithDescription[]) => void
    maxImages?: number
    initialImages?: ImageFileWithDescription[]
    className?: string
}

export function MultipleImageUpload({ onImagesChange, maxImages = 5, initialImages = [], className }: MultipleImageUploadProps) {
    const [images, setImages] = useState<ImageFileWithDescription[]>(initialImages)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Sync with parent
    useEffect(() => {
        onImagesChange(images)
    }, [images, onImagesChange])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const newImages: ImageFileWithDescription[] = []

        // Check limit
        if (images.length + files.length > maxImages) {
            toast.error(`Maksimal ${maxImages} gambar`)
            return
        }

        Array.from(files).forEach(file => {
            const validation = validateImageFile(file)
            if (!validation.valid) {
                toast.error(`${file.name}: ${validation.error}`)
                return
            }

            const reader = new FileReader()
            reader.onloadend = () => {
                setImages(prev => [
                    ...prev,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        file,
                        preview: reader.result as string,
                        description: ""
                    }
                ])
            }
            reader.readAsDataURL(file)
        })

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleRemove = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id))
    }

    const handleDescriptionChange = (id: string, desc: string) => {
        setImages(prev => prev.map(img =>
            img.id === id ? { ...img, description: desc } : img
        ))
    }

    // Global paste listener
    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items
            if (!items) return

            let hasImage = false
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith("image/")) {
                    hasImage = true
                    const file = items[i].getAsFile()
                    if (file) {
                        if (images.length >= maxImages) {
                            toast.error(`Maksimal ${maxImages} gambar`)
                            return
                        }

                        const validation = validateImageFile(file)
                        if (!validation.valid) {
                            toast.error(validation.error)
                            return
                        }

                        const reader = new FileReader()
                        reader.onloadend = () => {
                            setImages(prev => [
                                ...prev,
                                {
                                    id: Math.random().toString(36).substr(2, 9),
                                    file,
                                    preview: reader.result as string,
                                    description: ""
                                }
                            ])
                        }
                        reader.readAsDataURL(file)
                    }
                }
            }
            // Only prevent default if we actually handled an image, to allow text pasting in inputs
            if (hasImage) {
                // e.preventDefault() // Optional: might block other handlers, but usually fine for images
            }
        }

        document.addEventListener('paste', handleGlobalPaste)
        return () => {
            document.removeEventListener('paste', handleGlobalPaste)
        }
    }, [images, maxImages])

    return (
        <div className={cn("space-y-4", className)}>
            <div className="grid gap-4">
                {images.map((img, index) => (
                    <div key={img.id} className="flex gap-4 p-3 border rounded-lg bg-slate-50 relative group">
                        <div className="w-24 h-24 shrink-0 bg-white rounded-md border flex items-center justify-center overflow-hidden">
                            <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between items-start">
                                <p className="text-xs font-medium truncate max-w-[200px]" title={img.file?.name || "Existing Image"}>
                                    {img.file?.name || "Existing Image"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {img.file ? formatFileSize(img.file.size) : "Existing"}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`desc-${img.id}`} className="text-xs">Keterangan Gambar</Label>
                                <Input
                                    id={`desc-${img.id}`}
                                    placeholder="Contoh: Nota bensin, Struk tol..."
                                    value={img.description}
                                    onChange={(e) => handleDescriptionChange(img.id, e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 rounded-md p-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => window.open(img.preview, '_blank')}
                                title="Lihat Gambar Full"
                            >
                                <ImageIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-600 hover:text-red-500 hover:bg-red-50"
                                onClick={() => handleRemove(img.id)}
                                title="Hapus Gambar"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {images.length < maxImages && (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                        <Plus className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Upload Gambar Bukti</p>
                    <p className="text-xs text-slate-500 mt-1">
                        Klik untuk pilih atau Paste (Ctrl+V) disini
                    </p>
                </div>
            )}
        </div>
    )
}
