import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  primaryAction?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--mudha-border)] bg-[var(--mudha-surface)] px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 text-[var(--mudha-text-muted)]">{icon}</div>
      )}
      <p className="text-sm font-medium text-[var(--mudha-text)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[var(--mudha-text-muted)]">
          {description}
        </p>
      )}
      {primaryAction && <div className="mt-4">{primaryAction}</div>}
    </div>
  )
}
