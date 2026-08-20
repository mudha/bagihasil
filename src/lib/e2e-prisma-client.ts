import { PrismaClient } from "@prisma/client"
import type { E2EDatabaseEvidence } from "./e2e-database-safety"

export type TrustedPrismaE2EClient = {
    prisma: PrismaClient
    collectEvidence: () => Promise<unknown>
    disconnect: () => Promise<void>
}

export function createPrismaE2EClient(databaseUrl: string): TrustedPrismaE2EClient {
    const prisma = new PrismaClient({
        datasources: {
            db: { url: databaseUrl },
        },
    })

    return {
        prisma,
        collectEvidence: async () => prisma.$queryRaw<E2EDatabaseEvidence[]>`
            SELECT
                current_database() AS "databaseName",
                marker_id::text AS "markerId",
                disposable
            FROM e2e_safety.database_marker
        `,
        disconnect: async () => prisma.$disconnect(),
    }
}
