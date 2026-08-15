"use client"

import { useState, useRef, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { X, Upload, Plus } from "lucide-react"
import { toast } from "sonner"
import { validateImageFile } from "@/lib/image-utils"
import { ImageHoverPreview } from "./image-hover-preview"
import Image from "next/image"

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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <Label>{uploadLabel}</Label>
                    {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {images.length}/{maxImages}
                </span>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFileChange}
            />

            {images.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {images.map((img) => (
                    <div key={img.id} className="relative group border rounded-lg overflow-hidden bg-slate-50 aspect-video">
                        <ImageHoverPreview
                            src={img.preview}
                            alt="Preview"
                            className="h-full w-full relative"
                        >
                            <Image src={img.preview} alt="Preview" fill className="object-contain" style={{ top: 0, left: 0 }} />
                        </ImageHoverPreview>
                        <button
                            type="button"
                            onClick={() => handleRemove(img.id)}
                            aria-label="Hapus foto"
                            className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}

                {images.length < maxImages && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex aspect-video min-h-28 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    >
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mb-1">
                            <Plus className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-slate-600">Tambah Foto</span>
                    </button>
                )}
            </div>
            )}

            {images.length === 0 && (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white p-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 sm:min-h-40"
                >
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                        <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Klik untuk Upload</p>
                    <p className="text-xs text-slate-500 mt-1">
                        Pilih dari galeri atau paste (Ctrl+V)
                    </p>
                </button>
            )}
        </div>
    )
}
