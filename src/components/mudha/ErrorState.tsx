"use client"

import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ErrorStateProps {
  title: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  icon?: ReactNode
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Coba Lagi",
  className,
  icon,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-[var(--mudha-status-danger-border)] bg-[var(--mudha-status-danger-bg)] px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 text-[var(--mudha-status-danger-text)]">
        {icon ?? <AlertTriangle className="h-6 w-6" />}
      </div>
      <p className="text-sm font-medium text-[var(--mudha-status-danger-text)]">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[var(--mudha-text-secondary)]">
          {description}
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
