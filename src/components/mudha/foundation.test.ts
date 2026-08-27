import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync("src/app/globals.css", "utf8")
const layout = readFileSync("src/app/layout.tsx", "utf8")

const oph = readFileSync("src/components/mudha/OperationalPageHeader.tsx", "utf8")
const sm = readFileSync("src/components/mudha/SummaryMetric.tsx", "utf8")
const sb = readFileSync("src/components/mudha/StatusBadge.tsx", "utf8")
const ls = readFileSync("src/components/mudha/LoadingState.tsx", "utf8")
const es = readFileSync("src/components/mudha/EmptyState.tsx", "utf8")
const ers = readFileSync("src/components/mudha/ErrorState.tsx", "utf8")

// ── Foundation: CSS tokens ──────────────────────────────────────
describe("Mudha Operational CSS tokens", () => {
  it("defines all surface tokens in :root", () => {
    for (const v of [
      "--mudha-bg:",
      "--mudha-surface:",
      "--mudha-surface-subtle:",
      "--mudha-surface-brand:",
      "--mudha-shell:",
      "--mudha-shell-strong:",
    ]) {
      expect(css).toContain(v)
    }
  })

  it("defines all border tokens", () => {
    for (const v of ["--mudha-border:", "--mudha-border-subtle:", "--mudha-border-brand:"]) {
      expect(css).toContain(v)
    }
  })

  it("defines all text tokens", () => {
    for (const v of ["--mudha-text:", "--mudha-text-secondary:", "--mudha-text-muted:"]) {
      expect(css).toContain(v)
    }
  })

  it("defines all primary green scale tokens", () => {
    for (const v of [
      "--mudha-green-950:",
      "--mudha-green-900:",
      "--mudha-green-700:",
      "--mudha-green-600:",
      "--mudha-green-100:",
      "--mudha-green-50:",
    ]) {
      expect(css).toContain(v)
    }
  })

  it("defines all semantic status tokens (text, bg, border)", () => {
    for (const tone of ["success", "warning", "danger", "info", "neutral"]) {
      expect(css).toContain(`--mudha-status-${tone}-text:`)
      expect(css).toContain(`--mudha-status-${tone}-bg:`)
      expect(css).toContain(`--mudha-status-${tone}-border:`)
    }
  })

  it("defines shadow tokens", () => {
    expect(css).toContain("--mudha-shadow-xs:")
    expect(css).toContain("--mudha-shadow-sm:")
    expect(css).toContain("--mudha-shadow-overlay:")
  })

  it("does not override existing shadcn --primary", () => {
    // The primary line in :root should still be the oklch value, not a Mudha color
    expect(css).toContain("--primary: oklch(0.205 0 0)")
  })

  it("does not override existing --background", () => {
    expect(css).toContain("--background: oklch(1 0 0)")
  })
})

// ── Foundation: reduced motion ──────────────────────────────────
describe("reduced motion", () => {
  it("has a prefers-reduced-motion rule", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)")
  })

  it("sets animation-duration to near-zero", () => {
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
  })

  it("sets transition-duration to near-zero", () => {
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })

  it("uses auto scroll-behavior", () => {
    expect(css).toContain("scroll-behavior: auto")
  })
})

// ── Foundation: lang="id" ──────────────────────────────────────
describe("root layout language", () => {
  it('sets html lang="id"', () => {
    expect(layout).toContain('lang="id"')
  })

  it('does not contain lang="en"', () => {
    expect(layout).not.toContain('lang="en"')
  })
})

// ── OperationalPageHeader ──────────────────────────────────────
describe("OperationalPageHeader", () => {
  it("exports a named function", () => {
    expect(oph).toContain("export function OperationalPageHeader")
  })

  it("renders a single h1", () => {
    const h1Count = (oph.match(/<h1[\s>]/g) || []).length
    expect(h1Count).toBe(1)
  })

  it("does not contain marketing decoration classes", () => {
    expect(oph).not.toContain("blur-3xl")
    expect(oph).not.toContain("bg-gradient")
    expect(oph).not.toContain("backdrop-blur")
    expect(oph).not.toContain("shadow-2xl")
  })

  it("supports title, description, eyebrow, primaryAction, secondaryActions, metadata", () => {
    expect(oph).toContain("title:")
    expect(oph).toContain("description?:")
    expect(oph).toContain("eyebrow?:")
    expect(oph).toContain("primaryAction?:")
    expect(oph).toContain("secondaryActions?:")
    expect(oph).toContain("metadata?:")
  })
})

