import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

const dashboardLayout = read("src/app/dashboard/layout.tsx")
const investorShell = read("src/app/dashboard/investor/InvestorShell.tsx")
const globalsCss = read("src/app/globals.css")
const pullToRefresh = read("src/components/ui/pull-to-refresh.tsx")

// Extract className from the first JSX tag in a given snippet.
function classNameOf(html: string, tagPattern: RegExp): string | null {
    const m = html.match(tagPattern)
    if (!m) return null
    return m[1]
}

// Admin: outer shell div (has font-sans which investor div doesn't)
const adminShell = classNameOf(dashboardLayout,
    /<div\s+className="([^"]*font-sans[^"]*)"/)
// Admin: <main> element
const adminMain = classNameOf(dashboardLayout,
    /<main\s+className="([^"]*)"/)

// Investor: outer shell div
const investorShellEl = classNameOf(investorShell,
    /<div\s+className="([^"]*lg:h-dvh[^"]*)"/)
// Investor: flex row wrapper
const investorRow = classNameOf(investorShell,
    /<div\s+className="([^"]*flex-1 min-h-0[^"]*)"/)
// Investor: <main> element
const investorMain = classNameOf(investorShell,
    /<main\s+className="([^"]*)"/)

describe("desktop scroll contract — admin", () => {
    it("shell locks to viewport with overflow-hidden on desktop", () => {
        expect(adminShell).not.toBeNull()
        expect(adminShell).toContain("lg:h-dvh")
        expect(adminShell).toContain("lg:overflow-hidden")
    })

    it("shell does not have overflow-y-auto (not a scroll owner)", () => {
        expect(adminShell).not.toContain("overflow-y-auto")
    })

    it("main is the single scroll owner on desktop", () => {
        expect(adminMain).not.toBeNull()
        expect(adminMain).toContain("lg:overflow-y-auto")
    })

    it("main has min-h-0 on desktop to prevent flex blowout", () => {
        expect(adminMain).toContain("lg:min-h-0")
    })

    it("main has flex-1 to fill remaining space", () => {
        expect(adminMain).toContain("lg:flex-1")
    })

    it("shell uses flex-col on desktop for proper height distribution", () => {
        expect(adminShell).toContain("lg:flex-col")
    })
})

describe("desktop scroll contract — investor", () => {
    it("shell locks to viewport with overflow-hidden on desktop", () => {
        expect(investorShellEl).not.toBeNull()
        expect(investorShellEl).toContain("lg:h-dvh")
        expect(investorShellEl).toContain("lg:overflow-hidden")
    })

    it("shell does not have overflow-y-auto (not a scroll owner)", () => {
        expect(investorShellEl).not.toContain("overflow-y-auto")
    })

    it("main is the single scroll owner on desktop", () => {
        expect(investorMain).not.toBeNull()
        expect(investorMain).toContain("overflow-y-auto")
    })

    it("main has min-h-0 to prevent flex blowout", () => {
        expect(investorMain).toContain("min-h-0")
    })

    it("flex row has min-h-0 for nested flex safety", () => {
        expect(investorRow).not.toBeNull()
        expect(investorRow).toContain("min-h-0")
    })
})

describe("overscroll-behavior-y scoping", () => {
    it("overscroll-behavior-y: none is inside @media (pointer: coarse) block", () => {
        const mediaQueryMatch = globalsCss.match(
            /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?overscroll-behavior-y:\s*none;[\s\S]*?\}/,
        )
        expect(mediaQueryMatch).toBeTruthy()
    })

    it("html,body block outside media query does not contain overscroll-behavior-y", () => {
        const globalBlockMatch = globalsCss.match(
            /html,\s*body\s*\{\s*width:\s*100%;[\s\S]*?\}/,
        )
        expect(globalBlockMatch).toBeTruthy()
        expect(globalBlockMatch![0]).not.toContain("overscroll-behavior-y")
    })
})

describe("PullToRefresh — desktop transparent", () => {
    it("no wheel event handler", () => {
        expect(pullToRefresh).not.toContain("onWheel")
    })

    it("no active preventDefault on scroll-related events", () => {
        const lines = pullToRefresh.split("\n")
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
            expect(trimmed).not.toContain("preventDefault()")
        }
    })

    it("uses min-h-full not min-h-screen", () => {
        expect(pullToRefresh).toContain("min-h-full")
        expect(pullToRefresh).not.toContain("min-h-screen")
    })
})

describe("no wheel preventDefault in layout components", () => {
    it("dashboard layout does not call preventDefault()", () => {
        const lines = dashboardLayout.split("\n")
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
            expect(trimmed).not.toContain("preventDefault()")
        }
    })

    it("investor shell does not call preventDefault()", () => {
        const lines = investorShell.split("\n")
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
            expect(trimmed).not.toContain("preventDefault()")
        }
    })
})

describe("no dual-scroll-owner wheel handler", () => {
    it("dashboard layout has no onWheel handler at all", () => {
        expect(dashboardLayout).not.toContain("onWheel")
        expect(dashboardLayout).not.toContain("handleDesktopSidebarWheel")
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
