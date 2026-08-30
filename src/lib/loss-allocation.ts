export type LossResponsibility = "NORMAL_BUSINESS" | "MANAGER_MISCONDUCT"

export type LossAllocationInput = {
    netMargin: number
    investorRiskCapital: number
    managerRiskCapital: number
    responsibility: LossResponsibility
}

export type LossAllocationResult = {
    grossRealizedLoss: number
    allocatableCapitalLoss: number
    investorCapitalLoss: number
    managerCapitalLoss: number
    managerLiabilityToInvestor: number
    unallocatedExcessLoss: number
    lossAllocationStatus: "NO_LOSS" | "NORMAL_LOSS" | "MANAGER_MISCONDUCT"
}

export function calculateLossAllocation(input: LossAllocationInput): LossAllocationResult {
    const { netMargin, investorRiskCapital, managerRiskCapital, responsibility } = input

    if (!Number.isFinite(netMargin) || !Number.isInteger(netMargin)) {
        throw new Error("netMargin harus berupa angka bulat finite (rp tanpa pecahan)")
    }
    if (!Number.isFinite(investorRiskCapital) || investorRiskCapital < 0 || !Number.isInteger(investorRiskCapital)) {
        throw new Error("investorRiskCapital harus bulat non-negatif dan finite")
    }
    if (!Number.isFinite(managerRiskCapital) || managerRiskCapital < 0 || !Number.isInteger(managerRiskCapital)) {
        throw new Error("managerRiskCapital harus bulat non-negatif dan finite")
    }

    const grossRealizedLoss = Math.max(0, Math.round(-netMargin))

    if (grossRealizedLoss === 0) {
        return {
            grossRealizedLoss: 0,
            allocatableCapitalLoss: 0,
            investorCapitalLoss: 0,
            managerCapitalLoss: 0,
            managerLiabilityToInvestor: 0,
            unallocatedExcessLoss: 0,
            lossAllocationStatus: "NO_LOSS",
        }
    }

    const totalRiskCapital = investorRiskCapital + managerRiskCapital

    if (totalRiskCapital === 0) {
        throw new Error("Total modal berisiko nol tetapi terdapat kerugian — tidak dapat mengalokasikan")
    }

    const allocatableCapitalLoss = Math.min(grossRealizedLoss, totalRiskCapital)
    const unallocatedExcessLoss = grossRealizedLoss - allocatableCapitalLoss

    if (responsibility === "MANAGER_MISCONDUCT") {
        // investorCapitalLoss = 0; bagian proportional menjadi liability
        const managerLiabilityToInvestor = Math.floor(
            allocatableCapitalLoss * investorRiskCapital / totalRiskCapital
        )
        const proportionalManagerLoss = allocatableCapitalLoss - managerLiabilityToInvestor

        return {
            grossRealizedLoss,
            allocatableCapitalLoss,
            investorCapitalLoss: 0,
            managerCapitalLoss: proportionalManagerLoss,
            managerLiabilityToInvestor,
            unallocatedExcessLoss,
            lossAllocationStatus: "MANAGER_MISCONDUCT",
        }
    }

    // Normal: investorFloor (deterministik), manager = remainder
    const investorCapitalLoss = Math.floor(
        allocatableCapitalLoss * investorRiskCapital / totalRiskCapital
    )
    const managerCapitalLoss = allocatableCapitalLoss - investorCapitalLoss

    return {
        grossRealizedLoss,
        allocatableCapitalLoss,
        investorCapitalLoss,
        managerCapitalLoss,
        managerLiabilityToInvestor: 0,
        unallocatedExcessLoss,
        lossAllocationStatus: "NORMAL_LOSS",
    }
}
