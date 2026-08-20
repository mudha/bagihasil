import { spawn, type ChildProcess } from "node:child_process"
import { loadE2EEnvironment } from "./test-env"

type WorkflowSteps = {
    cleanup: () => Promise<void>
    seed: () => Promise<void>
    build: () => Promise<void>
    test: () => Promise<void>
    isInterrupted?: () => boolean
}

type SuiteOptions = {
    cleanup: () => Promise<void>
    seed: () => Promise<void>
    countFixtures: () => Promise<number>
    specPaths: readonly string[]
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
        throw new Error("E2E safety guard: fixtures remain after cleanup")
    }
}

export async function runE2ESuite(options: SuiteOptions): Promise<void> {
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
                // The child may already have exited; final cleanup remains fail-closed.
            }
        }
    }
    process.once("SIGINT", interrupt)
    process.once("SIGTERM", interrupt)

    try {
        await executeE2EWorkflow({
            cleanup: options.cleanup,
            seed: options.seed,
            build: () => run("npm", ["run", "build"]),
            test: () => run("./node_modules/.bin/playwright", ["test", ...options.specPaths]),
            isInterrupted: () => interrupted,
        })
        await verifyCleanCompletion(options.countFixtures, () => interrupted)
    } finally {
        process.removeListener("SIGINT", interrupt)
        process.removeListener("SIGTERM", interrupt)
    }
}
