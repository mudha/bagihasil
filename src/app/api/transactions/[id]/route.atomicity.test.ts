import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const routeSource = readFileSync(
    new URL("./route.ts", import.meta.url),
    "utf8"
)

function updateTransactionBody(source: string) {
    const start = source.indexOf("export async function PUT(")
    const end = source.indexOf("export async function DELETE(")

    if (start === -1 || end === -1) {
        throw new Error("PUT transaction route could not be located")
    }

    return source.slice(start, end)
}

describe("transaction update atomicity", () => {
    it("keeps status decisions, financial reads, and mutations in one serializable transaction", () => {
        const putBody = updateTransactionBody(routeSource)
        const transactionStart = putBody.indexOf("await runSerializableTransaction(prisma, async (tx) =>")
        const outcomeHandling = putBody.indexOf("if (outcome.kind === \"NOT_FOUND\")")

        expect(transactionStart).toBeGreaterThan(-1)
        expect(outcomeHandling).toBeGreaterThan(transactionStart)

        const beforeTransaction = putBody.slice(0, transactionStart)
        expect(beforeTransaction).not.toMatch(/await prisma\.(unit|profitSharing|transaction|transactionProof)\.(update|create|deleteMany|createMany)/)

        const transactionBody = putBody.slice(transactionStart, outcomeHandling)
        expect(transactionBody).toContain("await tx.transaction.findUnique(")
        expect(transactionBody).toContain("currentTransaction.costs")
        expect(transactionBody).toContain("currentTransaction.unit.investor.marginPercentage")
        expect(transactionBody).toContain("calculateProfitSharing(")
        expect(transactionBody).toContain("await tx.unit.update(")
        expect(transactionBody).toContain("await tx.profitSharing.deleteMany(")
        expect(transactionBody).toContain("await tx.profitSharing.create(")
        expect(transactionBody).toContain("await tx.transaction.update(")
        expect(transactionBody).toContain("await tx.transactionProof.deleteMany(")
    })

    it("sends external notifications only after awaiting the committed outcome", () => {
        const putBody = updateTransactionBody(routeSource)
        const awaitedOutcome = putBody.indexOf("const outcome = await runSerializableTransaction(")
        const outcomeHandling = putBody.indexOf("if (outcome.kind === \"NOT_FOUND\")")
        const notificationPosition = putBody.indexOf("await notifyUnitSold(")

        expect(awaitedOutcome).toBeGreaterThan(-1)
        expect(outcomeHandling).toBeGreaterThan(awaitedOutcome)
        expect(notificationPosition).toBeGreaterThan(outcomeHandling)
    })
})
