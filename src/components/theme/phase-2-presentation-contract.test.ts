import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const inventory = [
  "src/app/dashboard/layout.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/calculator/page.tsx",
  "src/app/dashboard/activity-logs/page.tsx",
  "src/app/dashboard/investors/page.tsx",
  "src/app/dashboard/units/page.tsx",
  "src/app/dashboard/transactions/page.tsx",
  "src/app/dashboard/transactions/[id]/page.tsx",
  "src/app/dashboard/users/page.tsx",
  "src/components/layout/Sidebar.tsx",
  "src/components/layout/Navbar.tsx",
  "src/components/layout/BrandMark.tsx",
  "src/components/transactions/AddPaymentDialog.tsx",
  "src/components/transactions/AddCostDialog.tsx",
  "src/components/transactions/EditTransactionDetailsDialog.tsx",
  "src/components/transactions/EditProfitSharingDialog.tsx",
  "src/components/transactions/FinalizeTransactionDialog.tsx",
  "src/components/transactions/AdminTransactionDetailDialog.tsx",
  "src/components/transactions/ManageCostProofsDialog.tsx",
  "src/components/transactions/UpdateTransactionProofDialog.tsx",
  "src/components/import/ImportUnitsDialog.tsx",
  "src/components/import/ImportTransactionsDialog.tsx",
  "src/components/units/AdminUnitDetailDialog.tsx",
  "src/components/units/UnitCardMobile.tsx",
  "src/components/ui/single-image-upload.tsx",
  "src/components/ui/multi-image-upload.tsx",
  "src/components/ui/multiple-image-upload.tsx",
  "src/components/ui/image-preview-dialog.tsx",
  "src/components/ui/image-hover-preview.tsx",
  "src/components/ui/view-image-dialog.tsx"
] as const
const literalPattern = /(?<!dark:)(?:bg|text|border|from|via|to|ring|fill|stroke)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]+)?(?:\/\d+)?/
const exactUnpairedWhitelist = new Set([
  "src/app/dashboard/layout.tsx::hidden lg:fixed lg:inset-y-0 lg:z-[80] lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-teal-900/20 lg:bg-[#062f2d]",
  "src/app/dashboard/page.tsx::grid gap-3 rounded-lg border border-white/10 bg-white/10 p-4",
  "src/app/dashboard/page.tsx::grid grid-cols-2 gap-3 border-t border-white/10 pt-3",
  "src/app/dashboard/page.tsx::grid size-10 place-items-center rounded-lg bg-white text-teal-700",
  "src/app/dashboard/page.tsx::grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--mudha-surface-subtle)] text-[var(--mudha-primary-700)] transition group-hover:bg-[var(--mudha-primary-700)] group-hover:text-white",
  "src/app/dashboard/page.tsx::group flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-teal-950",
  "src/app/dashboard/page.tsx::max-w-xl text-sm leading-6 text-teal-50/70 sm:text-base",
  "src/app/dashboard/page.tsx::rounded-lg bg-[#073f3b] text-white shadow-2xl shadow-teal-950/15",
  "src/app/dashboard/page.tsx::size-4 text-teal-200 transition group-hover:text-teal-600",
  "src/app/dashboard/page.tsx::text-xs font-semibold uppercase tracking-[0.18em] text-teal-100/70",
  "src/app/dashboard/page.tsx::text-xs text-teal-100/65",
  "src/app/dashboard/page.tsx::text-xs text-teal-100/70",
  "src/app/dashboard/transactions/page.tsx::bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-16 text-left text-white sm:px-7 sm:py-5 sm:pr-20",
  "src/app/dashboard/transactions/page.tsx::flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm",
  "src/app/dashboard/transactions/page.tsx::mt-2 text-xl font-black tracking-tight text-white sm:text-2xl",
  "src/app/dashboard/transactions/page.tsx::w-fit rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-teal-100",
  "src/app/dashboard/units/page.tsx::flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm",
  "src/components/layout/BrandMark.tsx::absolute -bottom-3 -left-2 size-8 rounded-full bg-lime-200/25",
  "src/components/layout/BrandMark.tsx::absolute -right-3 -top-3 size-7 rounded-full bg-white/25",
  "src/components/layout/BrandMark.tsx::absolute right-1.5 top-1.5 size-3 text-white/80",
  "src/components/layout/BrandMark.tsx::relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25",
  "src/components/layout/BrandMark.tsx::relative z-10 size-6 text-white",
  "src/components/layout/Navbar.tsx::h-dvh w-[min(84vw,280px)] overflow-hidden overscroll-contain border-none bg-[#062f2d] p-0 text-white shadow-xl",
  "src/components/layout/Sidebar.tsx::flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-100/60",
  "src/components/layout/Sidebar.tsx::flex h-full min-h-0 flex-col bg-[#062f2d] text-white",
  "src/components/layout/Sidebar.tsx::font-semibold text-teal-50/75",
  "src/components/layout/Sidebar.tsx::mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-teal-50/55",
  "src/components/layout/Sidebar.tsx::w-full justify-start text-teal-50/70 hover:bg-white/10 hover:text-white",
  "src/components/transactions/AddPaymentDialog.tsx::border-b bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-16 text-left text-white sm:px-6 sm:py-5 sm:pr-20",
  "src/components/transactions/AddPaymentDialog.tsx::h-3 w-3 text-blue-500 animate-spin motion-reduce:animate-none",
  "src/components/transactions/AddPaymentDialog.tsx::text-teal-50/75",
  "src/components/transactions/AddPaymentDialog.tsx::text-xs font-medium text-blue-600 animate-pulse flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-full border border-blue-100",
  "src/components/transactions/AdminTransactionDetailDialog.tsx::bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-14 text-white sm:px-6 sm:py-5 sm:pr-16",
  "src/components/transactions/AdminTransactionDetailDialog.tsx::block h-full min-h-[220px] w-full cursor-pointer bg-slate-950 relative",
  "src/components/transactions/AdminTransactionDetailDialog.tsx::flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10",
  "src/components/transactions/AdminTransactionDetailDialog.tsx::flex items-center gap-2 text-teal-100/80",
  "src/components/transactions/AdminTransactionDetailDialog.tsx::max-w-2xl text-sm leading-relaxed text-teal-50/80",
  "src/components/transactions/AdminTransactionDetailDialog.tsx::text-2xl font-black tracking-tight text-white sm:text-3xl",
  "src/components/transactions/FinalizeTransactionDialog.tsx::border-b bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-16 text-left text-white sm:px-6 sm:py-5 sm:pr-20",
  "src/components/transactions/FinalizeTransactionDialog.tsx::h-3 w-3 text-blue-500 animate-spin motion-reduce:animate-none",
  "src/components/transactions/FinalizeTransactionDialog.tsx::text-xs font-medium text-blue-600 animate-pulse flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-full border border-blue-100",
  "src/components/ui/image-hover-preview.tsx::mt-2 rounded-lg border border-slate-900/10 bg-slate-950/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur",
  "src/components/ui/image-hover-preview.tsx::overflow-hidden rounded-xl border border-white/70 bg-slate-950 shadow-2xl shadow-slate-950/25 ring-1 ring-slate-950/10",
  "src/components/ui/image-preview-dialog.tsx::absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-10 transition-opacity duration-300",
  "src/components/ui/image-preview-dialog.tsx::h-9 w-9 text-white hover:bg-white/20 rounded-full",
  "src/components/ui/image-preview-dialog.tsx::text-white font-medium drop-shadow-md",
  "src/components/ui/single-image-upload.tsx::absolute bottom-0 left-0 right-0 bg-black/50 text-white p-1 px-2 text-xs truncate",
  "src/components/ui/view-image-dialog.tsx::h-4 w-4 text-blue-500",
  "src/components/ui/view-image-dialog.tsx::relative w-full h-auto min-h-[300px] flex items-center justify-center bg-black/50 rounded-lg p-4",
  "src/components/units/AdminUnitDetailDialog.tsx::bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-4 py-4 pr-14 text-white sm:px-6 sm:py-5 sm:pr-16",
  "src/components/units/AdminUnitDetailDialog.tsx::block h-full min-h-[180px] w-full cursor-pointer bg-slate-950 relative",
  "src/components/units/AdminUnitDetailDialog.tsx::break-words text-2xl font-black tracking-tight text-white sm:text-3xl",
  "src/components/units/AdminUnitDetailDialog.tsx::flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10",
  "src/components/units/AdminUnitDetailDialog.tsx::flex items-center gap-2 text-teal-100/80",
  "src/components/units/AdminUnitDetailDialog.tsx::inline-flex max-w-full rounded-lg bg-white/10 px-3 py-1 font-mono text-sm font-bold text-teal-50 [overflow-wrap:anywhere]",
  "src/components/units/UnitCardMobile.tsx::flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm"
])

