import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const page = readFileSync("src/app/dashboard/investors/page.tsx", "utf8")

describe("Investors page — Mudha Operational pilot", () => {
  // ── Header ──
  it("uses OperationalPageHeader instead of h2 marketing hero", () => {
    expect(page).toContain('import { OperationalPageHeader } from')
    expect(page).toContain("<OperationalPageHeader")
    expect(page).toContain('title="Data Pemodal"')
    // h1 is rendered internally by OperationalPageHeader
    expect(page).not.toMatch(/<h2[\s>]/)
    expect(page).not.toMatch(/<h1[\s>]/)
  })

  it("does not contain marketing copy or gradient hero", () => {
    expect(page).not.toContain("blur-3xl")
    expect(page).not.toContain("bg-gradient")
    expect(page).not.toContain("backdrop-blur")
    expect(page).not.toContain("shadow-2xl")
  })

  // ── Loading / Empty / Error states ──
  it("has investorsLoading state", () => {
    expect(page).toContain("investorsLoading")
    expect(page).toContain("setInvestorsLoading")
  })

  it("has investorsError state", () => {
    expect(page).toContain("investorsError")
    expect(page).toContain("setInvestorsError")
  })

  it("uses LoadingState during initial load", () => {
    expect(page).toContain('import { LoadingState } from')
    expect(page).toContain("<LoadingState")
    expect(page).toContain('variant="table"')
  })

  it("uses ErrorState when investor fetch fails", () => {
    expect(page).toContain('import { ErrorState } from')
    expect(page).toContain("<ErrorState")
    expect(page).toContain("onRetry={fetchInvestors}")
  })

  it("uses EmptyState for empty investor list", () => {
    expect(page).toContain('import { EmptyState } from')
    expect(page).toContain("<EmptyState")
    expect(page).toContain("Belum ada data pemodal")
  })

  it("does not show empty/zero during loading", () => {
    // Desktop table and mobile cards are gated behind !investorsLoading
    expect(page).toContain("!investorsLoading && !investorsError && investors.length > 0")
  })

  it("tracks users loading and failure separately from investor list", () => {
    expect(page).toContain("usersLoading")
    expect(page).toContain("usersError")
    expect(page).toContain("Memuat akun...")
    expect(page).toContain("Akun terhubung tidak tersedia.")
    expect(page).toContain("Akun Terhubung")
  })

  it("does not state that an account is unconnected while users data is unavailable", () => {
    expect(page).toContain("usersLoading ? (")
    expect(page).toContain("usersError ? (")
    expect(page).toContain("connectedUser ? (")
  })

  // ── StatusBadge ──
  it("uses StatusBadge for active/inactive labels", () => {
    expect(page).toContain('import { StatusBadge } from')
    expect(page).toContain("<StatusBadge")
    expect(page).toContain('label={investor.isActive ? "Aktif" : "Nonaktif"}')
    expect(page).toContain('tone={investor.isActive ? "success" : "neutral"}')
  })

  it("does not have hardcoded green/slate status spans", () => {
    expect(page).not.toMatch(/bg-green-100 text-green-700/)
    expect(page).not.toMatch(/bg-slate-100 text-slate-600/)
  })

  // ── SummaryMetric ──
  it("shows summary metrics in header metadata after load", () => {
    expect(page).toContain('import { SummaryMetric } from')
    expect(page).toContain("Total Pemodal")
    expect(page).toContain("Pemodal Aktif")
  })

  // ── Desktop table ──
  it("has min-width and horizontal scroll wrapper for desktop table", () => {
    expect(page).toContain("min-w-[1100px]")
    expect(page).toContain("overflow-x-auto")
  })

  // ── Mobile cards ──
  it("has 44px touch targets on mobile card actions", () => {
    expect(page).toContain("min-h-[44px]")
  })

  // ── Accessibility ──
  it("has aria-label on Switch controls", () => {
    expect(page).toContain("aria-label=")
    expect(page).toContain("Nonaktifkan")
    expect(page).toContain("Aktifkan")
  })

  // ── Action parity ──
  it("preserves all existing actions", () => {
    expect(page).toContain("Tambah Pemodal")
    expect(page).toContain("Ekspor Semua")
    expect(page).toContain("Edit")
    expect(page).toContain("Modal")
    expect(page).toContain("handleToggleActive")
    expect(page).toContain("handleEdit")
    expect(page).toContain("handleExportAll")
  })

  it("preserves VIEWER guard for mutations", () => {
    expect(page).toContain("isViewer")
    expect(page).toContain("Read-only")
  })

  // ── Financial contract ──
  it("uses formatRupiahOrNull for financial values", () => {
    expect(page).toContain("formatRupiahOrNull")
  })

  it("preserves capital warning display without legacy emoji", () => {
    expect(page).toContain("ALLOCATION_EXCEEDS_MANAGED_BALANCE")
    expect(page).toContain("<AlertTriangle")
    expect(page).not.toContain("⚠ Melebihi")
    expect(page).toContain("Melebihi")
  })

  it("preserves Belum diatur for UNSET status", () => {
    expect(page).toContain("Belum diatur")
  })

  // ── Capital summary partial failure ──
  it("capital summary error does not block investor list", () => {
    // Error alert is shown separately, not replacing the table
    expect(page).toContain('capitalViewState.kind === "error"')
    expect(page).toContain("fetchCapitalSummaries")
  })

  // ── Scope guard ──
  it("does not import from page module or API", () => {
    expect(page).not.toMatch(/from.*\/dashboard\/.*page/)
    expect(page).not.toMatch(/from.*\/api\//)
  })

  it("does not introduce new any annotations (pre-existing filter cast excluded)", () => {
    // One pre-existing (u: any) cast in user filter is tolerated
    const lines = page.split("\n").filter(l => !l.includes("filter((u: any)"))
    expect(lines.join("\n")).not.toMatch(/:\s*any\b/)
  })
})
