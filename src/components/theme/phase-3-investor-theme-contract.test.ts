import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const investorApp = [
  "src/app/dashboard/investor/InvestorMonthlyChart.tsx",
  "src/app/dashboard/investor/InvestorProfileView.tsx",
  "src/app/dashboard/investor/InvestorRevenueChart.tsx",
  "src/app/dashboard/investor/InvestorSalesTrendChart.tsx",
  "src/app/dashboard/investor/InvestorShell.tsx",
  "src/app/dashboard/investor/InvestorTabs.tsx",
  "src/app/dashboard/investor/layout.tsx",
  "src/app/dashboard/investor/page.tsx",
  "src/app/dashboard/investor/profile/page.tsx",
]
const investorComponents = [
  "src/components/investor/InvestmentsTable.tsx",
  "src/components/investor/ManagedCapitalSelfCard.tsx",
  "src/components/investor/PaymentsTable.tsx",
  "src/components/investor/UnitDetailModal.tsx",
]
const phase3Surfaces = [
  ...investorApp,
  ...investorComponents,
  "src/app/login/page.tsx",
  "src/components/auth/LoginForm.tsx",
  "src/components/layout/InvestorSidebar.tsx",
  "src/components/layout/Navbar.tsx",
  "src/components/layout/Sidebar.tsx",
  "src/components/layout/BrandMark.tsx",
  "src/components/theme/ThemeSwitcher.tsx",
]
const source = (path: string) => readFileSync(path, "utf8")

function productionTsx(root: string): string[] {
  const result: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (path.endsWith(".tsx") && !path.endsWith(".test.tsx")) result.push(path)
    }
  }
  walk(root)
  return result.sort()
}

