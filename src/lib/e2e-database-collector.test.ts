import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    createPrismaE2EClient: vi.fn(),
}))

vi.mock("./e2e-prisma-client", () => ({
    createPrismaE2EClient: mocks.createPrismaE2EClient,
}))

import { withVerifiedE2EDatabase } from "./e2e-database-collector"

const env = {
    NODE_ENV: "test",
    E2E_ALLOW_WRITES: "true",
    E2E_DATABASE_NAME: "bagihasil_e2e",
    E2E_DATABASE_MARKER_ID: "4a993d3c-0244-455b-b162-e9ece2097380",
    E2E_DATABASE_URL: "postgresql://test:test@pool.e2e.example:6543/bagihasil_e2e",
    E2E_DIRECT_URL: "postgresql://test:test@direct.e2e.example:5432/bagihasil_e2e",
    DATABASE_URL: "postgresql://app:app@pool.production.example:6543/bagihasil",
    DIRECT_URL: "postgresql://app:app@direct.production.example:5432/bagihasil",
}

const validRows = [{
    databaseName: "bagihasil_e2e",
    markerId: env.E2E_DATABASE_MARKER_ID,
    disposable: true,
}]

function client(rows: unknown = validRows) {
    return {
        prisma: { client: Symbol("explicit write capability") },
        collectEvidence: vi.fn().mockResolvedValue(rows),
        disconnect: vi.fn().mockResolvedValue(undefined),
    }
}

describe("trusted E2E database collector", () => {
    beforeEach(() => mocks.createPrismaE2EClient.mockReset())

    it("binds the trusted Prisma factory internally and exposes explicit clients only after proof", async () => {
        const pooled = client()
        const direct = client()
        mocks.createPrismaE2EClient.mockReturnValueOnce(pooled).mockReturnValueOnce(direct)
        const callback = vi.fn().mockResolvedValue("done")

        await expect(withVerifiedE2EDatabase(env, callback)).resolves.toBe("done")

        expect(mocks.createPrismaE2EClient).toHaveBeenNthCalledWith(1, env.E2E_DATABASE_URL)
        expect(mocks.createPrismaE2EClient).toHaveBeenNthCalledWith(2, env.E2E_DIRECT_URL)
        expect(pooled.collectEvidence).toHaveBeenCalledTimes(1)
        expect(direct.collectEvidence).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith({ pooled: pooled.prisma, direct: direct.prisma })
        expect(pooled.disconnect).toHaveBeenCalledTimes(1)
        expect(direct.disconnect).toHaveBeenCalledTimes(1)
    })

    it.each([
        ["missing marker", []],
        ["duplicate marker", [validRows[0], validRows[0]]],
        ["wrong marker", [{ ...validRows[0], markerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }]],
        ["wrong database", [{ ...validRows[0], databaseName: "bagihasil" }]],
        ["not disposable", [{ ...validRows[0], disposable: false }]],
        ["malformed row", [{ databaseName: 123, markerId: null, disposable: "yes" }]],
    ])("rejects %s, skips callback, and disconnects both", async (_label, rows) => {
        const pooled = client(rows)
        const direct = client()
        mocks.createPrismaE2EClient.mockReturnValueOnce(pooled).mockReturnValueOnce(direct)
        const callback = vi.fn()

        await expect(withVerifiedE2EDatabase(env, callback)).rejects.toThrow(/E2E safety guard/)
        expect(callback).not.toHaveBeenCalled()
        expect(pooled.disconnect).toHaveBeenCalledTimes(1)
        expect(direct.disconnect).toHaveBeenCalledTimes(1)
    })

    it("disconnects both clients when callback rejects", async () => {
        const pooled = client()
        const direct = client()
        mocks.createPrismaE2EClient.mockReturnValueOnce(pooled).mockReturnValueOnce(direct)

        await expect(withVerifiedE2EDatabase(env, async () => { throw new Error("callback failed") }))
            .rejects.toThrow("callback failed")
        expect(pooled.disconnect).toHaveBeenCalledTimes(1)
        expect(direct.disconnect).toHaveBeenCalledTimes(1)
    })

    it("preserves an undefined callback rejection when cleanup also fails", async () => {
        const pooled = client()
        const direct = client()
        pooled.disconnect.mockRejectedValueOnce(new Error("secret cleanup failure"))
        mocks.createPrismaE2EClient.mockReturnValueOnce(pooled).mockReturnValueOnce(direct)

        const error = await withVerifiedE2EDatabase(env, async () => Promise.reject(undefined)).catch((value) => value)
        expect(error).toBeInstanceOf(AggregateError)
        expect(error.message).toBe("E2E callback and database cleanup failed")
        expect(error.errors).toHaveLength(2)
        expect(pooled.disconnect).toHaveBeenCalledTimes(1)
        expect(direct.disconnect).toHaveBeenCalledTimes(1)
    })

    it("waits for both evidence queries to settle before disconnecting", async () => {
        let resolveDirect!: (value: unknown) => void
        const directPending = new Promise((resolve) => { resolveDirect = resolve })
        const pooled = client()
        const direct = client()
        pooled.collectEvidence.mockRejectedValueOnce(new Error("pooled query failed"))
        direct.collectEvidence.mockReturnValueOnce(directPending)
        mocks.createPrismaE2EClient.mockReturnValueOnce(pooled).mockReturnValueOnce(direct)

        const result = withVerifiedE2EDatabase(env, vi.fn())
        await Promise.resolve()
        await Promise.resolve()
        expect(pooled.disconnect).not.toHaveBeenCalled()
        expect(direct.disconnect).not.toHaveBeenCalled()

        resolveDirect(validRows)
        await expect(result).rejects.toThrow(/E2E safety guard/)
        expect(pooled.disconnect).toHaveBeenCalledTimes(1)
        expect(direct.disconnect).toHaveBeenCalledTimes(1)
    })

    it("attempts both disconnects and surfaces cleanup failure", async () => {
        const pooled = client()
        const direct = client()
        pooled.disconnect.mockRejectedValueOnce(new Error("secret pooled URL"))
        direct.disconnect.mockRejectedValueOnce(new Error("secret direct URL"))
        mocks.createPrismaE2EClient.mockReturnValueOnce(pooled).mockReturnValueOnce(direct)

        const error = await withVerifiedE2EDatabase(env, async () => "done").catch((value) => value)
        expect(error).toBeInstanceOf(AggregateError)
        expect(String(error)).toContain("E2E database cleanup failed")
        expect(String(error)).not.toMatch(/secret|postgresql:\/\//)
        expect(pooled.disconnect).toHaveBeenCalledTimes(1)
        expect(direct.disconnect).toHaveBeenCalledTimes(1)
    })

    it("sanitizes connection failures and disconnects an already-created client", async () => {
        const pooled = client()
        mocks.createPrismaE2EClient
            .mockReturnValueOnce(pooled)
            .mockImplementationOnce(() => { throw new Error("postgresql://user:password@production/db") })

        const error = await withVerifiedE2EDatabase(env, vi.fn()).catch((value) => value)
        expect(String(error)).toContain("E2E safety guard")
        expect(String(error)).not.toMatch(/password|production|postgresql:\/\//)
        expect(pooled.disconnect).toHaveBeenCalledTimes(1)
    })
})
