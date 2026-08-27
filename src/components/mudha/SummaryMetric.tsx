import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type SummaryMetricTone = "neutral" | "success" | "warning" | "danger" | "info"

export interface SummaryMetricProps {
  label: string
  value: string | number
  supportingText?: string
  tone?: SummaryMetricTone
  icon?: ReactNode
  href?: string
  loading?: boolean
  className?: string
}

const toneStyles: Record<SummaryMetricTone, string> = {
  neutral: "bg-[var(--mudha-status-neutral-bg)] text-[var(--mudha-status-neutral-text)] border-[var(--mudha-status-neutral-border)]",
  success: "bg-[var(--mudha-status-success-bg)] text-[var(--mudha-status-success-text)] border-[var(--mudha-status-success-border)]",
  warning: "bg-[var(--mudha-status-warning-bg)] text-[var(--mudha-status-warning-text)] border-[var(--mudha-status-warning-border)]",
  danger: "bg-[var(--mudha-status-danger-bg)] text-[var(--mudha-status-danger-text)] border-[var(--mudha-status-danger-border)]",
  info: "bg-[var(--mudha-status-info-bg)] text-[var(--mudha-status-info-text)] border-[var(--mudha-status-info-border)]",
}

const toneAccent: Record<SummaryMetricTone, string> = {
  neutral: "text-[var(--mudha-text-muted)]",
  success: "text-[var(--mudha-status-success-text)]",
  warning: "text-[var(--mudha-status-warning-text)]",
  danger: "text-[var(--mudha-status-danger-text)]",
  info: "text-[var(--mudha-status-info-text)]",
}

export function SummaryMetric({
  label,
  value,
  supportingText,
  tone = "neutral",
  icon,
  href,
  loading = false,
  className,
}: SummaryMetricProps) {
  const content = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-shadow",
        toneStyles[tone],
        "shadow-[var(--mudha-shadow-xs)]",
        href && "cursor-pointer hover:shadow-[var(--mudha-shadow-sm)]",
        className,
      )}
      aria-busy={loading || undefined}
      role="status"
    >
      {icon && (
        <div className={cn("mt-0.5 shrink-0", toneAccent[tone])}>{icon}</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[var(--mudha-text-secondary)]">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-6 w-24 animate-pulse rounded bg-black/5" />
        ) : (
          <p
            className="mt-1 truncate text-xl font-bold leading-tight text-[var(--mudha-text)]"
            title={typeof value === "number" ? String(value) : value}
          >
            {value}
          </p>
        )}
        {supportingText && !loading && (
          <p className="mt-0.5 text-xs text-[var(--mudha-text-muted)]">
            {supportingText}
          </p>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mudha-green-600)] focus-visible:ring-offset-2 rounded-lg">
        {content}
      </Link>
    )
  }

  return content
}
