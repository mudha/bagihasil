type E2EEnvironment = Record<string, string | undefined>

export type E2EDatabaseEvidence = {
    databaseName: string
    markerId: string | undefined
    disposable: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const E2E_DATABASE_NAME_PATTERN = /(?:^|[_-])e2e(?:$|[_-])/i

function fail(reason: string): never {
    throw new Error(`E2E safety guard: ${reason}`)
}

function requireValue(env: E2EEnvironment, name: string): string {
    const value = env[name]
    if (!value) fail(`${name} is required`)
    return value
}

function parseDatabaseUrl(value: string, variableName: string): URL {
    try {
        const url = new URL(value)
        if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
            fail(`${variableName} must use PostgreSQL`)
        }
        if (!url.hostname) fail(`${variableName} must specify a hostname`)
        if (!url.pathname || url.pathname === "/") fail(`${variableName} must specify a database name`)
        return url
    } catch {
        fail(`${variableName} is invalid`)
    }
}

function databaseName(url: URL): string {
    return decodeURIComponent(url.pathname.replace(/^\//, ""))
}

function endpointIdentity(url: URL): string {
    const port = url.port || "5432"
    return `${url.hostname.toLowerCase()}:${port}/${databaseName(url)}`
}

export function assertSafeE2EConfiguration(env: E2EEnvironment): {
    databaseUrl: string
    directUrl: string
    expectedDatabaseName: string
    expectedMarkerId: string
} {
    if (env.NODE_ENV !== "test") fail("NODE_ENV must be exactly test")
    if (env.E2E_ALLOW_WRITES !== "true") fail("explicit write opt-in is required")

    const expectedDatabaseName = requireValue(env, "E2E_DATABASE_NAME")
    if (!E2E_DATABASE_NAME_PATTERN.test(expectedDatabaseName)) {
        fail("E2E_DATABASE_NAME must contain a delimited e2e marker")
    }

    const expectedMarkerId = requireValue(env, "E2E_DATABASE_MARKER_ID")
    if (!UUID_PATTERN.test(expectedMarkerId)) fail("E2E_DATABASE_MARKER_ID must be a UUID")

    const databaseUrlValue = requireValue(env, "E2E_DATABASE_URL")
    const directUrlValue = requireValue(env, "E2E_DIRECT_URL")
    const ambientDatabaseUrlValue = requireValue(env, "DATABASE_URL")
    const ambientDirectUrlValue = requireValue(env, "DIRECT_URL")

    const databaseUrl = parseDatabaseUrl(databaseUrlValue, "E2E_DATABASE_URL")
    const directUrl = parseDatabaseUrl(directUrlValue, "E2E_DIRECT_URL")
    const ambientDatabaseUrl = parseDatabaseUrl(ambientDatabaseUrlValue, "DATABASE_URL")
    const ambientDirectUrl = parseDatabaseUrl(ambientDirectUrlValue, "DIRECT_URL")

    if (databaseName(databaseUrl) !== expectedDatabaseName || databaseName(directUrl) !== expectedDatabaseName) {
        fail("both E2E URLs must name the expected E2E database")
    }

    const ambientIdentities = new Set([
        endpointIdentity(ambientDatabaseUrl),
        endpointIdentity(ambientDirectUrl),
    ])
    if (ambientIdentities.has(endpointIdentity(databaseUrl)) || ambientIdentities.has(endpointIdentity(directUrl))) {
        fail("E2E endpoints must differ from all ambient endpoints")
    }

    return {
        databaseUrl: databaseUrlValue,
        directUrl: directUrlValue,
        expectedDatabaseName,
        expectedMarkerId,
    }
}

export function assertVerifiedE2EDatabase(
    env: E2EEnvironment,
    pooledEvidence: E2EDatabaseEvidence,
    directEvidence: E2EDatabaseEvidence
): void {
    const config = assertSafeE2EConfiguration(env)

    for (const [connection, evidence] of [
        ["pooled", pooledEvidence],
        ["direct", directEvidence],
    ] as const) {
        if (evidence.databaseName !== config.expectedDatabaseName) {
            fail(`${connection} connection returned an unexpected database name`)
        }
        if (evidence.markerId !== config.expectedMarkerId) {
            fail(`${connection} connection returned an unexpected E2E marker`)
        }
        if (evidence.disposable !== true) {
            fail(`${connection} connection is not marked disposable`)
        }
    }
}
