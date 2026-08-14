"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { createPortal } from "react-dom"
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
    sm: { width: 240, height: 180 },
    md: { width: 320, height: 240 },
    lg: { width: 380, height: 285 },
    xl: { width: 480, height: 360 },
}

const VIEWPORT_MARGIN = 16
const TRIGGER_GAP = 14
const CAPTION_HEIGHT = 40

function clamp(value: number, min: number, max: number) {
    const safeMax = Math.max(min, max)
    return Math.min(Math.max(value, min), safeMax)
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
    const [position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 })
    const [imageLoaded, setImageLoaded] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        const img = new Image()
        setImageLoaded(false)
        img.src = src
        img.onload = () => setImageLoaded(true)
    }, [src])

    const updatePosition = useCallback(() => {
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const size = PREVIEW_SIZES[previewSize]
        const maxWidth = Math.max(window.innerWidth - VIEWPORT_MARGIN * 2, 0)
        const maxHeight = Math.max(window.innerHeight - VIEWPORT_MARGIN * 2 - CAPTION_HEIGHT, 0)
        const width = Math.min(size.width, maxWidth)
        const height = Math.min(size.height, maxHeight)
        const totalHeight = height + CAPTION_HEIGHT

        const rightX = rect.right + TRIGGER_GAP
        const leftX = rect.left - width - TRIGGER_GAP
        const bottomY = rect.bottom + TRIGGER_GAP
        const topY = rect.top - totalHeight - TRIGGER_GAP
        let x = rightX
        let y = rect.top + rect.height / 2 - totalHeight / 2

        if (rightX + width > window.innerWidth - VIEWPORT_MARGIN && leftX >= VIEWPORT_MARGIN) {
            x = leftX
        } else if (rightX + width > window.innerWidth - VIEWPORT_MARGIN) {
            x = clamp(rect.left + rect.width / 2 - width / 2, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)

            if (bottomY + totalHeight <= window.innerHeight - VIEWPORT_MARGIN) {
                y = bottomY
            } else if (topY >= VIEWPORT_MARGIN) {
                y = topY
            }
        }

        y = clamp(y, VIEWPORT_MARGIN, window.innerHeight - totalHeight - VIEWPORT_MARGIN)

        setPosition({ x, y, width, height })
    }, [previewSize])

    useLayoutEffect(() => {
        if (!isHovered) return

        updatePosition()

        const handleViewportChange = () => updatePosition()

        window.addEventListener("resize", handleViewportChange)
        window.addEventListener("scroll", handleViewportChange, true)

        return () => {
            window.removeEventListener("resize", handleViewportChange)
            window.removeEventListener("scroll", handleViewportChange, true)
        }
    }, [isHovered, updatePosition])

    const handleMouseEnter = () => {
        if (disabled || !imageLoaded) return
        if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return

        timeoutRef.current = setTimeout(() => {
            updatePosition()
            setIsHovered(true)
        }, 120)
    }

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }
        setIsHovered(false)
    }


    const shouldShowPreview = isHovered && imageLoaded && !disabled && isMounted && position.width > 0 && position.height > 0

    return (
        <>
            <div
                ref={containerRef}
                className={cn("relative cursor-pointer", className)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
            >
                {children || (
                    <img
                        src={src}
                        alt={alt}
                        className="h-full w-full object-cover"
                    />
                )}
            </div>

            {shouldShowPreview && createPortal(
                <div
                    className="pointer-events-none fixed z-[9999] animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        width: `${position.width}px`,
                    }}
                >
                    <div
                        className="overflow-hidden rounded-xl border border-white/70 bg-slate-950 shadow-2xl shadow-slate-950/25 ring-1 ring-slate-950/10"
                        style={{ height: `${position.height}px` }}
                    >
                        <img
                            src={src}
                            alt={alt}
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="mt-2 rounded-lg border border-slate-900/10 bg-slate-950/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur">
                        <p className="font-medium truncate">{alt}</p>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
