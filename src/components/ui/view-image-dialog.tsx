"use client"

import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface ViewImageDialogProps {
    imageUrl: string
    altText?: string
}

export function ViewImageDialog({ imageUrl, altText = "Bukti Pembayaran" }: ViewImageDialogProps) {
    if (!imageUrl) return <span className="text-muted-foreground text-xs">Tidak ada bukti</span>

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                    <span className="sr-only">Lihat Bukti</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none">
                <div className="relative w-full h-auto min-h-[300px] flex items-center justify-center bg-black/50 rounded-lg p-4">
                    <Image
                        src={imageUrl}
                        alt={altText}
                        width={800}
                        height={600}
                        className="object-contain max-h-[80vh] rounded-md"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
