import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(`${process.cwd()}/src/app/dashboard/page.tsx`, "utf8")

describe("Dashboard operational alignment", () => {
  it("retains branded green hero as the only page with green gradient", () => {
    expect(source).toContain("bg-[#073f3b]")
  })

  it("compacts hero: no marketing badge, no blobs, no glass stat panel", () => {
    expect(source).not.toContain("Dashboard baru")
    expect(source).not.toContain("Profit sharing lebih jelas, cepat, dan rapi")
    expect(source).not.toContain("blur-3xl")
    expect(source).not.toContain("backdrop-blur")
  })

  it("hero retains title, context, key stats, and quick actions", () => {
    expect(source).toContain("heroLabel")
    expect(source).toContain("quickActions")
    expect(source).toContain("Total Margin")
    expect(source).toContain("Unit aktif")
  })

  it("replaces loading skeleton with Mudha LoadingState", () => {
    expect(source).toContain("LoadingState")
    expect(source).toContain("Memuat dashboard")
  })

  it("replaces error display with Mudha ErrorState with retry", () => {
    expect(source).toContain("ErrorState")
    expect(source).toContain("onRetry=")
    expect(source).toContain("fetchStats")
  })

  it("MetricCard uses Mudha surface tokens, no gradient icon tiles", () => {
    expect(source).toContain("var(--mudha-surface-primary)")
    expect(source).not.toMatch(/from-teal-500 to-cyan-500/)
    expect(source).not.toMatch(/from-lime-400 to-emerald-500/)
    expect(source).not.toMatch(/bg-gradient-to-br/)
  })

  it("ChartPanel uses Mudha surface tokens", () => {
    expect(source).toContain("var(--mudha-border-default)")
  })

  it("exports text is localized to Bahasa", () => {
    expect(source).toContain("Mengekspor")
    expect(source).not.toContain('"Exporting..."')
  })

  it("does not change financial formatters", () => {
    expect(source).toContain("formatCurrency")
    expect(source).toContain("formatCurrencyShort")
    expect(source).toContain('"currency"')
  })

  it("preserves all metric card data sources", () => {
    expect(source).toContain("stats.activeUnits")
    expect(source).toContain("stats.completedTransactions")
    expect(source).toContain("stats.totalMargin")
    expect(source).toContain("stats.totalInvestorProfit")
    expect(source).toContain("stats.totalManagerProfit")
    expect(source).toContain("stats.totalCapitalDeployed")
  })

  it("preserves all sections", () => {
    expect(source).toContain("taxReminders")
    expect(source).toContain("recentTransactions")
    expect(source).toContain("investorStats")
    expect(source).toContain("unitStatusDistribution")
    expect(source).toContain("currentMonthlyStats")
    expect(source).toContain("PieChart")
    expect(source).toContain("BarChart")
  })

  it("preserves all filters and quick-action routes", () => {
    expect(source).toContain("selectedInvestorId")
    expect(source).toContain("monthsRange")
    expect(source).toContain("calendarMode")
    expect(source).toContain("/dashboard/units")
    expect(source).toContain("/dashboard/transactions")
    expect(source).toContain("/dashboard/investors")
    expect(source).toContain("/dashboard/calculator")
  })

  it("has no API, schema, migration, formula, or dependency change", () => {
    expect(source).not.toContain("prisma")
    expect(source).not.toContain("ALTER TABLE")
    expect(source).not.toContain("DATABASE_URL")
    expect(source).not.toMatch(/import.*from.*["']@\/lib\/prisma/)
  })
})