function unpairedLiteralClasses() {
  const rows: string[] = []
  for (const path of inventory) {
    const source = readFileSync(path, "utf8")
    for (const match of source.matchAll(/className\s*=\s*"([\s\S]*?)"/g)) {
      const value = match[1].split(/\s+/).filter(Boolean).join(" ")
      if (literalPattern.test(value) && !value.includes("dark:")) rows.push(`${path}::${value}`)
      literalPattern.lastIndex = 0
    }
  }
  return [...new Set(rows)].sort()
}

describe("Phase 2 complete admin presentation inventory", () => {
  it("all mandatory admin surface files exist", () => {
    expect(inventory.every(existsSync)).toBe(true)
  })
  it("has no unclassified unpaired literal class", () => {
    expect(unpairedLiteralClasses()).toEqual([...exactUnpairedWhitelist].sort())
  })
  it("keeps the whitelist narrow, exact, and category-complete", () => {
    expect(exactUnpairedWhitelist.size).toBe(56)
    const items = [...exactUnpairedWhitelist]
    expect(items.every((item) => item.includes("::"))).toBe(true)
    expect(items.some((item) => item.includes("#062f2d") || item.includes("#073f3b"))).toBe(true) // brand shell
    expect(items.some((item) => item.includes("bg-slate-950") || item.includes("from-black/60"))).toBe(true) // evidence viewer
    expect(items.some((item) => item.includes("rounded-full") && item.includes("text-white"))).toBe(true) // status/identity
    expect(items.some((item) => item.includes("var(--mudha-"))).toBe(true) // operational token on invariant state
  })
})

