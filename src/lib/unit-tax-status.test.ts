import { describe, expect, it, vi } from "vitest"
import { getTaxStatus } from "./unit-tax-status"

describe("getTaxStatus", () => {
    it("returns overdue months for a past date more than 1 month ago", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus(new Date("2026-03-10"))
            expect(result.text).toBe("Mati 3 bulan")
            expect(result.color).toBe("text-red-600")
        } finally {
            vi.useRealTimers()
        }
    })

    it("returns overdue years for a past date more than 12 months ago", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus(new Date("2024-06-01"))
            expect(result.text).toBe("Mati 2 tahun")
            expect(result.color).toBe("text-red-600")
        } finally {
            vi.useRealTimers()
        }
    })

    it("returns overdue days for a date earlier in the same month", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus(new Date("2026-06-01"))
            expect(result.text).toBe("Mati kelewat 14 hari")
            expect(result.color).toBe("text-red-600")
        } finally {
            vi.useRealTimers()
        }
    })

    it("returns today status for the same day", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus(new Date("2026-06-15"))
            expect(result.text).toBe("Hari ini jatuh tempo")
            expect(result.color).toBe("text-amber-600")
        } finally {
            vi.useRealTimers()
        }
    })

    it("returns days remaining for a future date in the same month", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus(new Date("2026-06-25"))
            expect(result.text).toBe("Kurang 10 hari lagi")
            expect(result.color).toBe("text-amber-600")
        } finally {
            vi.useRealTimers()
        }
    })

    it("returns months remaining for 1-3 months ahead", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus(new Date("2026-08-15"))
            expect(result.text).toBe("Kurang 2 bulan lagi")
            expect(result.color).toBe("text-amber-600")
        } finally {
            vi.useRealTimers()
        }
    })

    it("returns formatted months for 4+ months ahead", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus(new Date("2027-10-15"))
            expect(result.text).toBe("Kurang 1 tahun 4 bulan lagi")
            expect(result.color).toBe("text-green-600")
        } finally {
            vi.useRealTimers()
        }
    })

    it("accepts string input", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-15T10:00:00"))
        try {
            const result = getTaxStatus("2026-06-15")
            expect(result.text).toBe("Hari ini jatuh tempo")
            expect(result.color).toBe("text-amber-600")
        } finally {
            vi.useRealTimers()
        }
    })
})
