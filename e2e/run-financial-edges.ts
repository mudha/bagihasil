import { cleanupE2EUsers, countE2EUsers, seedE2EUsers } from "./seed"
import {
    cleanupE2ETransactionFixtures,
    countE2ETransactionFixtures,
    countE2EFinancialEdgeFixtures,
    seedE2EFinancialEdgeFixtures,
} from "./transaction-fixtures"
import { countE2EFinancialFixtures } from "./unit-fixtures"
import { runE2ESuite } from "./run-suite"

async function cleanup(): Promise<void> {
    await cleanupE2ETransactionFixtures()
    await cleanupE2EUsers()
}

async function seed(): Promise<void> {
    await seedE2EUsers()
    await seedE2EFinancialEdgeFixtures()
}

async function countFixtures(): Promise<number> {
    return await countE2EUsers()
        + await countE2ETransactionFixtures()
        + await countE2EFinancialFixtures()
        + await countE2EFinancialEdgeFixtures()
}

runE2ESuite({
    cleanup,
    seed,
    countFixtures,
    specPaths: ["e2e/specs/financial-edge-cases.spec.ts"],
}).catch((error) => {
    console.error(error instanceof Error ? error.message : "E2E financial edge runner failed")
    process.exitCode = 1
})

// The runner's final count is the fail-closed cleanup proof.
// This file is intentionally disposable until the scenario set is complete.
