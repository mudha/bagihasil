import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(
    `${process.cwd()}/src/components/ui/multi-image-upload.tsx`,
    "utf8"
)

describe("multiple image upload wiring", () => {
    it("keeps active validation, compression, and sequential file processing without a dead array", () => {
        expect(source).not.toContain("const newImages: ImageFileWithDescription[] = []")
        expect(source).toContain("validateImageFile(file, { skipSizeCheck: true })")
        expect(source).toContain("fileToProcess = await compressImage(file)")
        expect(source).toContain("const finalValidation = validateImageFile(fileToProcess)")
        expect(source).toContain("for (const file of Array.from(files))")
        expect(source).toContain("await processFile(file)")
    })

    it("keeps hover-isolated paste handling without a write-only flag", () => {
        expect(source).not.toContain("let hasImage = false")
        expect(source).not.toContain("hasImage = true")
        expect(source).toContain("if (!isHovered.current) return")
        expect(source).toContain("document.addEventListener('paste', handleGlobalPaste)")
        expect(source).toContain("document.removeEventListener('paste', handleGlobalPaste)")
        expect(source).toContain("if (currentImages.length >= maxImages)")
    })

    it("renders image items without an unused map index and preserves edit/remove actions", () => {
        expect(source).not.toMatch(/images\.map\(\(img,\s*index\)\s*=>/)
        expect(source).toContain("images.map((img) =>")
        expect(source).toContain("handleDescriptionChange(img.id, e.target.value)")
        expect(source).toContain("onClick={() => handleRemove(img.id)}")
        expect(source).toContain("images.length < maxImages")
    })
})
