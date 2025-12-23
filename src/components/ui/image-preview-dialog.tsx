"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ExternalLink, Download, X } from "lucide-react"

interface ImagePreviewDialogProps {
    src: string | null
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    title?: string
}

export function ImagePreviewDialog({ src, isOpen, onOpenChange, title = "Pratinjau Gambar" }: ImagePreviewDialogProps) {
    if (!src) return null

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden border-none bg-transparent shadow-none [&>button]:hidden">
                <div className="relative flex flex-col items-center justify-center min-h-[50vh] max-h-[90vh]">
                    {/* Header Overlay */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-10 transition-opacity duration-300">
                        <div className="flex flex-col">
                            <DialogTitle className="text-white font-medium drop-shadow-md">
                                {title}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Pratinjau gambar dalam ukuran penuh
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
                                onClick={() => window.open(src, '_blank')}
                                title="Buka di Tab Baru"
                            >
                                <ExternalLink className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
                                onClick={() => onOpenChange(false)}
                                title="Tutup"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Image Container */}
                    <div className="w-full h-full flex items-center justify-center p-4">
                        <img
                            src={src}
                            alt={title}
                            className="max-w-full max-h-[85vh] object-contain rounded-sm shadow-2xl animate-in zoom-in-95 duration-200"
                        />
                    </div>

                    {/* Action Bar (Optional) */}
                    <div className="absolute bottom-6 flex gap-3">
                        <a href={src} download={`image-${Date.now()}`}>
                            <Button className="bg-white/90 hover:bg-white text-black rounded-full shadow-lg gap-2">
                                <Download className="h-4 w-4" />
                                Simpan Gambar
                            </Button>
                        </a>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
