import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type StatusBadgeTone = "neutral" | "success" | "warning" | "danger" | "info"

export interface StatusBadgeProps {
  label: string
  tone: StatusBadgeTone
  icon?: ReactNode
  className?: string
}

const toneStyles: Record<StatusBadgeTone, string> = {
  neutral: "border-[var(--mudha-status-neutral-border)] bg-[var(--mudha-status-neutral-bg)] text-[var(--mudha-status-neutral-text)]",
  success: "border-[var(--mudha-status-success-border)] bg-[var(--mudha-status-success-bg)] text-[var(--mudha-status-success-text)]",
  warning: "border-[var(--mudha-status-warning-border)] bg-[var(--mudha-status-warning-bg)] text-[var(--mudha-status-warning-text)]",
  danger: "border-[var(--mudha-status-danger-border)] bg-[var(--mudha-status-danger-bg)] text-[var(--mudha-status-danger-text)]",
  info: "border-[var(--mudha-status-info-border)] bg-[var(--mudha-status-info-bg)] text-[var(--mudha-status-info-text)]",
}

export function StatusBadge({ label, tone, icon, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneStyles[tone],
        className,
      )}
    >
      {icon}
      {label}
    </span>
  )
}
