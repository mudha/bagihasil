import { cn } from "@/lib/utils"

export type LoadingStateVariant = "page" | "table" | "cards" | "metric"

export interface LoadingStateProps {
  variant?: LoadingStateVariant
  label?: string
  rowCount?: number
  className?: string
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-[var(--mudha-surface-subtle)]",
        className,
      )}
    />
  )
}

export function LoadingState({
  variant = "page",
  label = "Memuat data…",
  rowCount = 5,
  className,
}: LoadingStateProps) {
  const safeCount = Math.max(1, Math.min(rowCount, 20))

  if (variant === "metric") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--mudha-border)] bg-[var(--mudha-surface)] p-4 shadow-[var(--mudha-shadow-xs)]"
          >
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="mt-2 h-6 w-16" />
            <SkeletonBar className="mt-1 h-3 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === "cards") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className={cn("space-y-3", className)}
      >
        {Array.from({ length: safeCount }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--mudha-border)] bg-[var(--mudha-surface)] p-4 shadow-[var(--mudha-shadow-xs)]"
          >
            <div className="flex items-start gap-3">
              <SkeletonBar className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <SkeletonBar className="h-4 w-3/4" />
                <SkeletonBar className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === "table") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className={cn(
          "overflow-hidden rounded-lg border border-[var(--mudha-border)] bg-[var(--mudha-surface)] shadow-[var(--mudha-shadow-xs)]",
          className,
        )}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--mudha-border)] bg-[var(--mudha-surface-subtle)]">
              <th className="h-10 px-4 text-left font-medium" />
              <th className="h-10 px-4 text-left font-medium" />
              <th className="h-10 px-4 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: safeCount }, (_, i) => (
              <tr
                key={i}
                className="border-b border-[var(--mudha-border-subtle)] last:border-0"
              >
                <td className="p-4">
                  <SkeletonBar className="h-4 w-3/4" />
                </td>
                <td className="p-4">
                  <SkeletonBar className="h-4 w-1/2" />
                </td>
                <td className="p-4">
                  <SkeletonBar className="h-4 w-1/4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // variant === "page"
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("space-y-4", className)}
    >
      <SkeletonBar className="h-8 w-48" />
      <SkeletonBar className="h-4 w-80" />
      <SkeletonBar className="h-10 w-full max-w-md" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: safeCount }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--mudha-border)] bg-[var(--mudha-surface)] p-4 shadow-[var(--mudha-shadow-xs)]"
          >
            <SkeletonBar className="h-4 w-2/3" />
            <SkeletonBar className="mt-2 h-6 w-1/2" />
            <SkeletonBar className="mt-1 h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