// ── SummaryMetric ──────────────────────────────────────────────
describe("SummaryMetric", () => {
  it("exports a named function", () => {
    expect(sm).toContain("export function SummaryMetric")
  })

  it("has a tone prop with semantic values", () => {
    expect(sm).toContain("neutral")
    expect(sm).toContain("success")
    expect(sm).toContain("warning")
    expect(sm).toContain("danger")
    expect(sm).toContain("info")
  })

  it("renders loading skeleton instead of value when loading", () => {
    expect(sm).toContain("loading ?")
    expect(sm).toContain("animate-pulse")
  })

  it("uses role status for screen readers", () => {
    expect(sm).toContain('role="status"')
  })

  it("supports href link wrapper", () => {
    expect(sm).toContain("if (href)")
    expect(sm).toContain("Link href={href}")
  })

  it("does not contain gradient classes", () => {
    expect(sm).not.toContain("bg-gradient")
    expect(sm).not.toContain("backdrop-blur")
  })
})

// ── StatusBadge ────────────────────────────────────────────────
describe("StatusBadge", () => {
  it("exports a named function", () => {
    expect(sb).toContain("export function StatusBadge")
  })

  it("requires a label and tone", () => {
    expect(sb).toContain("label: string")
    expect(sb).toContain("tone: StatusBadgeTone")
  })

  it("maps all five semantic tones to deterministic styles", () => {
    for (const tone of ["neutral", "success", "warning", "danger", "info"]) {
      expect(sb).toContain(`${tone}:`)
      expect(sb).toContain(`--mudha-status-${tone}`)
    }
  })

  it("always renders the label text", () => {
    expect(sb).toContain("{label}")
  })

  it("does not receive raw database status", () => {
    // The component is purely presentational — it receives label + tone, not a raw status string
    expect(sb).not.toContain("AVAILABLE")
    expect(sb).not.toContain("SOLD")
    expect(sb).not.toContain("COMPLETED")
  })
})

// ── LoadingState ───────────────────────────────────────────────
describe("LoadingState", () => {
  it("exports a named function", () => {
    expect(ls).toContain("export function LoadingState")
  })

  it("has variant prop with page/table/cards/metric", () => {
    expect(ls).toContain('"page"')
    expect(ls).toContain('"table"')
    expect(ls).toContain('"cards"')
    expect(ls).toContain('"metric"')
  })

  it("defaults label to Bahasa Indonesia", () => {
    expect(ls).toContain('Memuat data…')
  })

  it("uses role status and aria-busy", () => {
    expect(ls).toContain('role="status"')
    expect(ls).toContain('aria-busy="true"')
  })

  it("uses animate-pulse for skeleton", () => {
    expect(ls).toContain("animate-pulse")
  })

  it("clamps rowCount between 1 and 20", () => {
    expect(ls).toContain("Math.max(1, Math.min(rowCount, 20))")
  })
})

// ── EmptyState ─────────────────────────────────────────────────
describe("EmptyState", () => {
  it("exports a named function", () => {
    expect(es).toContain("export function EmptyState")
  })

  it("has role status", () => {
    expect(es).toContain('role="status"')
  })

  it("does not use danger tone", () => {
    expect(es).not.toContain("danger")
    expect(es).not.toContain("--mudha-status-danger")
  })

  it("renders title and optional description/primaryAction", () => {
    expect(es).toContain("{title}")
    expect(es).toContain("description &&")
    expect(es).toContain("primaryAction &&")
  })
})

// ── ErrorState ─────────────────────────────────────────────────
describe("ErrorState", () => {
  it("exports a named function", () => {
    expect(ers).toContain("export function ErrorState")
  })

  it("is a client component", () => {
    expect(ers).toContain('"use client"')
  })

  it("uses role alert", () => {
    expect(ers).toContain('role="alert"')
  })

  it("only renders retry button when onRetry is provided", () => {
    expect(ers).toContain("onRetry &&")
  })

  it("defaults retry label to Coba Lagi", () => {
    expect(ers).toContain('"Coba Lagi"')
  })

  it("uses semantic danger styling", () => {
    expect(ers).toContain("--mudha-status-danger-border")
    expect(ers).toContain("--mudha-status-danger-bg")
    expect(ers).toContain("--mudha-status-danger-text")
  })

  it("does not auto-retry on render", () => {
    expect(ers).not.toContain("useEffect")
    expect(ers).not.toContain("useCallback")
  })
})
