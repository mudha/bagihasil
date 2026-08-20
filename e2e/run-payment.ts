import { cleanupE2EUsers, countE2EUsers, seedE2EUsers } from "./seed"
import {
    cleanupE2ETransactionFixtures,
    countE2EFinalizationFixtures,
    countE2EPaymentFixtures,
    countE2ETransactionFixtures,
    seedE2EPaymentFixture,
} from "./transaction-fixtures"
import { countE2EFinancialFixtures } from "./unit-fixtures"
import { runE2ESuite } from "./run-suite"

async function cleanup(): Promise<void> {
    await cleanupE2ETransactionFixtures()
    await cleanupE2EUsers()
}

async function seed(): Promise<void> {
    await seedE2EUsers()
    await seedE2EPaymentFixture()
}

async function countFixtures(): Promise<number> {
    return await countE2EUsers()
        + await countE2ETransactionFixtures()
        + await countE2EFinalizationFixtures()
        + await countE2EPaymentFixtures()
        + await countE2EFinancialFixtures()
}

runE2ESuite({
    cleanup,
    seed,
    countFixtures,
    specPaths: ["e2e/specs/record-payment.spec.ts"],
}).catch((error) => {
    console.error(error instanceof Error ? error.message : "E2E payment runner failed")
    process.exitCode = 1
})
