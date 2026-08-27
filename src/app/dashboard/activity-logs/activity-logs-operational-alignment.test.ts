import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
  `${process.cwd()}/src/app/dashboard/activity-logs/page.tsx`,
  "utf8",
)

describe("Activity-logs operational alignment", () => {
  /* ── imports ── */

  it("imports OperationalPageHeader", () => {
    expect(source).toContain("OperationalPageHeader")
  })

  it("imports Mudha LoadingState", () => {
    expect(source).toContain("LoadingState")
  })

  it("imports Mudha ErrorState", () => {
    expect(source).toContain("ErrorState")
  })

  it("imports Mudha EmptyState", () => {
    expect(source).toContain("EmptyState")
  })

  /* ── view-state contract ── */

  it("uses loading state before fetch completes", () => {
    expect(source).toMatch(/isLoading/)
  })

  it("has explicit error state separate from empty state", () => {
    expect(source).toContain("error")
    expect(source).toContain("ErrorState")
  })

  it("clears error before every fetch", () => {
    expect(source).toContain("setError(null)")
  })

  it("retry nonce triggers re-fetch", () => {
    expect(source).toContain("retryNonce")
    expect(source).toContain("setRetryNonce")
    expect(source).toContain("[retryNonce]")
  })

  it("clears stale data before each fetch", () => {
    expect(source).toContain("setLogs([])")
  })

  it("uses finally block for loading cleanup", () => {
    expect(source).toContain("finally")
  })

  it("rejects non-array payloads instead of crashing in map", () => {
    expect(source).toContain("Array.isArray(data)")
    expect(source).toContain("throw new Error")
  })

  it("uses a safe generic error message instead of exposing caught errors", () => {
    expect(source).toContain("Gagal memuat log aktivitas. Silakan coba lagi.")
    expect(source).not.toContain("err.message")
  })

  it("does not offer retry for access-denied responses", () => {
    expect(source).toContain("isAccessDenied")
    expect(source).toContain("onRetry={isAccessDenied ? undefined")
  })

  /* ── data parity ── */

  it("fetches from /api/activity-logs", () => {
    expect(source).toContain("/api/activity-logs")
  })

  it("preserves Log interface fields", () => {
    expect(source).toContain("action")
    expect(source).toContain("entity")
    expect(source).toContain("entityId")
    expect(source).toContain("details")
    expect(source).toContain("userName")
    expect(source).toContain("createdAt")
  })

  it("preserves action color mapping for CREATE/UPDATE/DELETE", () => {
    expect(source).toContain("CREATE")
    expect(source).toContain("UPDATE")
    expect(source).toContain("DELETE")
  })

  /* ── presentation parity ── */

  it("preserves desktop table with 5 columns", () => {
    expect(source).toContain("Waktu")
    expect(source).toContain("User")
    expect(source).toContain("Aksi")
    expect(source).toContain("Entitas")
    expect(source).toContain("Detail")
  })

  it("preserves mobile card view", () => {
    expect(source).toContain("lg:hidden")
    expect(source).toContain("lg:block")
  })

  it("preserves date formatting with Indonesian locale", () => {
    expect(source).toContain("dd MMM HH:mm")
    expect(source).toContain("locale: id")
  })

  it("preserves user fallback to System", () => {
    expect(source).toContain("System")
  })

  it("uses Mudha surface tokens", () => {
    expect(source).toContain("var(--mudha-surface-primary)")
  })

  /* ── safety ── */

  it("has no API, schema, migration, or dependency change", () => {
    expect(source).not.toContain("prisma")
    expect(source).not.toContain("ALTER TABLE")
    expect(source).not.toContain("DATABASE_URL")
    expect(source).not.toMatch(/import.*from.*[\"']@\/lib\/prisma/)
  })

  it("retry does not trigger mutation", () => {
    expect(source).not.toMatch(/\.delete\(|\.create\(|\.update\(/)
  })

  it("does not include marketing hero decorations", () => {
    expect(source).not.toMatch(/bg-gradient-to/)
    expect(source).not.toMatch(/blur-3xl|backdrop-blur/)
    expect(source).not.toMatch(/font-black/)
  })
})