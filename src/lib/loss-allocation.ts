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

    if (!Number.isSafeInteger(netMargin)) {
        throw new Error("netMargin harus berupa angka bulat finite (rp tanpa pecahan)")
    }
    if (!Number.isSafeInteger(investorRiskCapital) || investorRiskCapital < 0) {
        throw new Error("investorRiskCapital harus bulat non-negatif dan finite")
    }
    if (!Number.isSafeInteger(managerRiskCapital) || managerRiskCapital < 0) {
        throw new Error("managerRiskCapital harus bulat non-negatif dan finite")
    }
    if (responsibility !== "NORMAL_BUSINESS" && responsibility !== "MANAGER_MISCONDUCT") {
        throw new Error("responsibility tidak dikenal")
    }

    const grossRealizedLoss = netMargin < 0 ? -netMargin : 0

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

    const totalRiskCapitalBigInt = BigInt(investorRiskCapital) + BigInt(managerRiskCapital)
    if (totalRiskCapitalBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Total modal berisiko melebihi batas angka aman")
    }
    const totalRiskCapital = Number(totalRiskCapitalBigInt)

    if (totalRiskCapital === 0) {
        throw new Error("Total modal berisiko nol tetapi terdapat kerugian — tidak dapat mengalokasikan")
    }

    const allocatableCapitalLoss = Math.min(grossRealizedLoss, totalRiskCapital)
    const unallocatedExcessLoss = grossRealizedLoss - allocatableCapitalLoss
    const allocatableCapitalLossBigInt = BigInt(allocatableCapitalLoss)
    const investorRiskCapitalBigInt = BigInt(investorRiskCapital)

    if (responsibility === "MANAGER_MISCONDUCT") {
        // investorCapitalLoss = 0; bagian proportional menjadi liability
        const managerLiabilityToInvestor = Number(
            allocatableCapitalLossBigInt * investorRiskCapitalBigInt / totalRiskCapitalBigInt
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
    const investorCapitalLoss = Number(
        allocatableCapitalLossBigInt * investorRiskCapitalBigInt / totalRiskCapitalBigInt
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
