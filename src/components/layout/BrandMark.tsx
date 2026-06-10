"use client"

import { ChartNoAxesCombined, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrandMarkProps {
    compact?: boolean
    inverse?: boolean
    className?: string
}

export function BrandMark({ compact = false, inverse = false, className }: BrandMarkProps) {
    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
                <div className="absolute -right-3 -top-3 size-7 rounded-full bg-white/25" />
                <div className="absolute -bottom-3 -left-2 size-8 rounded-full bg-lime-200/25" />
                <ChartNoAxesCombined className="relative z-10 size-6 text-white" />
                <Sparkles className="absolute right-1.5 top-1.5 size-3 text-white/80" />
            </div>
            {!compact && (
                <div className="min-w-0">
                    <p className={cn("truncate text-lg font-black leading-none tracking-tight", inverse ? "text-white" : "text-gray-950")}>
                        Mudha
                    </p>
                    <p className={cn("mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em]", inverse ? "text-teal-100/80" : "text-teal-700")}>
                        Profit Studio
                    </p>
                </div>
            )}
        </div>
    )
}
