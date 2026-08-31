import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const read = (relativePath: string) =>
    readFileSync(resolve(__dirname, relativePath), "utf8")

const transactionRoute = () => read("[id]/route.ts")
const paymentRoute = () => read("[id]/payments/route.ts")
const selections = () => read("../../../lib/legacy-read-selects.ts")

const extract = (source: string, start: string, end: string) => {
    const startIndex = source.indexOf(start)
    const endIndex = source.indexOf(end, startIndex)
    return startIndex >= 0 && endIndex >= 0
        ? source.slice(startIndex, endIndex)
        : undefined
}

describe("Transaction mutation pre-migration schema compatibility", () => {
    it("PUT pre-read uses a least-data typed selection without the pending field", () => {
        const source = transactionRoute()
        const preRead = extract(
            source,
            "const currentTransaction = await tx.transaction.findUnique({",
            "if (!currentTransaction)",
        )

        expect(preRead).toBeDefined()
        expect(preRead).toContain("select: transactionMutationPreReadSelect")
        expect(preRead).not.toContain("include:")
        expect(preRead).not.toContain("finalizationVersion")
    })

    it("PUT mutation and final response use explicit typed selections", () => {
        const source = transactionRoute()
        const update = extract(
            source,
            "await tx.transaction.update({",
            "// 2. Handle Buy Proofs",
        )
        const finalRead = extract(
            source,
            "const result = await tx.transaction.findUnique({",
            "return { kind: \"OK\"",
        )

        expect(update).toBeDefined()
        expect(update).toContain("select: { id: true }")
        expect(finalRead).toBeDefined()
        expect(finalRead).toContain("select: transactionMutationResponseSelect")
        expect(finalRead).not.toContain("include:")
        expect(finalRead).not.toContain("finalizationVersion")
    })

    it("defines the PUT pre-read as an exact least-data selection", () => {
        const source = selections()
        const selection = source.match(
            /export const transactionMutationPreReadSelect = \{([\s\S]*?)\} satisfies Prisma\.TransactionSelect/,
        )?.[1]

        expect(selection).toBeDefined()
        expect(selection).not.toContain("...legacyTransactionScalarSelect")
        expect(selection).not.toContain("...legacyCostSelect")
        expect(selection).not.toContain("...legacyProfitSharingSelect")
        expect(selection).toContain(`
    unitId: true,
    buyPrice: true,
    initialInvestorCapital: true,
    initialManagerCapital: true,
    sellDate: true,
    sellPrice: true,
    status: true,
`)
        expect(selection).toContain(`
    unit: { select: {
        investorId: true,
        investor: { select: { marginPercentage: true } },
    } },
    costs: { select: {
        payer: true,
        amount: true,
    } },
    profitSharing: { select: {
        investorSharePercentage: true,
        managerSharePercentage: true,
    } },
`)
        expect(selection).not.toContain("finalizationVersion")
    })

    it("Payment pre-read and replay reads use explicit least-data selections", () => {
        const source = paymentRoute()
        const existing = extract(
            source,
            "const existing = await tx.paymentHistory.findUnique({",
            "if (existing)",
        )
        const transaction = extract(
            source,
            "const transaction = await tx.transaction.findUnique({",
            "if (!transaction)",
        )

        expect(existing).toBeDefined()
        expect(existing).toContain("select: paymentMutationReplaySelect")
        expect(existing).not.toContain("include:")
        expect(transaction).toBeDefined()
        expect(transaction).toContain("select: paymentTransactionPreReadSelect")
        expect(transaction).not.toContain("include:")
        expect(transaction).not.toContain("finalizationVersion")
    })

    it("defines Payment pre-read history as an exact six-field selection", () => {
        const source = selections()
        const selection = source.match(
            /export const paymentTransactionPreReadSelect = \{([\s\S]*?)\} satisfies Prisma\.TransactionSelect/,
        )?.[1]

        expect(selection).toBeDefined()
        expect(selection).not.toContain("legacyPaymentHistorySelect")
        expect(selection).toContain(`
    paymentHistories: { select: {
        investorId: true,
        amount: true,
        paymentDate: true,
        method: true,
        proofImageUrl: true,
        notes: true,
    } },
`)
    })

    it("Payment create and concurrent replay use explicit typed selections", () => {
        const source = paymentRoute()
        const create = extract(
            source,
            "const payment = await tx.paymentHistory.create({",
            "const totalPaid = totalPaidBefore",
        )
        const update = extract(
            source,
            "await tx.transaction.update({",
            "return { kind: 'CREATED'",
        )
        const concurrentReplay = extract(
            source,
            "const replay = await prisma.paymentHistory.findUnique({",
            "if (replay)",
        )

        expect(create).toBeDefined()
        expect(create).toContain("select: legacyPaymentHistorySelect")
        expect(update).toBeDefined()
        expect(update).toContain("select: { id: true }")
        expect(concurrentReplay).toBeDefined()
        expect(concurrentReplay).toContain("select: paymentMutationReplaySelect")
        expect(concurrentReplay).not.toContain("include:")
    })

    it("typed response selections preserve legacy fields and exclude pending fields", () => {
        const source = selections()
        expect(source).toContain("export const transactionMutationResponseSelect")
        expect(source).toContain("...legacyTransactionScalarSelect")
        expect(source).toContain("costs: { select: legacyCostSelect }")
        expect(source).toContain("proofs: { select: legacyTransactionProofSelect }")
        expect(source).toContain("export const paymentMutationReplaySelect")
        expect(source).toContain("...legacyPaymentHistorySelect")
        expect(source).toContain("transaction: { select: { paymentStatus: true } }")
        expect(source).not.toContain("finalizationVersion: true")
    })
})
