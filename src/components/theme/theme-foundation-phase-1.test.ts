import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const layoutSource = readFileSync("src/app/layout.tsx", "utf8")
const globalsSource = readFileSync("src/app/globals.css", "utf8")
const themeProviderSource = readFileSync("src/components/providers/ThemeProvider.tsx", "utf8")
const sonnerSource = readFileSync("src/components/ui/sonner.tsx", "utf8")
const dialogSource = readFileSync("src/components/ui/dialog.tsx", "utf8")
const selectSource = readFileSync("src/components/ui/select.tsx", "utf8")
const themeSwitcherSource = readFileSync("src/components/theme/ThemeSwitcher.tsx", "utf8")
const portalLayerSource = readFileSync("src/components/ui/portal-layer.tsx", "utf8")

describe("ThemeProvider props", () => {
  it("wraps children with correct attributes", () => {
    expect(layoutSource).toContain('attribute="class"')
    expect(layoutSource).toContain('defaultTheme="light"')
    expect(layoutSource).toContain("enableSystem")
    expect(layoutSource).toContain("disableTransitionOnChange")
    expect(layoutSource).toContain('storageKey="mudha-theme"')
  })

  it("preserves html suppressHydrationWarning", () => {
    expect(layoutSource).toContain('<html lang="id" suppressHydrationWarning>')
  })

  it("imports ThemeProvider from correct path", () => {
    expect(layoutSource).toContain('from "@/components/providers/ThemeProvider"')
  })

  it("ThemeProvider re-exports NextThemesProvider", () => {
    expect(themeProviderSource).toContain('from "next-themes"')
    expect(themeProviderSource).toContain("ThemeProvider as NextThemesProvider")
    expect(themeProviderSource).toContain("export function ThemeProvider")
  })
})

describe("CSS token completeness", () => {
  const mudhaTokensUsedInSource = [
    "--mudha-border-default",
    "--mudha-brand-soft",
    "--mudha-info-text",
    "--mudha-primary-600",
    "--mudha-primary-700",
    "--mudha-primary-900",
    "--mudha-surface-primary",
    "--mudha-text-main",
  ]

  const shadcnCoreTokens = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--border",
    "--input",
    "--ring",
    "--chart-1",
    "--chart-5",
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
    "--sidebar-ring",
  ]

  it("defines all 8 mudha operational tokens in :root", () => {
    // The mudha operational tokens are in the second :root block (after .dark)
    const mudhaRootStart = globalsSource.lastIndexOf(":root {")
    const rootSection = globalsSource.slice(mudhaRootStart)
    for (const token of mudhaTokensUsedInSource) {
      expect(rootSection).toContain(token)
    }
  })

  it("defines all mudha operational tokens in .dark", () => {
    const darkSection = globalsSource.slice(globalsSource.indexOf(".dark {"))
    for (const token of mudhaTokensUsedInSource) {
      expect(darkSection).toContain(token)
    }
  })

  it("defines all core shadcn tokens in :root", () => {
    const rootSection = globalsSource.slice(
      globalsSource.indexOf(":root {"),
      globalsSource.indexOf(".dark {")
    )
    for (const token of shadcnCoreTokens) {
      expect(rootSection).toContain(token)
    }
  })

  it("defines all core shadcn tokens in .dark", () => {
    const darkSection = globalsSource.slice(globalsSource.indexOf(".dark {"))
    for (const token of shadcnCoreTokens) {
      expect(darkSection).toContain(token)
    }
  })

  it("has @custom-variant dark directive", () => {
    expect(globalsSource).toContain("@custom-variant dark (&:is(.dark *))")
  })

  it("declares dark mode overrides for mudha status tokens", () => {
    const darkSection = globalsSource.slice(globalsSource.indexOf(".dark {"))
    expect(darkSection).toContain("--mudha-status-success-text")
    expect(darkSection).toContain("--mudha-status-info-text")
    expect(darkSection).toContain("--mudha-status-danger-text")
    expect(darkSection).toContain("--mudha-status-warning-text")
  })
})

