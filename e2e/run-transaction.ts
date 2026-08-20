import { cleanupE2EUsers, countE2EUsers, seedE2EUsers } from "./seed"
import { runE2ESuite } from "./run-suite"
import {
    cleanupE2ETransactionFixtures,
    countE2ETransactionFixtures,
    seedE2ETransactionFixtures,
} from "./transaction-fixtures"
import { countE2EFinancialFixtures } from "./unit-fixtures"

async function cleanup(): Promise<void> {
    await cleanupE2ETransactionFixtures()
    await cleanupE2EUsers()
}

async function seed(): Promise<void> {
    await seedE2EUsers()
    await seedE2ETransactionFixtures()
}

async function countFixtures(): Promise<number> {
    return await countE2EUsers()
        + await countE2ETransactionFixtures()
        + await countE2EFinancialFixtures()
}

runE2ESuite({
    cleanup,
    seed,
    countFixtures,
    specPaths: ["e2e/specs/create-transaction.spec.ts"],
}).catch((error) => {
    console.error(error instanceof Error ? error.message : "E2E transaction runner failed")
    process.exitCode = 1
})
