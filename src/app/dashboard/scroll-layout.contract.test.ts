import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

const dashboardLayout = read("src/app/dashboard/layout.tsx")
const investorShell = read("src/app/dashboard/investor/InvestorShell.tsx")
const globalsCss = read("src/app/globals.css")
const pullToRefresh = read("src/components/ui/pull-to-refresh.tsx")

describe("desktop scroll contract — admin", () => {
    it("shell locks to viewport with overflow-hidden on desktop", () => {
        // Outer div must constrain to viewport on lg+
        expect(dashboardLayout).toMatch(/lg:h-dvh|lg:h-screen/)
        expect(dashboardLayout).toContain("lg:overflow-hidden")
    })

    it("admin main is the single scroll owner on desktop", () => {
        // Main must have overflow-y-auto on desktop
        expect(dashboardLayout).toContain("lg:overflow-y-auto")
    })

    it("admin main has min-h-0 on desktop to prevent flex blowout", () => {
        expect(dashboardLayout).toContain("lg:min-h-0")
    })

    it("admin flex column on desktop for proper height distribution", () => {
        expect(dashboardLayout).toContain("lg:flex-col")
    })

    it("admin main has flex-1 to fill remaining space", () => {
        expect(dashboardLayout).toContain("lg:flex-1")
    })

    it("no competing overflow-y-auto on outer shell on desktop", () => {
        // The outer div should NOT have overflow-y-auto
        const outerDivMatch = dashboardLayout.match(/<div[^>]*className="[^"]*lg:h-dvh[^"]*"/)
        expect(outerDivMatch).toBeTruthy()
        expect(outerDivMatch![0]).not.toContain("overflow-y-auto")
    })
})

describe("desktop scroll contract — investor", () => {
    it("shell locks to viewport with overflow-hidden on desktop", () => {
        expect(investorShell).toMatch(/lg:h-dvh|lg:h-screen/)
        expect(investorShell).toContain("lg:overflow-hidden")
    })

    it("investor main is the single scroll owner on desktop", () => {
        expect(investorShell).toContain("overflow-y-auto")
    })

    it("investor main has min-h-0 to prevent flex blowout", () => {
        expect(investorShell).toContain("min-h-0")
    })

    it("investor flex row has min-h-0", () => {
        // The flex row wrapper must have min-h-0
        expect(investorShell).toContain("flex flex-1 min-h-0")
    })

    it("no competing overflow-y-auto on outer shell", () => {
        const outerDivMatch = investorShell.match(/<div[^>]*className="[^"]*lg:h-dvh[^"]*"/)
        expect(outerDivMatch).toBeTruthy()
        expect(outerDivMatch![0]).not.toContain("overflow-y-auto")
    })
})

describe("overscroll-behavior-y scoping", () => {
    it("overscroll-behavior-y: none is scoped to touch/pointer-coarse media query", () => {
        // Must be inside @media (pointer: coarse) block, not global
        expect(globalsCss).toContain("@media (pointer: coarse)")
        // Find the media query block and verify overscroll is inside it
        const mediaQueryMatch = globalsCss.match(/@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?overscroll-behavior-y:\s*none;[\s\S]*?\}/)
        expect(mediaQueryMatch).toBeTruthy()
    })

    it("html,body overscroll is NOT applied globally outside media query", () => {
        // The global html,body block should NOT contain overscroll-behavior-y
        const globalBlockMatch = globalsCss.match(/html,\s*body\s*\{\s*width:\s*100%;[\s\S]*?\}/)
        expect(globalBlockMatch).toBeTruthy()
        expect(globalBlockMatch![0]).not.toContain("overscroll-behavior-y")
    })
})

describe("PullToRefresh — desktop transparent", () => {
    it("no wheel event handler", () => {
        expect(pullToRefresh).not.toContain("onWheel")
        expect(pullToRefresh).not.toContain("wheel")
    })

    it("no preventDefault on scroll-related events", () => {
        // PullToRefresh should not preventDefault on touch/wheel
        const lines = pullToRefresh.split("\n")
        const preventDefaultLines = lines.filter((l) => l.includes("preventDefault"))
        // Only the commented-out one is acceptable
        for (const line of preventDefaultLines) {
            expect(line.trim().startsWith("//") || line.trim().startsWith("*")).toBe(true)
        }
    })

    it("uses min-h-full not min-h-screen (does not create competing scroll owner)", () => {
        expect(pullToRefresh).toContain("min-h-full")
        expect(pullToRefresh).not.toContain("min-h-screen")
    })
})

describe("no wheel preventDefault in layout components", () => {
    it("dashboard layout does not call preventDefault on wheel", () => {
        // Check for actual preventDefault() calls, not mentions in comments
        const lines = dashboardLayout.split("\n")
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
            expect(trimmed).not.toContain("preventDefault()")
        }
    })

    it("investor shell does not call preventDefault on wheel", () => {
        const lines = investorShell.split("\n")
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
            expect(trimmed).not.toContain("preventDefault()")
        }
    })
})

describe("mobile pull-to-refresh preserved", () => {
    it("PullToRefresh handles touch events", () => {
        expect(pullToRefresh).toContain("touchstart")
        expect(pullToRefresh).toContain("touchmove")
        expect(pullToRefresh).toContain("touchend")
    })

    it("PullToRefresh uses window.scrollY for mobile detection", () => {
        expect(pullToRefresh).toContain("window.scrollY")
    })
})
