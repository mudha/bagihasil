import { readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

const css = readFileSync("src/app/globals.css", "utf8")
const toneSource = readFileSync("src/lib/investor-tone.ts", "utf8")
const chartSource = readFileSync("src/lib/chart-theme.ts", "utf8")

const dashboardFiles = [
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/layout.tsx",
    "src/app/dashboard/units/page.tsx",
    "src/app/dashboard/transactions/page.tsx",
    "src/app/dashboard/transactions/[id]/page.tsx",
]

const componentFiles = [
    "src/components/transactions/AddPaymentDialog.tsx",
    "src/components/transactions/AdminTransactionDetailDialog.tsx",
    "src/components/units/UnitCardMobile.tsx",
    "src/components/units/AdminUnitDetailDialog.tsx",
    "src/components/ui/image-preview-dialog.tsx",
    "src/components/ui/multiple-image-upload.tsx",
    "src/components/ui/multi-image-upload.tsx",
    "src/components/ui/slider.tsx",
    "src/components/ui/pull-to-refresh.tsx",
    "src/components/layout/Sidebar.tsx",
    "src/components/layout/Navbar.tsx",
]

describe("Phase 3 — ThemeSwitcher activated in admin surfaces", () => {
    // Phase 3 intentionally places ThemeSwitcher in Sidebar and Navbar
    const activatedAdminSurfaces = [
        "src/components/layout/Sidebar.tsx",
        "src/components/layout/Navbar.tsx",
    ]
    it("ThemeSwitcher imported in activated admin surfaces", () => {
        for (const path of activatedAdminSurfaces) {
            if (!existsSync(path)) continue
            const source = readFileSync(path, "utf8")
            expect(source).toContain("@/components/theme/ThemeSwitcher")
        }
    })
    it("ThemeSwitcher not in admin page/layout/import surfaces", () => {
        for (const path of dashboardFiles) {
            if (!existsSync(path)) continue
            const source = readFileSync(path, "utf8")
            expect(source).not.toContain("ThemeSwitcher")
        }
    })
})

describe("Phase 2 — No unresolved CSS variables in globals.css", () => {
    it("all var() references resolve to declared tokens", () => {
        const declarations = new Map<string, string>()
        for (const match of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
            declarations.set(match[1], match[2])
        }
        const external = new Set(["--font-geist-sans", "--font-geist-mono"])
        for (const [name, value] of declarations) {
            for (const ref of value.matchAll(/var\((--[\w-]+)/g)) {
                expect(
                    declarations.has(ref[1]) || external.has(ref[1]),
                    `${name} references missing ${ref[1]}`
                ).toBe(true)
            }
        }
    })
})

describe("Phase 2 — investor-tone determinism and structure", () => {
    it("has 8 tones with required properties", () => {
        const tones = toneSource.match(/accent:\s*"/g)
        expect(tones).toHaveLength(16) // 8 light + 8 dark
    })

    it("has getInvestorTone export with hash algorithm", () => {
        expect(toneSource).toContain("export const getInvestorTone")
        expect(toneSource).toContain("charCodeAt")
        expect(toneSource).toContain("hash * 31")
    })

    it("has getInvestorToneTheme for dark mode support", () => {
        expect(toneSource).toContain("export function getInvestorToneTheme")
        expect(toneSource).toContain("isDark")
    })

    it("has 3 named overrides preserved exactly", () => {
        expect(toneSource).toContain('"wahyu prasetyo adi"')
        expect(toneSource).toContain('"achmad firmansyah"')
        expect(toneSource).toContain('"wiwin yuli widiastuti"')
        // Override accents must be exact
        expect(toneSource).toContain('#2563eb') // wahyu blue
        expect(toneSource).toContain('#f59e0b') // achmad amber
        expect(toneSource).toContain('#db2777') // wiwin pink
    })

    it("has dark palette definitions", () => {
        expect(toneSource).toContain("DARK_OVERRIDES")
        expect(toneSource).toContain("rowBg")
        expect(toneSource).toContain("chipBg")
        expect(toneSource).toContain("chipText")
    })
})

describe("Phase 2 — Hard-coded literal scan", () => {
    for (const path of dashboardFiles) {
        if (!existsSync(path)) continue
        const source = readFileSync(path, "utf8")
        it(`${path.replace("src/", "")} — no text-black`, () => {
            expect(source).not.toMatch(/\btext-black\b/)
        })
    }

    for (const path of componentFiles) {
        if (!existsSync(path)) continue
        const source = readFileSync(path, "utf8")
        it(`${path.replace("src/", "")} — no text-black`, () => {
            expect(source).not.toMatch(/\btext-black\b/)
        })
    }
})

describe("Phase 2 — No duplicated Toaster mount", () => {
    it("dashboard layout has no Toaster", () => {
        const dashboard = readFileSync("src/app/dashboard/layout.tsx", "utf8")
        expect((dashboard.match(/<Toaster/g) ?? []).length).toBe(0)
    })
    it("investor layout has no Toaster", () => {
        const investor = readFileSync("src/app/dashboard/investor/layout.tsx", "utf8")
        expect((investor.match(/<Toaster/g) ?? []).length).toBe(0)
    })
    it("root layout has exactly one Toaster", () => {
        const root = readFileSync("src/app/layout.tsx", "utf8")
        expect((root.match(/<Toaster/g) ?? []).length).toBe(1)
    })
})

describe("Phase 2 — Chart theme helper", () => {
    it("chart-theme.ts defines getChartColors with isDark param", () => {
        expect(chartSource).toContain("getChartColors")
        expect(chartSource).toContain("isDark")
        expect(chartSource).toContain("LIGHT")
        expect(chartSource).toContain("DARK")
    })

    it("dashboard page uses getChartColors", () => {
        const source = readFileSync("src/app/dashboard/page.tsx", "utf8")
        expect(source).toContain("getChartColors")
    })
})

describe("Phase 2 — Migration checksum unchanged", () => {
    it("migration.sql unchanged", () => {
        const data = readFileSync(
            "prisma/migrations/20260830222005_loss_capital_ledger_foundation/migration.sql"
        )
        const hash = createHash("sha256").update(data).digest("hex")
        expect(hash).toBe("2de7d2e9ca11d799447f3e5a822655cbb6072316e88226ae7b81ff07858a3ad4")
    })
})

describe("Phase 2 — Skeleton artifact absent", () => {
    it("skeleton.tsx should not exist", () => {
        expect(existsSync("src/components/ui/skeleton.tsx")).toBe(false)
    })
})
