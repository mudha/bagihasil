"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, ArrowDown } from "lucide-react"

interface PullToRefreshProps {
    children: React.ReactNode
}

export function PullToRefresh({ children }: PullToRefreshProps) {
    const [startY, setStartY] = useState(0)
    const [currentY, setCurrentY] = useState(0)
    const [refreshing, setRefreshing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    const THRESHOLD = 80
    const MAX_PULL = 150

    // Only enable on touch devices to avoid interfering with mouse scroll
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleTouchStart = (e: TouchEvent) => {
            // Only start if we are at the very top of the scroll
            // We check window.scrollY or the container's scrollTop depending on layout
            // Since this wraps the content in dashboard, likely window scroll is what matters
            if (window.scrollY === 0) {
                setStartY(e.touches[0].clientY)
            }
        }

        const handleTouchMove = (e: TouchEvent) => {
            if (startY === 0) return
            if (refreshing) return

            const y = e.touches[0].clientY
            const diff = y - startY

            // Only allow pulling down if we started at 0 and are moving down
            if (diff > 0 && window.scrollY === 0) {
                // Prevent default pull behavior of browser (sometimes needed)
                // e.preventDefault() // NOTE: harmful if it blocks scrolling

                // Add resistance
                const newY = Math.min(diff * 0.5, MAX_PULL)
                setCurrentY(newY)
            } else {
                // If user scrolls UP (diff < 0), let native scroll happen
                setCurrentY(0)
            }
        }

        const handleTouchEnd = () => {
            if (currentY > THRESHOLD) {
                setRefreshing(true)
                setCurrentY(THRESHOLD) // Snap to threshold
                window.location.reload()
            } else {
                setRefreshing(false)
                setCurrentY(0)
                setStartY(0)
            }
        }

        container.addEventListener('touchstart', handleTouchStart, { passive: true })
        container.addEventListener('touchmove', handleTouchMove, { passive: false })
        container.addEventListener('touchend', handleTouchEnd)

        return () => {
            container.removeEventListener('touchstart', handleTouchStart)
            container.removeEventListener('touchmove', handleTouchMove)
            container.removeEventListener('touchend', handleTouchEnd)
        }
    }, [startY, currentY, refreshing])

    return (
        <div ref={containerRef} className="min-h-full bg-inherit relative">
            {/* Pull Indicator */}
            <div
                className="fixed left-0 right-0 flex justify-center pointer-events-none z-50 transition-transform duration-200"
                style={{
                    top: '-50px', // Hide initially
                    transform: `translateY(${refreshing ? THRESHOLD + 80 : currentY}px)`
                }}
            >
                <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-md border flex items-center justify-center h-10 w-10">
                    {refreshing ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                        <ArrowDown
                            className="h-5 w-5 text-primary transition-transform"
                            style={{ transform: `rotate(${currentY / THRESHOLD * 180}deg)` }}
                        />
                    )}
                </div>
            </div>

            {/* Content */}
            <div
                ref={contentRef}
                style={{
                    transform: `translateY(${currentY}px)`,
                    transition: currentY === 0 ? 'transform 0.3s ease-out' : 'none'
                }}
            >
                {children}
            </div>
        </div>
    )
}
