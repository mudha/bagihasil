import { readFileSync } from "node:fs"

const REQUIRED_BASE_URL = "http://localhost:3100"

export function loadE2EEnvironment(): Record<string, string> {
    const values: Record<string, string> = {}
    for (const rawLine of readFileSync(".env.test.local", "utf8").split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith("#")) continue
        const separator = line.indexOf("=")
        if (separator < 1) throw new Error("E2E safety guard: malformed test environment")
        values[line.slice(0, separator)] = line.slice(separator + 1)
    }

    const baseUrl = values.E2E_BASE_URL || REQUIRED_BASE_URL
    if (baseUrl !== REQUIRED_BASE_URL) {
        throw new Error("E2E safety guard: browser base URL must use the fixed loopback endpoint")
    }

    return {
        ...values,
        NODE_ENV: "test",
        E2E_ALLOW_WRITES: "true",
        E2E_BASE_URL: baseUrl,
        DATABASE_URL: "postgresql://ambient.invalid:5432/bagihasil",
        DIRECT_URL: "postgresql://ambient.invalid:5432/bagihasil",
        AUTH_SECRET: "bagihasil-e2e-only-secret-not-for-production-2026",
        AUTH_URL: baseUrl,
        NEXTAUTH_URL: baseUrl,
    }
}

export const E2E_USERS = {
    admin: { username: "e2e_admin", password: "E2eAdmin!2026", role: "ADMIN" },
    viewer: { username: "e2e_viewer", password: "E2eViewer!2026", role: "VIEWER" },
    investor: { username: "e2e_investor", password: "E2eInvestor!2026", role: "INVESTOR" },
} as const

export const E2E_USER_PREFIX = "e2e_"
