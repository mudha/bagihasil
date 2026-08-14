import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/components/ui/image-hover-preview.tsx`,
    "utf8"
)

describe("image hover preview positioning lifecycle", () => {
    it("uses a stable preview-size-aware position callback", () => {
        expect(source).toContain("useCallback")
        expect(source).toMatch(/const updatePosition = useCallback\(\(\) => \{[\s\S]*?\}, \[previewSize\]\)/)
        expect(source).toContain("[isHovered, updatePosition]")
    })

    it("preserves viewport listeners and symmetric cleanup", () => {
        expect(source).toContain('window.addEventListener("resize", handleViewportChange)')
        expect(source).toContain('window.addEventListener("scroll", handleViewportChange, true)')
        expect(source).toContain('window.removeEventListener("resize", handleViewportChange)')
        expect(source).toContain('window.removeEventListener("scroll", handleViewportChange, true)')
    })

    it("preserves touch guard, hover delay, and viewport clamping", () => {
        expect(source).toContain('window.matchMedia("(hover: none), (pointer: coarse)").matches')
        expect(source).toContain("}, 120)")
        expect(source).toContain("const size = PREVIEW_SIZES[previewSize]")
        expect(source).toContain("setPosition({ x, y, width, height })")
        expect(source).toContain("const shouldShowPreview = isHovered && imageLoaded && !disabled && isMounted")
    })
})
