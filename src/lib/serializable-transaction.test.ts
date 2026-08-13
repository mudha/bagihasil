import { describe, expect, it, vi } from "vitest"

import { runSerializableTransaction } from "./serializable-transaction"

describe("runSerializableTransaction", () => {
    it("retries after the callback ran but the PostgreSQL commit conflicted", async () => {
        const conflict = Object.assign(new Error("write conflict"), { code: "P2034" })
        const transaction = vi.fn()
            .mockImplementationOnce(async (callback) => {
                await callback({ attempt: 1 })
                throw conflict
            })
            .mockImplementationOnce(async (callback) => callback({ attempt: 2 }))
        const prisma = { $transaction: transaction }
        const operation = vi.fn(async (tx) => tx.attempt)

        const result = await runSerializableTransaction(prisma, operation)

        expect(result).toBe(2)
        expect(operation).toHaveBeenCalledTimes(2)
        expect(transaction).toHaveBeenCalledTimes(2)
        expect(transaction).toHaveBeenNthCalledWith(1, operation, {
            isolationLevel: "Serializable",
        })
    })

    it("lets callers emit side effects only from the attempt that committed", async () => {
        const conflict = Object.assign(new Error("write conflict"), { code: "P2034" })
        const transaction = vi.fn()
            .mockImplementationOnce(async (callback) => {
                await callback({ status: "ON_PROCESS" })
                throw conflict
            })
            .mockImplementationOnce(async (callback) => callback({ status: "COMPLETED" }))
        const notify = vi.fn()

        const outcome = await runSerializableTransaction(
            { $transaction: transaction },
            async (tx) => ({ shouldNotify: tx.status === "ON_PROCESS" })
        )
        if (outcome.shouldNotify) notify()

        expect(transaction).toHaveBeenCalledTimes(2)
        expect(notify).not.toHaveBeenCalled()
    })

    it("does not retry non-conflict errors", async () => {
        const failure = new Error("validation failed")
        const transaction = vi.fn().mockRejectedValue(failure)
        const operation = vi.fn()

        await expect(runSerializableTransaction({ $transaction: transaction }, operation))
            .rejects.toBe(failure)
        expect(transaction).toHaveBeenCalledTimes(1)
    })

    it("stops after the configured conflict retry limit", async () => {
        const conflict = Object.assign(new Error("write conflict"), { code: "P2034" })
        const transaction = vi.fn().mockRejectedValue(conflict)

        await expect(runSerializableTransaction({ $transaction: transaction }, vi.fn(), 2))
            .rejects.toBe(conflict)
        expect(transaction).toHaveBeenCalledTimes(2)
    })
})
