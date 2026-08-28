/**
 * Characterization tests for visual cleanup (PR #88).
 * Verifies:
 * - Units: STNK debug logs removed, dialog neutralized, primary button neutral, fallback localized
 * - Transactions: primary button neutral, dialog header neutralized
 * - Calculator: English subtitles replaced, formulas byte-identical
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

const units = readFileSync(
    `${process.cwd()}/src/app/dashboard/units/page.tsx`, "utf-8"
)
const tx = readFileSync(
    `${process.cwd()}/src/app/dashboard/transactions/page.tsx`, "utf-8"
)
const calc = readFileSync(
    `${process.cwd()}/src/app/dashboard/calculator/page.tsx`, "utf-8"
)

describe("Units page visual cleanup", () => {
    it("has no [STNK Scan] debug console.log statements", () => {
        expect(units).not.toContain("[STNK Scan]")
    })

    it("dialog header has no teal gradient background", () => {
        expect(units).not.toContain("bg-gradient-to-br from-teal-950")
    })

    it("dialog header uses Mudha surface tokens", () => {
        expect(units).toContain("bg-[var(--mudha-surface-secondary)]")
    })

    it("dialog mode badge uses surface tokens not glass", () => {
        const idx = units.indexOf('bg-[var(--mudha-surface-secondary)]')
        const region = units.slice(idx, idx + 500)
        expect(region).toContain("bg-[var(--mudha-surface-primary)]")
        expect(region).not.toContain("bg-white/10")
    })

    it("DialogTitle uses font-bold not font-black", () => {
        const idx = units.indexOf("Tambah Unit Baru")
        const region = units.slice(Math.max(0, idx - 200), idx + 100)
        expect(region).toContain("font-bold")
        expect(region).not.toMatch(/font-black/)
    })

    it("DialogTitle/DialogDescription preserved", () => {
        expect(units).toContain("DialogTitle")
        expect(units).toContain("DialogDescription")
        expect(units).toContain("Formulir untuk memperbarui data unit kendaraan.")
        expect(units).toContain("Formulir untuk menambahkan unit kendaraan.")
    })

    it("dialog section headings use font-semibold not font-black", () => {
        for (const text of ["Foto kendaraan", "Data kendaraan", "Identitas & kepemilikan"]) {
            const idx = units.indexOf(text)
            expect(idx).toBeGreaterThan(-1)
            const region = units.slice(Math.max(0, idx - 150), idx + 50)
            expect(region).toContain("font-semibold")
            expect(region).not.toContain("font-black")
        }
    })

    it("Tambah Unit button has no bg-teal or font-black", () => {
        const idx = units.indexOf("Tambah Unit")
        const region = units.slice(Math.max(0, idx - 200), idx + 50)
        expect(region).not.toContain("bg-teal-600")
        expect(region).not.toContain("font-black")
        expect(region).not.toContain("shadow-lg shadow-teal")
        expect(region).toContain("font-semibold")
        expect(region).toContain("h-11")
    })

    it("Suspense fallback localized to Bahasa Indonesia", () => {
        expect(units).toContain("Memuat...")
        expect(units).not.toContain("Loading...")
    })

    it("form fields, submit, STNK scan UI preserved", () => {
        expect(units).toContain("Scan AI")
        expect(units).toContain("Simpan Unit")
        expect(units).toContain("Simpan Perubahan")
        expect(units).toContain("handleScanStnk")
        expect(units).toContain("plateNumber")
        expect(units).toContain("engineNumber")
        expect(units).toContain("chassisNumber")
    })
})

describe("Transactions page visual cleanup", () => {
    it("Transaksi Baru button has no bg-teal or font-black", () => {
        const idx = tx.indexOf("Transaksi Baru")
        const region = tx.slice(Math.max(0, idx - 200), idx + 50)
        expect(region).not.toContain("bg-teal-600")
        expect(region).not.toContain("font-black")
        expect(region).not.toContain("shadow-lg shadow-teal")
        expect(region).toContain("font-semibold")
        expect(region).toContain("h-11")
    })

    it("form submit buttons preserved", () => {
        expect(tx).toContain("Simpan Transaksi")
        expect(tx).toContain("Simpan Perubahan")
    })
})

describe("Calculator visual cleanup", () => {
    it("no English decorative subtitles remain", () => {
        expect(calc).not.toContain("Return on Investment")
        expect(calc).not.toContain("Operational Success")
    })

    it("Bahasa Indonesia subtitle for investor card", () => {
        expect(calc).toContain("Sesuai persentase yang dipilih")
    })

    it("Bahasa Indonesia subtitle for manager card", () => {
        expect(calc).toContain("Sisa setelah bagian pemodal")
    })

    it("main labels unchanged", () => {
        expect(calc).toContain("Bagian Pemodal")
        expect(calc).toContain("Bagian Pengelola")
        expect(calc).toContain("Estimasi Pembagian Profit")
        expect(calc).toContain("Total Modal")
        expect(calc).toContain("Estimasi Profit Bersih")
        expect(calc).toContain("ROI")
    })

    it("loss warning preserved", () => {
        expect(calc).toContain("Estimasi menunjukkan kerugian")
    })

    it("formulas are byte-identical to baseline", () => {
        const formulas = [
            "const totalCapital = buyPrice + repairCost + otherCost",
            "const grossProfit = targetSellPrice - totalCapital",
            "totalCapital > 0 ? (grossProfit / totalCapital) * 100 : 0",
            "grossProfit > 0 ? grossProfit * (investorSharePct / 100) : 0",
            "grossProfit > 0 ? grossProfit * ((100 - investorSharePct) / 100) : 0",
            "netProfit: grossProfit",
            "totalCapital > 0",
            "grossProfit < 0",
        ]
        for (const f of formulas) {
            expect(calc).toContain(f)
        }
    })
})
