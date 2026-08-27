import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
  `${process.cwd()}/src/app/dashboard/users/page.tsx`,
  "utf8",
)

describe("Users operational alignment", () => {
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

  /* ── view-state GET contract ── */

  it("has explicit isLoading state for user fetch", () => {
    expect(source).toContain("isLoading")
  })

  it("has explicit error state separate from empty", () => {
    expect(source).toContain("error")
    expect(source).toContain("ErrorState")
  })

  it("clears error before every fetch", () => {
    expect(source).toContain("setError(null)")
  })

  it("retry nonce triggers re-fetch via dependency", () => {
    expect(source).toContain("retryNonce")
    expect(source).toContain("setRetryNonce")
    expect(source).toContain("[retryNonce]")
  })

  it("clears stale users before each fetch", () => {
    expect(source).toContain("setUsers([])")
  })

  it("uses finally block for loading cleanup", () => {
    expect(source).toContain("finally")
  })

  it("validates payload is array before map", () => {
    expect(source).toContain("Array.isArray(data)")
  })

  /* ── authorization ── */

  it("checks isAdmin from session", () => {
    expect(source).toContain("isAdmin")
    expect(source).toContain("session?.user?.role")
  })

  it("shows Akses Ditolak for non-admin", () => {
    expect(source).toContain("Akses Ditolak")
  })

  /* ── data and role parity ── */

  it("preserves User interface fields", () => {
    expect(source).toContain("id: string")
    expect(source).toContain("name: string")
    expect(source).toContain("username: string | null")
    expect(source).toContain("email: string | null")
    expect(source).toContain("role:")
    expect(source).toContain("lastLoginAt: string | null")
    expect(source).toContain("lastLoginCity: string | null")
    expect(source).toContain("createdAt: string")
    expect(source).toContain("investor?:")
  })

  it("preserves role badge mapping for ADMIN/INVESTOR/VIEWER", () => {
    expect(source).toContain("ADMIN")
    expect(source).toContain("INVESTOR")
    expect(source).toContain("VIEWER")
    expect(source).toContain("getRoleBadge")
  })

  it("preserves role enum in form schema", () => {
    expect(source).toContain("z.enum([\"ADMIN\", \"INVESTOR\", \"VIEWER\"])")
  })

  /* ── mutation wiring ── */

  it("preserves create user POST endpoint", () => {
    expect(source).toContain("POST")
    expect(source).toContain("/api/users")
  })

  it("preserves edit user PUT endpoint with user id", () => {
    expect(source).toContain("editingUser.id")
    expect(source).toContain("PUT")
  })

  it("preserves delete user endpoint with deleteId", () => {
    expect(source).toContain("/api/users/${deleteId}")
    expect(source).toContain("DELETE")
  })

  it("success refresh calls fetchUsers", () => {
    expect(source).toContain("fetchUsers()")
  })

  it("retry does not call POST/PUT/DELETE", () => {
    expect(source).not.toMatch(/onRetry.*fetch\(.*POST|onRetry.*fetch\(.*PUT|onRetry.*fetch\(.*DELETE/)
  })

  /* ── presentation parity ── */

  it("preserves desktop table with 8 columns", () => {
    expect(source).toContain("Nama</TableHead>")
    expect(source).toContain("Username</TableHead>")
    expect(source).toContain("Email</TableHead>")
    expect(source).toContain("Role</TableHead>")
    expect(source).toContain("Login Terakhir</TableHead>")
    expect(source).toContain("Tanggal Dibuat</TableHead>")
    expect(source).toContain("Aksi</TableHead>")
  })

  it("preserves mobile card view", () => {
    expect(source).toContain("lg:hidden")
    expect(source).toContain("lg:block")
  })

  it("preserves edit and delete buttons per user row", () => {
    expect(source).toContain("handleEditClick(user)")
    expect(source).toContain("setDeleteId(user.id)")
  })

  it("preserves AlertDialog for delete confirmation", () => {
    expect(source).toContain("AlertDialog")
    expect(source).toContain("AlertDialogAction")
  })

  /* ── safety ── */

  it("has no API, schema, migration, or dependency change", () => {
    expect(source).not.toMatch(/import.*from.*[\"']@\/lib\/prisma/)
    expect(source).not.toContain("ALTER TABLE")
    expect(source).not.toContain("DATABASE_URL")
  })

  it("does not include marketing hero decorations", () => {
    expect(source).not.toMatch(/bg-gradient-to/)
    expect(source).not.toMatch(/blur-3xl|backdrop-blur/)
    expect(source).not.toMatch(/font-black/)
  })
})