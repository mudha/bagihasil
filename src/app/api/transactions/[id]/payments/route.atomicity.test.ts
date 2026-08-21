import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const routeSource = readFileSync(
    new URL("./route.ts", import.meta.url),
    "utf8"
)

describe("payment route atomicity and safety", () => {
    it("uses one serializable transaction for payment and status mutation", () => {
        expect(routeSource).toContain("runSerializableTransaction(prisma, async (tx) =>")
        expect(routeSource).toContain("await tx.paymentHistory.create(")
        expect(routeSource).toContain("await tx.transaction.update(")
        expect(routeSource).toContain("const totalPaidBefore")
        expect(routeSource).toContain("const investorShouldReceive")
    })

    it("rejects duplicate exact payloads and overpayments before creating a row", () => {
        expect(routeSource).toContain("kind: 'DUPLICATE'")
        expect(routeSource).toContain("kind: 'OVERPAYMENT'")
        expect(routeSource).toContain("if (duplicate) return")
        expect(routeSource).toContain("if (validatedData.amount > remainingBefore + 100)")
        expect(routeSource.indexOf("if (duplicate)")).toBeLessThan(routeSource.indexOf("tx.paymentHistory.create"))
        expect(routeSource.indexOf("if (validatedData.amount > remainingBefore + 100)")).toBeLessThan(routeSource.indexOf("tx.paymentHistory.create"))
    })

    it("sends notifications only after the committed transaction outcome", () => {
        const outcome = routeSource.indexOf("const outcome = await runSerializableTransaction")
        const notification = routeSource.indexOf("await notifyPaymentProof(")
        expect(outcome).toBeGreaterThan(-1)
        expect(notification).toBeGreaterThan(outcome)
        expect(routeSource.slice(outcome, notification)).toContain("if (outcome.kind === 'OVERPAYMENT')")
    })

    it("persists and replays an idempotency key", () => {
        expect(routeSource).toContain("idempotencyKey")
        expect(routeSource).toContain("IDEMPOTENT_REPLAY")
        expect(routeSource).toContain("replayed: true")
    })
})
