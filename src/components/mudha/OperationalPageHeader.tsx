import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface OperationalPageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  primaryAction?: ReactNode
  secondaryActions?: ReactNode
  metadata?: ReactNode
  className?: string
}

export function OperationalPageHeader({
  title,
  description,
  eyebrow,
  primaryAction,
  secondaryActions,
  metadata,
  className,
}: OperationalPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--mudha-text-muted)]">
            {eyebrow}
          </p>
        )}
        <h1 className="min-w-0 max-w-full text-2xl font-bold leading-tight tracking-tight text-[var(--mudha-text)] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-sm leading-relaxed text-[var(--mudha-text-secondary)]">
            {description}
          </p>
        )}
        {metadata && <div className="mt-1">{metadata}</div>}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {secondaryActions && (
          <div className="flex items-center gap-2">{secondaryActions}</div>
        )}
        {primaryAction && <div className="flex-shrink-0">{primaryAction}</div>}
      </div>
    </div>
  )
}
