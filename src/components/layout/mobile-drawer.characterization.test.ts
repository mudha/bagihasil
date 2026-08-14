import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

const navbar = read("src/components/layout/Navbar.tsx")
const sidebar = read("src/components/layout/Sidebar.tsx")
const investorSidebar = read("src/components/layout/InvestorSidebar.tsx")
const sheet = read("src/components/ui/sheet.tsx")

describe("mobile navigation drawer", () => {
    it("uses the dynamic viewport and contains drawer scrolling", () => {
        expect(navbar).toContain("h-dvh")
        expect(navbar).toContain("overflow-hidden")
        expect(navbar).toContain("overscroll-contain")
    })

    it("keeps admin navigation scrollable and its footer reachable", () => {
        expect(sidebar).toContain("min-h-0")
        expect(sidebar).toContain("overflow-y-auto")
        expect(sidebar).toContain("overscroll-contain")
        expect(sidebar).toContain("shrink-0")
        expect(sidebar).toContain("pb-[max(0.5rem,env(safe-area-inset-bottom))]")
    })

    it("keeps investor navigation scrollable and its footer reachable", () => {
        expect(investorSidebar).toContain("min-h-0")
        expect(investorSidebar).toContain("overflow-y-auto")
        expect(investorSidebar).toContain("overscroll-contain")
        expect(investorSidebar).toContain("shrink-0")
        expect(investorSidebar).toContain("pb-[max(1rem,env(safe-area-inset-bottom))]")
    })

    it("provides visible, safe-area-aware 44px menu controls", () => {
        expect(navbar).toContain("h-11 w-11")
        expect(navbar).toContain("text-white")
        expect(sheet).toContain("h-11 w-11")
        expect(sheet).toContain("top-[max(0.5rem,env(safe-area-inset-top))]")
        expect(sheet).toContain("Tutup menu")
    })
})
