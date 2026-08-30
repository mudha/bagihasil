import { describe, expect, it } from "vitest"

import { calculateLossAllocation } from "./loss-allocation"

describe("calculateLossAllocation", () => {
    it("1. kerugian normal 100% modal pemodal", () => {
        const result = calculateLossAllocation({
            netMargin: -5_000_000,
            investorRiskCapital: 100_000_000,
            managerRiskCapital: 0,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.grossRealizedLoss).toBe(5_000_000)
        expect(result.allocatableCapitalLoss).toBe(5_000_000)
        expect(result.investorCapitalLoss).toBe(5_000_000)
        expect(result.managerCapitalLoss).toBe(0)
        expect(result.managerLiabilityToInvestor).toBe(0)
        expect(result.unallocatedExcessLoss).toBe(0)
        expect(result.lossAllocationStatus).toBe("NORMAL_LOSS")
    })

    it("2. kerugian normal 80:20 menghasilkan loss 24:6 untuk rugi 30", () => {
        const result = calculateLossAllocation({
            netMargin: -30_000_000,
            investorRiskCapital: 80_000_000,
            managerRiskCapital: 20_000_000,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.grossRealizedLoss).toBe(30_000_000)
        expect(result.allocatableCapitalLoss).toBe(30_000_000)
        expect(result.investorCapitalLoss).toBe(24_000_000)
        expect(result.managerCapitalLoss).toBe(6_000_000)
        expect(result.managerLiabilityToInvestor).toBe(0)
        expect(result.unallocatedExcessLoss).toBe(0)
        expect(result.lossAllocationStatus).toBe("NORMAL_LOSS")
    })

    it("3. proporsi menghasilkan pecahan rupiah, remainder deterministik, total exact", () => {
        // modal 1:3, loss 100 → investor 25, manager 75
        const result = calculateLossAllocation({
            netMargin: -100,
            investorRiskCapital: 25,
            managerRiskCapital: 75,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.investorCapitalLoss).toBe(25)
        expect(result.managerCapitalLoss).toBe(75)
        expect(result.investorCapitalLoss + result.managerCapitalLoss).toBe(result.allocatableCapitalLoss)
    })

    it("3b. pecahan rupiah dengan remainder ke pengelola", () => {
        // modal 1:2, loss 100 → 100*1/3 = 33 (floor), manager = 100-33 = 67
        const result = calculateLossAllocation({
            netMargin: -100,
            investorRiskCapital: 100_000,
            managerRiskCapital: 200_000,
            responsibility: "NORMAL_BUSINESS",
        })

        // investor = floor(100 * 100000 / 300000) = 33, manager = 100 - 33 = 67
        expect(result.investorCapitalLoss).toBe(33)
        expect(result.managerCapitalLoss).toBe(67)
        expect(result.investorCapitalLoss + result.managerCapitalLoss).toBe(100)
    })

    it("4. kerugian melebihi total modal berisiko menghasilkan unallocatedExcessLoss", () => {
        const result = calculateLossAllocation({
            netMargin: -200_000_000,
            investorRiskCapital: 80_000_000,
            managerRiskCapital: 20_000_000,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.grossRealizedLoss).toBe(200_000_000)
        expect(result.allocatableCapitalLoss).toBe(100_000_000)
        expect(result.investorCapitalLoss).toBe(80_000_000)
        expect(result.managerCapitalLoss).toBe(20_000_000)
        expect(result.unallocatedExcessLoss).toBe(100_000_000)
        expect(result.investorCapitalLoss + result.managerCapitalLoss).toBe(100_000_000)
    })

    it("5. modal pengelola nol — seluruh loss ke pemodal", () => {
        const result = calculateLossAllocation({
            netMargin: -10_000_000,
            investorRiskCapital: 50_000_000,
            managerRiskCapital: 0,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.investorCapitalLoss).toBe(10_000_000)
        expect(result.managerCapitalLoss).toBe(0)
    })

    it("6. modal pemodal nol — seluruh loss ke pengelola", () => {
        const result = calculateLossAllocation({
            netMargin: -10_000_000,
            investorRiskCapital: 0,
            managerRiskCapital: 50_000_000,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.investorCapitalLoss).toBe(0)
        expect(result.managerCapitalLoss).toBe(10_000_000)
    })

    it("7. total modal nol pada kondisi loss — harus throw", () => {
        expect(() =>
            calculateLossAllocation({
                netMargin: -10_000_000,
                investorRiskCapital: 0,
                managerRiskCapital: 0,
                responsibility: "NORMAL_BUSINESS",
            })
        ).toThrow("Total modal berisiko nol")
    })

    it("8. break-even menghasilkan seluruh nominal loss 0", () => {
        const result = calculateLossAllocation({
            netMargin: 0,
            investorRiskCapital: 80_000_000,
            managerRiskCapital: 20_000_000,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.grossRealizedLoss).toBe(0)
        expect(result.allocatableCapitalLoss).toBe(0)
        expect(result.investorCapitalLoss).toBe(0)
        expect(result.managerCapitalLoss).toBe(0)
        expect(result.lossAllocationStatus).toBe("NO_LOSS")
    })

    it("9. profit menghasilkan seluruh nominal loss 0", () => {
        const result = calculateLossAllocation({
            netMargin: 15_000_000,
            investorRiskCapital: 80_000_000,
            managerRiskCapital: 20_000_000,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.grossRealizedLoss).toBe(0)
        expect(result.lossAllocationStatus).toBe("NO_LOSS")
    })

    it("10. misconduct tanpa modal pengelola — liability penuh ke pemodal", () => {
        const result = calculateLossAllocation({
            netMargin: -10_000_000,
            investorRiskCapital: 100_000_000,
            managerRiskCapital: 0,
            responsibility: "MANAGER_MISCONDUCT",
        })

        expect(result.grossRealizedLoss).toBe(10_000_000)
        expect(result.allocatableCapitalLoss).toBe(10_000_000)
        expect(result.investorCapitalLoss).toBe(0)
        expect(result.managerCapitalLoss).toBe(0)
        expect(result.managerLiabilityToInvestor).toBe(10_000_000)
        expect(result.lossAllocationStatus).toBe("MANAGER_MISCONDUCT")
    })

    it("11. misconduct dengan modal pengelola — loss modal pengelola dan liability terpisah", () => {
        const result = calculateLossAllocation({
            netMargin: -30_000_000,
            investorRiskCapital: 80_000_000,
            managerRiskCapital: 20_000_000,
            responsibility: "MANAGER_MISCONDUCT",
        })

        expect(result.grossRealizedLoss).toBe(30_000_000)
        expect(result.allocatableCapitalLoss).toBe(30_000_000)
        // investor tidak dibebani
        expect(result.investorCapitalLoss).toBe(0)
        // proportional manager loss pada modal sendiri: 30M * 20/100 = 6M
        expect(result.managerCapitalLoss).toBe(6_000_000)
        // liability: proportional investor part: 30M * 80/100 = 24M
        expect(result.managerLiabilityToInvestor).toBe(24_000_000)
        // liability + manager capital loss = allocatable
        expect(result.managerLiabilityToInvestor + result.managerCapitalLoss).toBe(30_000_000)
    })

    it("12. nominal rupiah besar tetap exact", () => {
        const big = 1_000_000_000 // 1 miliar
        const result = calculateLossAllocation({
            netMargin: -big,
            investorRiskCapital: 800_000_000,
            managerRiskCapital: 200_000_000,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.grossRealizedLoss).toBe(big)
        expect(result.investorCapitalLoss).toBe(800_000_000)
        expect(result.managerCapitalLoss).toBe(200_000_000)
        expect(result.investorCapitalLoss + result.managerCapitalLoss).toBe(big)
    })

    it("13a. pecahan rupiah ditolak", () => {
        expect(() =>
            calculateLossAllocation({
                netMargin: -5.5,
                investorRiskCapital: 100,
                managerRiskCapital: 0,
                responsibility: "NORMAL_BUSINESS",
            })
        ).toThrow()
    })

    it("13b. modal negatif ditolak", () => {
        expect(() =>
            calculateLossAllocation({
                netMargin: -5_000_000,
                investorRiskCapital: -100,
                managerRiskCapital: 0,
                responsibility: "NORMAL_BUSINESS",
            })
        ).toThrow()
    })

    it("13c. input non-finite ditolak", () => {
        expect(() =>
            calculateLossAllocation({
                netMargin: NaN,
                investorRiskCapital: 100,
                managerRiskCapital: 0,
                responsibility: "NORMAL_BUSINESS",
            })
        ).toThrow()

        expect(() =>
            calculateLossAllocation({
                netMargin: Infinity,
                investorRiskCapital: 100,
                managerRiskCapital: 0,
                responsibility: "NORMAL_BUSINESS",
            })
        ).toThrow()
    })

    it("13d. input di luar safe-integer ditolak", () => {
        expect(() =>
            calculateLossAllocation({
                netMargin: Number.MAX_SAFE_INTEGER + 1,
                investorRiskCapital: 100,
                managerRiskCapital: 0,
                responsibility: "NORMAL_BUSINESS",
            })
        ).toThrow()

        expect(() =>
            calculateLossAllocation({
                netMargin: -100,
                investorRiskCapital: Number.MAX_SAFE_INTEGER,
                managerRiskCapital: 1,
                responsibility: "NORMAL_BUSINESS",
            })
        ).toThrow()
    })

    it("13e. responsibility yang tidak dikenal ditolak termasuk saat no-loss", () => {
        expect(() =>
            calculateLossAllocation({
                netMargin: 0,
                investorRiskCapital: 100,
                managerRiskCapital: 0,
                responsibility: "UNKNOWN" as never,
            })
        ).toThrow("responsibility tidak dikenal")
    })

    it("13f. total modal tepat pada batas safe-integer tetap exact", () => {
        const result = calculateLossAllocation({
            netMargin: -Number.MAX_SAFE_INTEGER,
            investorRiskCapital: Number.MAX_SAFE_INTEGER,
            managerRiskCapital: 0,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.grossRealizedLoss).toBe(Number.MAX_SAFE_INTEGER)
        expect(result.allocatableCapitalLoss).toBe(Number.MAX_SAFE_INTEGER)
        expect(result.investorCapitalLoss).toBe(Number.MAX_SAFE_INTEGER)
        expect(result.managerCapitalLoss).toBe(0)
    })

    it("14. hasil tidak dipengaruhi nisbah keuntungan karena nisbah bukan input", () => {
        // nisbah tidak ada di input — verify function signature
        const result = calculateLossAllocation({
            netMargin: -30_000_000,
            investorRiskCapital: 80_000_000,
            managerRiskCapital: 20_000_000,
            responsibility: "NORMAL_BUSINESS",
        })

        expect(result.investorCapitalLoss).toBe(24_000_000)
        expect(result.managerCapitalLoss).toBe(6_000_000)
        // ini harus benar tanpa memasukkan nisbah 70:30 atau 60:40
    })

    it("15. function pure — input tidak dimutasi", () => {
        const input = {
            netMargin: -30_000_000,
            investorRiskCapital: 80_000_000,
            managerRiskCapital: 20_000_000,
            responsibility: "NORMAL_BUSINESS" as const,
        }
        const inputCopy = { ...input }

        calculateLossAllocation(input)

        expect(input).toEqual(inputCopy)
    })
})