describe("Phase 3 production surface inventory", () => {
  it("covers every investor page and component", () => {
    expect(productionTsx("src/app/dashboard/investor")).toEqual(investorApp)
    expect(productionTsx("src/components/investor")).toEqual(investorComponents)
    for (const path of phase3Surfaces) expect(existsSync(path), path).toBe(true)
  })

  it("has zero unclassified Light-only neutral surfaces", () => {
    for (const path of [...investorApp, ...investorComponents]) {
      const value = source(path)
      expect(value, path).not.toMatch(/(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone)-\d+/)
      expect(value, path).not.toContain('labelStyle={{ color: "black" }}')
    }
  })

  it("keeps the exact narrow always-dark and paired-white inventory", () => {
    const tabs = source("src/app/dashboard/investor/InvestorTabs.tsx")
    const profile = source("src/app/dashboard/investor/InvestorProfileView.tsx")
    const detail = source("src/components/investor/UnitDetailModal.tsx")
    const sidebar = source("src/components/layout/InvestorSidebar.tsx")
    const login = source("src/app/login/page.tsx")
    const form = source("src/components/auth/LoginForm.tsx")
    expect((tabs.match(/bg-\[#073f3b\]/g) ?? []).length).toBe(1)
    expect((profile.match(/bg-\[#073f3b\]/g) ?? []).length).toBe(1)
    expect((detail.match(/bg-\[#073f3b\]/g) ?? []).length).toBe(1)
    expect((tabs.match(/bg-white\/10/g) ?? []).length).toBe(2)
    expect(sidebar).toContain('bg-[#062f2d]')
    expect(sidebar).toContain("<BrandMark inverse />")
    expect(sidebar).toContain('bg-white text-teal-950 hover:bg-white hover:text-teal-950')
    expect(login).toContain("bg-white/70")
    expect(login).toContain("dark:bg-card/60")
    expect(form).toContain("bg-white/85")
    expect(form).toContain("dark:bg-card/80")
  })
})

describe("Phase 3 shared ThemeSwitcher contract", () => {
  const switcher = source("src/components/theme/ThemeSwitcher.tsx")
  it("keeps raw Light Dark System selection and hydration safety", () => {
    expect(switcher).toContain('type ThemeOption = "light" | "dark" | "system"')
    expect(switcher).toContain('label: "Terang"')
    expect(switcher).toContain('label: "Gelap"')
    expect(switcher).toContain('label: "Sistem"')
    expect(switcher).toContain("const { setTheme, theme } = useTheme()")
    expect(switcher).not.toContain("resolvedTheme")
    expect(switcher).toContain("if (!mounted)")
    expect(switcher).toContain(': "light"')
    expect(switcher).toContain("onClick={() => setTheme(value)}")
    expect(switcher).toContain('role="radiogroup"')
    expect(switcher).toContain('role="radio"')
    expect(switcher).toContain("aria-checked={currentTheme === value}")
  })

  it("uses 44px targets, visible keyboard focus, and stable placeholder geometry", () => {
    expect(switcher).toContain("h-11 w-11")
    expect(switcher).toContain("focus-visible:ring-[3px]")
    expect(switcher).toContain("h-[52px] w-[148px]")
  })

  it("mounts once per responsive state at the required surfaces", () => {
    const admin = source("src/components/layout/Sidebar.tsx")
    const investor = source("src/components/layout/InvestorSidebar.tsx")
    const navbar = source("src/components/layout/Navbar.tsx")
    const login = source("src/app/login/page.tsx")
    expect((admin.match(/<ThemeSwitcher/g) ?? []).length).toBe(1)
    expect(admin).toContain("!compact")
    expect(admin).toContain("<ThemeSwitcher inverse />")
    expect((investor.match(/<ThemeSwitcher/g) ?? []).length).toBe(1)
    expect(investor).toContain("showThemeSwitcher = true")
    expect(investor).toContain("<ThemeSwitcher inverse />")
    expect((navbar.match(/<ThemeSwitcher/g) ?? []).length).toBe(1)
    expect(navbar).toContain("<InvestorSidebar showThemeSwitcher={false}")
    expect((login.match(/<ThemeSwitcher/g) ?? []).length).toBe(1)
  })

  it("uses the shared provider storage key and default Light", () => {
    const root = source("src/app/layout.tsx")
    expect(root).toContain('storageKey="mudha-theme"')
    expect(root).toContain('defaultTheme="light"')
    expect(root).toContain("enableSystem")
  })
})

describe("Phase 3 charts, native controls, evidence, and behavior boundaries", () => {
  it("wires every investor chart to theme-aware axis, tooltip, cursor, and exact-Light fills", () => {
    const contracts = [
      ["src/app/dashboard/investor/InvestorMonthlyChart.tsx", "income", "chartInvestorIncomeFill"],
      ["src/app/dashboard/investor/InvestorRevenueChart.tsx", "revenue", "chartInvestorRevenueFill"],
      ["src/app/dashboard/investor/InvestorSalesTrendChart.tsx", "count", "chartInvestorSalesFill"],
    ] as const
    for (const [path, dataKey, fill] of contracts) {
      const value = source(path)
      expect(value).toContain("getChartColors(isDark)")
      expect(value).toContain("stroke={chart.axis}")
      expect(value).toContain("cursor={{ fill: chart.cursor }}")
      expect(value).toContain("backgroundColor: chart.tooltipBackground")
      expect(value).toContain("borderColor: chart.tooltipBorder")
      expect(value).toContain("color: chart.tooltipLabel")
      expect(value).toContain(`dataKey="${dataKey}"`)
      expect(value).toContain(`fill={${fill}(isDark)}`)
      expect(value).toContain("min-w-0")
      expect(value).not.toContain('color: "black"')
    }
  })

  it("themes native controls and does not theme evidence pixels", () => {
    const investments = source("src/components/investor/InvestmentsTable.tsx")
    expect((investments.match(/<select/g) ?? []).length).toBe(2)
    expect((investments.match(/dark:\[color-scheme:dark\]/g) ?? []).length).toBe(2)
    const loginForm = source("src/components/auth/LoginForm.tsx")
    expect((loginForm.match(/dark:\[color-scheme:dark\]/g) ?? []).length).toBe(2)
    for (const path of [...investorApp, ...investorComponents]) {
      expect(source(path), path).not.toMatch(/(?:filter|invert|brightness|mix-blend)-/)
    }
  })

  it("keeps login/auth, investor fetch, filters, sort, and date mode signatures", () => {
    expect(source("src/components/auth/LoginForm.tsx")).toContain('signIn("credentials", {')
    expect(source("src/components/auth/LoginForm.tsx")).toContain("redirect: false")
    expect(source("src/app/dashboard/investor/page.tsx")).toContain('fetch(`/api/investor/dashboard?months=${monthsRange}`)')
    expect(source("src/components/investor/ManagedCapitalSelfCard.tsx")).toContain('fetch("/api/investors/me/capital-summary", {')
    expect(source("src/app/dashboard/investor/profile/page.tsx")).toContain("const session = await auth()")
    expect(source("src/app/dashboard/investor/profile/page.tsx")).toContain("const investor = await prisma.investor.findUnique({")
    expect(source("src/app/dashboard/investor/profile/page.tsx")).toContain("where: { userId: session.user.id }")
    expect(source("src/components/investor/InvestmentsTable.tsx")).toContain("const filteredData = data.filter")
    expect(source("src/components/investor/InvestmentsTable.tsx")).toContain("const sortedData = [...filteredData].sort")
    expect(source("src/app/dashboard/investor/InvestorTabs.tsx")).toContain("calendarMode === 'hijri'")
  })

  it("keeps one root Toaster and portal contracts", () => {
    expect((source("src/app/layout.tsx").match(/<Toaster/g) ?? []).length).toBe(1)
    expect((source("src/app/dashboard/layout.tsx").match(/<Toaster/g) ?? []).length).toBe(0)
    expect((source("src/components/ui/dialog.tsx").match(/z-\[100\]/g) ?? []).length).toBe(2)
    expect(source("src/components/ui/select.tsx")).toContain('portalLayer === "modal" ? "z-[110]" : "z-50"')
  })

  it("keeps the existing logo artwork and limits theme icons", () => {
    const brand = source("src/components/layout/BrandMark.tsx")
    expect(brand).toContain('import { ChartNoAxesCombined, Sparkles } from "lucide-react"')
    expect(switcherIconImport()).toBe('import { Sun, Moon, Monitor } from "lucide-react"')
  })
})

function switcherIconImport() {
  return source("src/components/theme/ThemeSwitcher.tsx").split("\n").find((line) => line.includes('from "lucide-react"'))
}
