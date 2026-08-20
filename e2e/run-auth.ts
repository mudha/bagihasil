import { pathToFileURL } from "node:url"
import { cleanupE2EUsers, countE2EUsers, seedE2EUsers } from "./seed"
import { runE2ESuite } from "./run-suite"

async function main(): Promise<void> {
    await runE2ESuite({
        cleanup: cleanupE2EUsers,
        seed: seedE2EUsers,
        countFixtures: countE2EUsers,
        specPaths: ["e2e/specs/auth-roles.spec.ts"],
    })
}

const isEntrypoint = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : "E2E auth runner failed")
        process.exitCode = 1
    })
}

export { executeE2EWorkflow, verifyCleanCompletion } from "./run-suite"