describe("Phase 2 evidence pixels remain untouched", () => {
  it("adds no image filter/invert/brightness/blend classes", () => {
    for (const path of inventory) {
      const source = readFileSync(path, "utf8")
      const imageMarkup = [...source.matchAll(/<(?:Image|img)\b[\s\S]*?>/g)].map((match) => match[0]).join("\n")
      expect(imageMarkup).not.toMatch(/(?:\bfilter-|\binvert(?:-|\b)|\bbrightness-|\bmix-blend-)/)
    }
  })
  it("native CSV controls explicitly adopt dark browser chrome", () => {
    for (const path of ["src/components/import/ImportUnitsDialog.tsx", "src/components/import/ImportTransactionsDialog.tsx"]) {
      const source = readFileSync(path, "utf8")
      expect(source).toContain("dark:[color-scheme:dark]")
      expect(source).toContain("file:bg-muted")
      expect(source).toContain("file:text-foreground")
    }
  })
})

describe("Phase 2 immutable behavior boundaries", () => {
  it("retains dashboard GET endpoints and four chart data sources", () => {
    const source = readFileSync("src/app/dashboard/page.tsx", "utf8")
    expect(source).toContain("`/api/dashboard?months=${monthsRange}`")
    expect(source).toContain("monthlyStatsHijri")
    expect(source).toContain("unitStatusDistribution")
    expect(source).toContain("investorStats")
    expect(source).toContain("monthlyStats")
  })
  it("does not duplicate Toaster", () => {
    expect((readFileSync("src/app/layout.tsx", "utf8").match(/<Toaster/g) ?? []).length).toBe(1)
    expect((readFileSync("src/app/dashboard/layout.tsx", "utf8").match(/<Toaster/g) ?? []).length).toBe(0)
  })
  it("Phase 3 activates ThemeSwitcher in Sidebar, InvestorSidebar, Navbar, Login", () => {
    const activated = [
      "src/components/layout/Sidebar.tsx",
      "src/components/layout/InvestorSidebar.tsx",
      "src/components/layout/Navbar.tsx",
      "src/app/login/page.tsx",
    ]
    for (const path of activated) {
      expect(existsSync(path), `${path} must exist`).toBe(true)
      const source = readFileSync(path, "utf8")
      expect(source).toContain("@/components/theme/ThemeSwitcher")
    }
  })
  it("preserves investor Navbar presentation while theming admin Navbar", () => {
    const source = readFileSync("src/components/layout/Navbar.tsx", "utf8")
    expect(source).toContain('type === "admin"')
    expect(source).toContain('bg-card/85 p-3 shadow-sm backdrop-blur-xl transition-all duration-300 sm:p-4 lg:hidden dark:border-teal-200')
    // Phase 3: investor branch uses dark:bg-background/80 instead of dark:bg-gray-900/80
    expect(source).toContain('bg-white/85 p-3 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-border dark:bg-background/80')
    expect(source).toContain('"h-6 w-6 text-teal-950 dark:text-teal-100"')
    expect(source).toContain('type === "admin" ? "bg-teal-100 text-teal-700"')
  })
  it("keeps shared investor image action at its original presentation", () => {
    const source = readFileSync("src/components/ui/view-image-dialog.tsx", "utf8")
    expect(source).toContain('className="h-4 w-4 text-blue-500"')
    expect(source).not.toContain('text-blue-500 dark:')
  })
  it("themes every dashboard tooltip content surface", () => {
    const source = readFileSync("src/app/dashboard/page.tsx", "utf8")
    expect((source.match(/contentStyle=\{\{ backgroundColor: chart\.tooltipBackground, borderColor: chart\.tooltipBorder, color: chart\.tooltipLabel \}\}/g) ?? []).length).toBe(5)
  })
})
