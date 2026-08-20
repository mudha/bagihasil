import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { withVerifiedE2EDatabase } from "./e2e-database-collector"

function loadTestEnvironment(): Record<string, string> {
    const values: Record<string, string> = {}
    for (const rawLine of readFileSync(".env.test.local", "utf8").split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith("#")) continue
        const separator = line.indexOf("=")
        if (separator < 1) throw new Error("E2E safety guard: malformed test environment")
        values[line.slice(0, separator)] = line.slice(separator + 1)
    }
    return values
}

const integrationTest = process.env.E2E_RUN_DB_INTEGRATION === "true" ? it : it.skip

describe("real isolated E2E database collector", () => {
    integrationTest("verifies pooled and direct connections before exposing clients", async () => {
        const fileEnv = loadTestEnvironment()
        const env = {
            ...fileEnv,
            NODE_ENV: "test",
            E2E_ALLOW_WRITES: "true",
            DATABASE_URL: "postgresql://ambient.invalid:5432/bagihasil",
            DIRECT_URL: "postgresql://ambient.invalid:5432/bagihasil",
        }

        await expect(withVerifiedE2EDatabase(env, async ({ pooled, direct }) => {
            expect(pooled).not.toBe(direct)
            expect(await pooled.$queryRaw<Array<{ databaseName: string }>>`SELECT current_database() AS "databaseName"`)
                .toEqual([{ databaseName: fileEnv.E2E_DATABASE_NAME }])
        })).resolves.toBeUndefined()
    })
})
