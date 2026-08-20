import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/app/dashboard/transactions/page.tsx`,
    "utf8"
)
const layoutSource = readFileSync(
    `${process.cwd()}/src/app/dashboard/layout.tsx`,
    "utf8"
)

describe("responsive transaction table contract", () => {
    it("keeps the desktop table wide and horizontally scrollable", () => {
        expect(source).toContain("overflow-x-auto overscroll-x-contain")
        expect(source).toContain('Table className="min-w-[1540px] table-fixed"')
    })

    it("keeps vehicle and investor text inside their assigned columns", () => {
        expect(source).toContain('TableHead className="w-[340px]">Unit</TableHead>')
        expect(source).toContain("flex w-full min-w-0 max-w-full items-center")
        expect(source).toContain("min-w-0 flex-1 break-words leading-tight")
    })

    it("allows the dashboard content area to shrink without clipping children", () => {
        expect(layoutSource).toContain("min-w-0 min-h-dvh")
    })
})
