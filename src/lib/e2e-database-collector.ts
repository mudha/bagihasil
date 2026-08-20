import type { PrismaClient } from "@prisma/client"
import {
    assertSafeE2EConfiguration,
    assertVerifiedE2EDatabase,
    type E2EDatabaseEvidence,
} from "./e2e-database-safety"
import {
    createPrismaE2EClient,
    type TrustedPrismaE2EClient,
} from "./e2e-prisma-client"

type E2EEnvironment = Record<string, string | undefined>

type EvidenceRow = {
    databaseName: unknown
    markerId: unknown
    disposable: unknown
}

type VerifiedPrismaClients = {
    pooled: PrismaClient
    direct: PrismaClient
}

function fail(reason: string): never {
    throw new Error(`E2E safety guard: ${reason}`)
}

function sanitizeFailure(): Error {
    return new Error("E2E safety guard: trusted database verification failed")
}

function parseEvidenceRows(value: unknown, connectionName: string): E2EDatabaseEvidence {
    if (!Array.isArray(value) || value.length !== 1) {
        fail(`${connectionName} connection must return exactly one marker row`)
    }

    const row = value[0] as EvidenceRow
    if (!row || typeof row !== "object") fail(`${connectionName} marker row is malformed`)
    if (typeof row.databaseName !== "string") fail(`${connectionName} database name is malformed`)
    if (typeof row.markerId !== "string") fail(`${connectionName} marker ID is malformed`)
    if (typeof row.disposable !== "boolean") fail(`${connectionName} disposable flag is malformed`)

    return {
        databaseName: row.databaseName,
        markerId: row.markerId,
        disposable: row.disposable,
    }
}

async function disconnectAll(clients: TrustedPrismaE2EClient[]): Promise<void> {
    const results = await Promise.allSettled(clients.map((client) => client.disconnect()))
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
        throw new AggregateError(
            failures.map(() => new Error("E2E database disconnect failed")),
            "E2E database cleanup failed"
        )
    }
}

async function collectTrustedClients(env: E2EEnvironment): Promise<{
    clients: VerifiedPrismaClients
    handles: TrustedPrismaE2EClient[]
}> {
    const config = assertSafeE2EConfiguration(env)
    const handles: TrustedPrismaE2EClient[] = []

    try {
        const pooled = createPrismaE2EClient(config.databaseUrl)
        handles.push(pooled)
        const direct = createPrismaE2EClient(config.directUrl)
        handles.push(direct)

        const evidenceResults = await Promise.allSettled([
            pooled.collectEvidence(),
            direct.collectEvidence(),
        ])
        if (evidenceResults.some((result) => result.status === "rejected")) {
            throw sanitizeFailure()
        }

        const [pooledResult, directResult] = evidenceResults as [
            PromiseFulfilledResult<unknown>,
            PromiseFulfilledResult<unknown>,
        ]
        const pooledRows = pooledResult.value
        const directRows = directResult.value

        const pooledEvidence = parseEvidenceRows(pooledRows, "pooled")
        const directEvidence = parseEvidenceRows(directRows, "direct")
        assertVerifiedE2EDatabase(env, pooledEvidence, directEvidence)

        return {
            clients: { pooled: pooled.prisma, direct: direct.prisma },
            handles,
        }
    } catch (primaryError) {
        try {
            await disconnectAll(handles)
        } catch (cleanupError) {
            throw new AggregateError(
                [sanitizeFailure(), cleanupError],
                "E2E database verification and cleanup failed"
            )
        }
        if (primaryError instanceof Error && primaryError.message.startsWith("E2E safety guard:")) {
            throw primaryError
        }
        throw sanitizeFailure()
    }
}

export async function withVerifiedE2EDatabase<T>(
    env: E2EEnvironment,
    callback: (database: VerifiedPrismaClients) => Promise<T>
): Promise<T> {
    const verified = await collectTrustedClients(env)
    let callbackFailed = false
    let callbackError: unknown
    try {
        return await callback(verified.clients)
    } catch (error) {
        callbackFailed = true
        callbackError = error
        throw error
    } finally {
        try {
            await disconnectAll(verified.handles)
        } catch (cleanupError) {
            if (callbackFailed) {
                throw new AggregateError(
                    [callbackError, cleanupError],
                    "E2E callback and database cleanup failed"
                )
            }
            throw cleanupError
        }
    }
}
