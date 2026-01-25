"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Upload, Plus, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { validateImageFile, formatFileSize } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import { ImagePreviewDialog } from "./image-preview-dialog"
import { ImageHoverPreview } from "./image-hover-preview"

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
    uploadLabel?: string
}

export function MultipleImageUpload({ onImagesChange, maxImages = 5, initialImages = [], className, uploadLabel = "Upload Gambar Bukti" }: MultipleImageUploadProps) {
    const [images, setImages] = useState<ImageFileWithDescription[]>(initialImages)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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
    // Use Ref to access latest images in event listener without re-binding
    const imagesRef = useRef(images)
    useEffect(() => {
        imagesRef.current = images
    }, [images])

    // Track hover state to isolate paste events
    const isHovered = useRef(false)

    // Global paste listener
    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent) => {
            // Only paste if THIS component is being hovered
            if (!isHovered.current) return

            const items = e.clipboardData?.items
            if (!items) return

            let hasImage = false
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith("image/")) {
                    hasImage = true
                    const file = items[i].getAsFile()
                    if (file) {
                        const currentImages = imagesRef.current
                        if (currentImages.length >= maxImages) {
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
                            toast.success("Gambar berhasil dipaste!")
                        }
                        reader.readAsDataURL(file)
                    }
                }
            }
        }

        document.addEventListener('paste', handleGlobalPaste)
        return () => {
            document.removeEventListener('paste', handleGlobalPaste)
        }
    }, [maxImages]) // removed images dependency

    return (
        <div
            className={cn("space-y-4", className)}
            onMouseEnter={() => (isHovered.current = true)}
            onMouseLeave={() => (isHovered.current = false)}
        >
            <div className="grid gap-4">
                {images.map((img, index) => (
                    <div key={img.id} className="flex gap-4 p-3 border rounded-lg bg-slate-50 relative group">
                        <ImageHoverPreview
                            src={img.preview}
                            alt={img.description || img.file?.name || "Preview"}
                            previewSize="md"
                            className="w-24 h-24 shrink-0 bg-white rounded-md border flex items-center justify-center overflow-hidden"
                        >
                            <img src={img.preview} alt="Preview" className="w-full h-full object-cover cursor-pointer" />
                        </ImageHoverPreview>
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
                        <div className="absolute top-1 right-1 flex gap-1 bg-white/80 rounded-md p-1 shadow-sm">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => setPreviewUrl(img.preview)}
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

            <ImagePreviewDialog
                src={previewUrl}
                isOpen={!!previewUrl}
                onOpenChange={(open) => !open && setPreviewUrl(null)}
                title="Pratinjau Bukti"
            />

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
                    <p className="text-sm font-medium text-slate-700">{uploadLabel}</p>
                    <p className="text-xs text-slate-500 mt-1">
                        Klik untuk pilih atau Paste (Ctrl+V) disini
                    </p>
                </div>
            )}
        </div>
    )
}
