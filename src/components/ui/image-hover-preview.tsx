"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ImageHoverPreviewProps {
    src: string
    alt: string
    className?: string
    children?: React.ReactNode
    previewSize?: "sm" | "md" | "lg" | "xl"
    disabled?: boolean
}

const PREVIEW_SIZES = {
    sm: "w-48 h-48",
    md: "w-64 h-64",
    lg: "w-80 h-80",
    xl: "w-96 h-96",
}

export function ImageHoverPreview({
    src,
    alt,
    className,
    children,
    previewSize = "lg",
    disabled = false,
}: ImageHoverPreviewProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [imageLoaded, setImageLoaded] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // Preload the image
        const img = new Image()
        img.src = src
        img.onload = () => setImageLoaded(true)
    }, [src])

    const handleMouseEnter = (e: React.MouseEvent) => {
        if (disabled || !imageLoaded) return

        // Delay showing the preview slightly
        timeoutRef.current = setTimeout(() => {
            setIsHovered(true)
            updatePosition(e)
        }, 200)
    }

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }
        setIsHovered(false)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isHovered) return
        updatePosition(e)
    }

    const updatePosition = (e: React.MouseEvent) => {
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX
        const mouseY = e.clientY

        // Calculate position relative to viewport
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        // Default: show on the right side
        let x = mouseX + 20
        let y = mouseY - 150

        // If preview would go off right edge, show on left
        const previewWidth = previewSize === "sm" ? 192 : previewSize === "md" ? 256 : previewSize === "lg" ? 320 : 384
        if (x + previewWidth > viewportWidth - 20) {
            x = mouseX - previewWidth - 20
        }

        // Keep within vertical bounds
        const previewHeight = previewWidth // assuming square preview
        if (y < 20) {
            y = 20
        } else if (y + previewHeight > viewportHeight - 20) {
            y = viewportHeight - previewHeight - 20
        }

        setPosition({ x, y })
    }

    return (
        <>
            <div
                ref={containerRef}
                className={cn("relative cursor-pointer", className)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
            >
                {children || (
                    <img
                        src={src}
                        alt={alt}
                        className="h-full w-full object-cover"
                    />
                )}
            </div>

            {/* Preview Portal */}
            {isHovered && imageLoaded && !disabled && (
                <div
                    className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                    }}
                >
                    <div className={cn(
                        PREVIEW_SIZES[previewSize],
                        "rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10 backdrop-blur-sm"
                    )}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none z-10" />
                        <img
                            src={src}
                            alt={alt}
                            className="h-full w-full object-cover"
                        />
                        {/* Modern glassmorphism border effect */}
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-xl pointer-events-none" />
                    </div>

                    {/* Optional: Image info overlay */}
                    <div className="mt-2 bg-black/80 backdrop-blur-md text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs">
                        <p className="font-medium truncate">{alt}</p>
                    </div>
                </div>
            )}
        </>
    )
}