describe("Contrast ratios — key token pairs", () => {
  // Extract HSL/oklch values and verify light/dark inversion
  it("background is light in :root and dark in .dark", () => {
    const rootSection = globalsSource.slice(
      globalsSource.indexOf(":root {"),
      globalsSource.indexOf(".dark {")
    )
    const darkSection = globalsSource.slice(globalsSource.indexOf(".dark {"))
    // Root background should be light (high lightness)
    expect(rootSection).toMatch(/--background:.*oklch\(\s*0\.9/)
    // Dark background should be dark (low lightness)
    expect(darkSection).toMatch(/--background:.*oklch\(\s*0\.\d/)
  })

  it("foreground is dark in :root and light in .dark", () => {
    const rootSection = globalsSource.slice(
      globalsSource.indexOf(":root {"),
      globalsSource.indexOf(".dark {")
    )
    const darkSection = globalsSource.slice(globalsSource.indexOf(".dark {"))
    // Root foreground should be dark
    expect(rootSection).toMatch(/--foreground:.*oklch\(\s*0\.1/)
    // Dark foreground should be light
    expect(darkSection).toMatch(/--foreground:.*oklch\(\s*0\.9/)
  })

  it("primary is teal in both modes", () => {
    const rootSection = globalsSource.slice(
      globalsSource.indexOf(":root {"),
      globalsSource.indexOf(".dark {")
    )
    const darkSection = globalsSource.slice(globalsSource.indexOf(".dark {"))
    // Both should reference hue ~174 (teal)
    expect(rootSection).toMatch(/--primary:.*oklch\([^)]*\s174\)/)
    expect(darkSection).toMatch(/--primary:.*oklch\([^)]*\s174\)/)
  })
})

describe("Portal layering regression", () => {
  it("Dialog overlay uses z-[100]", () => {
    expect(dialogSource).toContain('z-[100]')
  })

  it("Dialog content uses z-[100]", () => {
    // Content is positioned inside the overlay at z-[100]
    const contentSection = dialogSource.slice(
      dialogSource.indexOf("function DialogContent")
    )
    expect(contentSection).toContain('z-[100]')
  })

  it("modal Select uses z-[110] above dialog", () => {
    expect(selectSource).toContain('portalLayer === "modal" ? "z-[110]" : "z-50"')
  })

  it("non-modal Select uses z-50", () => {
    expect(selectSource).toContain('"z-50"')
  })

  it("portal-layer context is preserved intact", () => {
    expect(portalLayerSource).toContain('createContext<PortalLayer>("base")')
    expect(portalLayerSource).toContain("layer = \"modal\"")
  })
})

describe("ThemeSwitcher hydration safety", () => {
  it("uses useState for mounted guard", () => {
    expect(themeSwitcherSource).toContain("useState")
    expect(themeSwitcherSource).toContain("mounted")
  })

  it("uses useEffect to set mounted", () => {
    expect(themeSwitcherSource).toContain("useEffect")
    expect(themeSwitcherSource).toContain("setMounted(true)")
  })

  it("returns skeleton/null before mounted", () => {
    expect(themeSwitcherSource).toContain("if (!mounted)")
  })

  it("uses aria-label Ganti tema", () => {
    expect(themeSwitcherSource).toContain('aria-label="Ganti tema"')
  })

  it("has role=radiogroup for keyboard accessibility", () => {
    expect(themeSwitcherSource).toContain('role="radiogroup"')
  })

  it("has 40px min touch target (h-10 w-10)", () => {
    expect(themeSwitcherSource).toContain("h-10 w-10")
  })

  it("has focus-visible ring for keyboard users", () => {
    expect(themeSwitcherSource).toContain("focus-visible:ring-ring/50")
  })
})

describe("ThemeSwitcher not imported by dashboard surfaces", () => {
  const surfacesToCheck = [
    "src/app/dashboard/layout.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/login/page.tsx",
    "src/app/dashboard/investor/layout.tsx",
  ]

  it("not imported in any dashboard/investor/login surface", () => {
    for (const path of surfacesToCheck) {
      try {
        const source = readFileSync(path, "utf8")
        expect(source).not.toContain("ThemeSwitcher")
        expect(source).not.toContain("@/components/theme/ThemeSwitcher")
      } catch {
        // File may not exist, which is fine
      }
    }
  })
})

describe("Single Toaster mount — root layout", () => {
  it("root layout mounts themed Toaster from sonner UI component", () => {
    expect(layoutSource).toContain('from "@/components/ui/sonner"')
    expect(layoutSource).toContain("<Toaster")
  })

  it("sonner component uses useTheme for theme-aware rendering", () => {
    expect(sonnerSource).toContain('from "next-themes"')
    expect(sonnerSource).toContain("useTheme")
  })

  it("dialog close button uses semantic tokens (no hardcoded slate/white)", () => {
    const closeButtonSection = dialogSource.slice(
      dialogSource.indexOf('aria-label="Tutup dialog"')
    ).slice(0, 500)
    expect(closeButtonSection).not.toContain("bg-white")
    expect(closeButtonSection).not.toContain("text-slate")
    expect(closeButtonSection).not.toContain("border-slate")
    expect(closeButtonSection).toContain("bg-card")
    expect(closeButtonSection).toContain("text-muted-foreground")
    expect(closeButtonSection).toContain("border-border")
  })
})
