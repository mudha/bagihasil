import { describe, expect, it, vi } from "vitest"
import { executeE2EWorkflow, verifyCleanCompletion } from "./run-auth"

describe("E2E auth workflow cleanup", () => {
    it("runs final cleanup when seeding fails partially", async () => {
        const cleanup = vi.fn().mockResolvedValue(undefined)
        const seed = vi.fn().mockRejectedValue(new Error("partial seed failure"))
        const build = vi.fn()
        const test = vi.fn()

        await expect(executeE2EWorkflow({ cleanup, seed, build, test }))
            .rejects.toThrow("partial seed failure")
        expect(cleanup).toHaveBeenCalledTimes(2)
        expect(build).not.toHaveBeenCalled()
    })

    it("runs final cleanup when browser tests fail", async () => {
        const cleanup = vi.fn().mockResolvedValue(undefined)
        const seed = vi.fn().mockResolvedValue(undefined)
        const build = vi.fn().mockResolvedValue(undefined)
        const test = vi.fn().mockRejectedValue(new Error("browser failure"))

        await expect(executeE2EWorkflow({ cleanup, seed, build, test }))
            .rejects.toThrow("browser failure")
        expect(cleanup).toHaveBeenCalledTimes(2)
    })

    it("stops after initial cleanup when interrupted and still performs final cleanup", async () => {
        const cleanup = vi.fn().mockResolvedValue(undefined)
        const seed = vi.fn()
        let interrupted = false
        cleanup.mockImplementationOnce(async () => { interrupted = true })

        await expect(executeE2EWorkflow({
            cleanup,
            seed,
            build: vi.fn(),
            test: vi.fn(),
            isInterrupted: () => interrupted,
        })).rejects.toThrow("E2E run interrupted")

        expect(seed).not.toHaveBeenCalled()
        expect(cleanup).toHaveBeenCalledTimes(2)
    })

    it("waits for an interrupted seed to settle before final cleanup and skips build", async () => {
        const order: string[] = []
        let interrupted = false
        const cleanup = vi.fn(async () => { order.push("cleanup") })
        const seed = vi.fn(async () => {
            order.push("seed-start")
            interrupted = true
            order.push("seed-end")
        })

        await expect(executeE2EWorkflow({
            cleanup,
            seed,
            build: vi.fn(),
            test: vi.fn(),
            isInterrupted: () => interrupted,
        })).rejects.toThrow("E2E run interrupted")

        expect(order).toEqual(["cleanup", "seed-start", "seed-end", "cleanup"])
    })

    it("fails when interrupted during final cleanup", async () => {
        let interrupted = false
        const cleanup = vi.fn()
            .mockResolvedValueOnce(undefined)
            .mockImplementationOnce(async () => { interrupted = true })

        await expect(executeE2EWorkflow({
            cleanup,
            seed: vi.fn().mockResolvedValue(undefined),
            build: vi.fn().mockResolvedValue(undefined),
            test: vi.fn().mockResolvedValue(undefined),
            isInterrupted: () => interrupted,
        })).rejects.toThrow("E2E run interrupted")
    })
})

describe("E2E clean completion verification", () => {
    it("fails when interrupted during the final fixture count", async () => {
        let interrupted = false
        const count = vi.fn(async () => {
            interrupted = true
            return 0
        })

        await expect(verifyCleanCompletion(count, () => interrupted))
            .rejects.toThrow("E2E run interrupted")
    })
})
