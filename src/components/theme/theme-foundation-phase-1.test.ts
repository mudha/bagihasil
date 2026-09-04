import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const layoutSource = readFileSync("src/app/layout.tsx", "utf8")
const globalsSource = readFileSync("src/app/globals.css", "utf8")
const themeProviderSource = readFileSync("src/components/providers/ThemeProvider.tsx", "utf8")
const sonnerSource = readFileSync("src/components/ui/sonner.tsx", "utf8")
const dialogSource = readFileSync("src/components/ui/dialog.tsx", "utf8")
const selectSource = readFileSync("src/components/ui/select.tsx", "utf8")
const themeSwitcherSource = readFileSync("src/components/theme/ThemeSwitcher.tsx", "utf8")
const portalLayerSource = readFileSync("src/components/ui/portal-layer.tsx", "utf8")
const dashboardLayoutSource = readFileSync("src/app/dashboard/layout.tsx", "utf8")
const investorLayoutSource = readFileSync("src/app/dashboard/investor/layout.tsx", "utf8")

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
  const section = (selector: string) => {
    const start = globalsSource.indexOf(selector)
    return globalsSource.slice(start, globalsSource.indexOf("\n}", start))
  }
  const token = (css: string, name: string) => {
    const match = css.match(new RegExp(`${name}:\\s*([^;]+)`))
    if (!match) throw new Error(`Missing ${name}`)
    return match[1].trim()
  }
  const rgb = (value: string): [number, number, number] => {
    const hex = value.match(/#([0-9a-f]{6})/i)
    if (hex) return [0, 1, 2].map((index) => parseInt(hex[1].slice(index * 2, index * 2 + 2), 16) / 255) as [number, number, number]
    const match = value.match(/oklch\(([^)]+)\)/)
    if (!match) throw new Error(`Unsupported color: ${value}`)
    const [l, c, h] = match[1].trim().split(/\s+/).map(Number)
    const radians = (h * Math.PI) / 180
    const a = c * Math.cos(radians)
    const b = c * Math.sin(radians)
    const l1 = l + 0.3963377774 * a + 0.2158037573 * b
    const m1 = l - 0.1055613458 * a - 0.0638541728 * b
    const s1 = l - 0.0894841775 * a - 1.291485548 * b
    const [ll, mm, ss] = [l1 ** 3, m1 ** 3, s1 ** 3]
    return [
      4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
      -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
      -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
    ].map((channel) => Math.max(0, Math.min(1, channel))) as [number, number, number]
  }
  const luminance = (value: [number, number, number]) => value.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return sum + linear * [0.2126, 0.7152, 0.0722][index]
  }, 0)
  const contrast = (foreground: string, background: string) => {
    const a = luminance(rgb(foreground))
    const b = luminance(rgb(background))
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }

  it("muted foreground meets AA against background and card in both themes", () => {
    for (const css of [section(":root {"), section(".dark {")]) {
      expect(contrast(token(css, "--muted-foreground"), token(css, "--background"))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token(css, "--muted-foreground"), token(css, "--card"))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("foreground and primary control pairs meet AA in both themes", () => {
    for (const css of [section(":root {"), section(".dark {")]) {
      expect(contrast(token(css, "--foreground"), token(css, "--background"))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token(css, "--foreground"), token(css, "--card"))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token(css, "--primary-foreground"), token(css, "--primary"))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("focus ring meets the 3:1 non-text contrast requirement", () => {
    for (const css of [section(":root {"), section(".dark {")]) {
      expect(contrast(token(css, "--ring"), token(css, "--background"))).toBeGreaterThanOrEqual(3)
      expect(contrast(token(css, "--ring"), token(css, "--card"))).toBeGreaterThanOrEqual(3)
    }
  })

  it("keeps muted foreground visually distinct from primary foreground", () => {
    expect(token(section(":root {"), "--muted-foreground")).not.toBe(token(section(":root {"), "--foreground"))
    expect(token(section(".dark {"), "--muted-foreground")).not.toBe(token(section(".dark {"), "--foreground"))
  })

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

  it("tracks raw theme so system remains selected", () => {
    expect(themeSwitcherSource).toContain("const { setTheme, theme } = useTheme()")
    expect(themeSwitcherSource).not.toContain("resolvedTheme")
    expect(themeSwitcherSource).toContain('theme === "system"')
  })
})

describe("Phase 3 — ThemeSwitcher activated in specific surfaces", () => {
  // Phase 3 intentionally activates ThemeSwitcher on: Sidebar, InvestorSidebar, Navbar (mobile), Login
  const activatedSurfaces = [
    "src/components/layout/Sidebar.tsx",
    "src/components/layout/InvestorSidebar.tsx",
    "src/components/layout/Navbar.tsx",
    "src/app/login/page.tsx",
  ]
  const nonActivatedSurfaces = [
    "src/app/dashboard/layout.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/investor/layout.tsx",
    "src/components/auth/LoginForm.tsx",
  ]

  it("ThemeSwitcher imported in activation surfaces", () => {
    for (const path of activatedSurfaces) {
      expect(existsSync(path), `${path} must exist`).toBe(true)
      const source = readFileSync(path, "utf8")
      expect(source).toContain("@/components/theme/ThemeSwitcher")
    }
  })

  it("ThemeSwitcher not in non-activation surfaces", () => {
    for (const path of nonActivatedSurfaces) {
      if (!existsSync(path)) continue
      const source = readFileSync(path, "utf8")
      expect(source).not.toContain("ThemeSwitcher")
      expect(source).not.toContain("@/components/theme/ThemeSwitcher")
    }
  })
})

describe("Theme artifact and CSS variable integrity", () => {
  it("does not retain the temporary skeleton primitive", () => {
    expect(existsSync("src/components/ui/skeleton.tsx")).toBe(false)
  })

  it("has no unresolved or cyclic variables in globals.css", () => {
    const declarations = new Map<string, string>()
    for (const match of globalsSource.matchAll(/(--[\w-]+):\s*([^;]+);/g)) declarations.set(match[1], match[2])
    const external = new Set(["--font-geist-sans", "--font-geist-mono"])
    for (const [name, value] of declarations) {
      for (const reference of value.matchAll(/var\((--[\w-]+)/g)) {
        expect(declarations.has(reference[1]) || external.has(reference[1]), `${name} references missing ${reference[1]}`).toBe(true)
      }
      const seen = new Set([name])
      let current = value
      while (true) {
        const reference = current.match(/var\((--[\w-]+)/)?.[1]
        if (!reference || external.has(reference)) break
        expect(seen.has(reference), `cycle reaches ${reference}`).toBe(false)
        seen.add(reference)
        current = declarations.get(reference) ?? ""
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

  it("has exactly one effective Toaster in the actual nested layout tree", () => {
    expect((layoutSource.match(/<Toaster\b/g) ?? []).length).toBe(1)
    expect((dashboardLayoutSource.match(/<Toaster\b/g) ?? []).length).toBe(0)
    expect((investorLayoutSource.match(/<Toaster\b/g) ?? []).length).toBe(0)
    expect(dashboardLayoutSource).not.toContain("@/components/ui/sonner")
    expect(investorLayoutSource).not.toContain("@/components/ui/sonner")
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
