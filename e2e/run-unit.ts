import { cleanupE2EUsers, countE2EUsers, seedE2EUsers } from "./seed"
import { runE2ESuite } from "./run-suite"
import {
    cleanupE2EFinancialFixtures,
    countE2EFinancialFixtures,
    seedE2EFinancialFixtures,
} from "./unit-fixtures"

async function cleanup(): Promise<void> {
    await cleanupE2EFinancialFixtures()
    await cleanupE2EUsers()
}

async function seed(): Promise<void> {
    await seedE2EUsers()
    await seedE2EFinancialFixtures()
}

async function countFixtures(): Promise<number> {
    return await countE2EUsers() + await countE2EFinancialFixtures()
}

runE2ESuite({
    cleanup,
    seed,
    countFixtures,
    specPaths: ["e2e/specs/add-unit.spec.ts"],
}).catch((error) => {
    console.error(error instanceof Error ? error.message : "E2E unit runner failed")
    process.exitCode = 1
})
