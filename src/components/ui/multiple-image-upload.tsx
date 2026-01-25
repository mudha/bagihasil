"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Upload, Plus, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { validateImageFile } from "@/lib/image-utils"
import { ImageHoverPreview } from "./image-hover-preview"
import { cn } from "@/lib/utils"

export interface UploadedImage {
    id: string
    file: File
    preview: string
    description?: string
}

interface MultipleImageUploadProps {
    initialImages?: UploadedImage[]
    onImagesChange: (images: UploadedImage[]) => void
    maxImages?: number
    uploadLabel?: string
    description?: string
}

export function MultipleImageUpload({
    initialImages = [],
    onImagesChange,
    maxImages = 5,
    uploadLabel = "Upload Gambar (Bisa Banyak)",
    description
}: MultipleImageUploadProps) {
    const [images, setImages] = useState<UploadedImage[]>(initialImages)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setImages(initialImages)
    }, [initialImages])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        if (images.length + files.length > maxImages) {
            toast.error(`Maksimal ${maxImages} gambar`)
            return
        }

        const newImages: UploadedImage[] = []
        Array.from(files).forEach(file => {
            const validation = validateImageFile(file)
            if (!validation.valid) {
                toast.error(`File ${file.name}: ${validation.error}`)
                return
            }

            const preview = URL.createObjectURL(file)
            newImages.push({
                id: `${file.name}-${Date.now()}-${Math.random()}`,
                file,
                preview
            })
        })

        if (newImages.length > 0) {
            const updatedImages = [...images, ...newImages]
            setImages(updatedImages)
            onImagesChange(updatedImages)
        }

        // Reset input
        e.target.value = ""
    }

    const handleRemove = (id: string) => {
        const updatedImages = images.filter(img => img.id !== id)
        setImages(updatedImages)
        onImagesChange(updatedImages)
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        const newImages: UploadedImage[] = []

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                const file = items[i].getAsFile()
                if (file) {
                    if (images.length + newImages.length >= maxImages) {
                        toast.error(`Maksimal ${maxImages} gambar`)
                        break
                    }

                    const validation = validateImageFile(file)
                    if (!validation.valid) {
                        toast.error(validation.error)
                        continue
                    }

                    const preview = URL.createObjectURL(file)
                    newImages.push({
                        id: `pasted-${Date.now()}-${Math.random()}`,
                        file,
                        preview
                    })
                }
            }
        }

        if (newImages.length > 0) {
            const updatedImages = [...images, ...newImages]
            setImages(updatedImages)
            onImagesChange(updatedImages)
            toast.success(`${newImages.length} gambar berhasil dipaste!`)
        }
    }

    return (
        <div className="space-y-4" onPaste={handlePaste}>
            <div className="flex justify-between items-center">
                <Label>{uploadLabel}</Label>
                {description && <span className="text-xs text-muted-foreground">{description}</span>}
                <span className="text-xs text-muted-foreground">{images.length}/{maxImages}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((img) => (
                    <div key={img.id} className="relative group border rounded-lg overflow-hidden bg-slate-50 aspect-video">
                        <ImageHoverPreview
                            src={img.preview}
                            alt="Preview"
                            className="h-full w-full"
                        >
                            <img src={img.preview} alt="Preview" className="h-full w-full object-contain" />
                        </ImageHoverPreview>
                        <button
                            type="button"
                            onClick={() => handleRemove(img.id)}
                            className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}

                {images.length < maxImages && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors aspect-video"
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mb-1">
                            <Plus className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-slate-600">Tambah Foto</span>
                    </div>
                )}
            </div>

            {images.length === 0 && (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                        <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Klik untuk Upload</p>
                    <p className="text-xs text-slate-500 mt-1">
                        atau Paste (Ctrl+V)
                    </p>
                </div>
            )}
        </div>
    )
}
