import { describe, expect, it } from "vitest"
import {
    assertSafeE2EConfiguration,
    assertVerifiedE2EDatabase,
    type E2EDatabaseEvidence,
} from "./e2e-database-safety"

const safeEnv = {
    NODE_ENV: "test",
    E2E_ALLOW_WRITES: "true",
    E2E_DATABASE_NAME: "bagihasil_e2e",
    E2E_DATABASE_MARKER_ID: "4a993d3c-0244-455b-b162-e9ece2097380",
    E2E_DATABASE_URL: "postgresql://test-user:test-pass@pool.e2e.example:6543/bagihasil_e2e",
    E2E_DIRECT_URL: "postgresql://test-user:test-pass@direct.e2e.example:5432/bagihasil_e2e",
    DATABASE_URL: "postgresql://app-user:app-pass@pool.production.example:6543/bagihasil",
    DIRECT_URL: "postgresql://app-user:app-pass@direct.production.example:5432/bagihasil",
}

const pooledEvidence: E2EDatabaseEvidence = {
    databaseName: "bagihasil_e2e",
    markerId: safeEnv.E2E_DATABASE_MARKER_ID,
    disposable: true,
}

const directEvidence: E2EDatabaseEvidence = { ...pooledEvidence }

describe("E2E database safety configuration", () => {
    it("accepts explicit test mode with separate ambient and E2E endpoints", () => {
        expect(assertSafeE2EConfiguration(safeEnv)).toEqual({
            databaseUrl: safeEnv.E2E_DATABASE_URL,
            directUrl: safeEnv.E2E_DIRECT_URL,
            expectedDatabaseName: safeEnv.E2E_DATABASE_NAME,
            expectedMarkerId: safeEnv.E2E_DATABASE_MARKER_ID,
        })
    })

    it.each([
        ["missing NODE_ENV", { NODE_ENV: undefined }],
        ["production NODE_ENV", { NODE_ENV: "production" }],
        ["case-variant NODE_ENV", { NODE_ENV: "TEST" }],
        ["missing write opt-in", { E2E_ALLOW_WRITES: undefined }],
        ["missing ambient DATABASE_URL", { DATABASE_URL: undefined }],
        ["missing ambient DIRECT_URL", { DIRECT_URL: undefined }],
        ["missing marker ID", { E2E_DATABASE_MARKER_ID: undefined }],
        ["invalid marker ID", { E2E_DATABASE_MARKER_ID: "not-a-uuid" }],
        ["non-E2E database name", { E2E_DATABASE_NAME: "bagihasil" }],
        ["hostless E2E URL", { E2E_DATABASE_URL: "postgresql:///bagihasil_e2e" }],
        ["same pooled endpoint as ambient", { DATABASE_URL: safeEnv.E2E_DATABASE_URL }],
        ["same direct endpoint as ambient", { DIRECT_URL: safeEnv.E2E_DIRECT_URL }],
    ])("rejects %s", (_label, override) => {
        expect(() => assertSafeE2EConfiguration({ ...safeEnv, ...override })).toThrow(/E2E safety guard/)
    })

    it("does not expose credentials in errors", () => {
        const secretUrl = "postgresql://sensitive-user:sensitive-password@/bagihasil_e2e"
        expect(() => assertSafeE2EConfiguration({ ...safeEnv, E2E_DATABASE_URL: secretUrl })).toThrowError(
            expect.not.stringMatching(/sensitive-user|sensitive-password/)
        )
    })
})

describe("verified E2E database evidence", () => {
    it("accepts independently queried pooled and direct evidence", () => {
        expect(() => assertVerifiedE2EDatabase(safeEnv, pooledEvidence, directEvidence)).not.toThrow()
    })

    it.each([
        ["wrong pooled database", { pooled: { ...pooledEvidence, databaseName: "bagihasil" }, direct: directEvidence }],
        ["wrong direct database", { pooled: pooledEvidence, direct: { ...directEvidence, databaseName: "bagihasil" } }],
        ["wrong marker", { pooled: { ...pooledEvidence, markerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, direct: directEvidence }],
        ["missing disposable flag", { pooled: pooledEvidence, direct: { ...directEvidence, disposable: false } }],
    ])("rejects %s", (_label, evidence) => {
        expect(() => assertVerifiedE2EDatabase(safeEnv, evidence.pooled, evidence.direct)).toThrow(/E2E safety guard/)
    })
})
