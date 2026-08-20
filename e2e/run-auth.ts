import { spawn, type ChildProcess } from "node:child_process"
import { pathToFileURL } from "node:url"
import { cleanupE2EUsers, countE2EUsers, seedE2EUsers } from "./seed"
import { loadE2EEnvironment } from "./test-env"

type WorkflowSteps = {
    cleanup: () => Promise<void>
    seed: () => Promise<void>
    build: () => Promise<void>
    test: () => Promise<void>
    isInterrupted?: () => boolean
}

function assertNotInterrupted(isInterrupted: () => boolean): void {
    if (isInterrupted()) throw new Error("E2E run interrupted")
}

export async function executeE2EWorkflow(steps: WorkflowSteps): Promise<void> {
    const isInterrupted = steps.isInterrupted ?? (() => false)
    try {
        await steps.cleanup()
        assertNotInterrupted(isInterrupted)
        await steps.seed()
        assertNotInterrupted(isInterrupted)
        await steps.build()
        assertNotInterrupted(isInterrupted)
        await steps.test()
        assertNotInterrupted(isInterrupted)
    } finally {
        await steps.cleanup()
    }
    assertNotInterrupted(isInterrupted)
}

export async function verifyCleanCompletion(
    countFixtures: () => Promise<number>,
    isInterrupted: () => boolean
): Promise<void> {
    assertNotInterrupted(isInterrupted)
    const remaining = await countFixtures()
    assertNotInterrupted(isInterrupted)
    if (remaining !== 0) {
        throw new Error("E2E safety guard: prefixed users remain after cleanup")
    }
}

async function main(): Promise<void> {
    const e2e = loadE2EEnvironment()
    const env = {
        ...process.env,
        ...e2e,
        DATABASE_URL: e2e.E2E_DATABASE_URL,
        DIRECT_URL: e2e.E2E_DIRECT_URL,
    }

    let interrupted = false
    let activeChild: ChildProcess | undefined

    const run = (command: string, args: string[]): Promise<void> => new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            env,
            stdio: "inherit",
            shell: false,
            detached: true,
        })
        activeChild = child
        child.once("error", reject)
        child.once("exit", (code, signal) => {
            if (activeChild === child) activeChild = undefined
            if (code === 0) resolve()
            else reject(new Error(`E2E command failed (${signal || code})`))
        })
    })

    const interrupt = () => {
        interrupted = true
        process.exitCode = 1
        if (activeChild?.pid) {
            try {
                process.kill(-activeChild.pid, "SIGTERM")
            } catch {
                // The child may already have exited; workflow cleanup still runs in finally.
            }
        }
    }
    process.once("SIGINT", interrupt)
    process.once("SIGTERM", interrupt)

    await executeE2EWorkflow({
        cleanup: cleanupE2EUsers,
        seed: seedE2EUsers,
        build: () => run("npm", ["run", "build"]),
        test: () => run("./node_modules/.bin/playwright", ["test", "e2e/specs/auth-roles.spec.ts"]),
        isInterrupted: () => interrupted,
    })
    await verifyCleanCompletion(countE2EUsers, () => interrupted)
}

const isEntrypoint = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : "E2E auth runner failed")
        process.exitCode = 1
    })
}
