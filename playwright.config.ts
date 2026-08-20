import { defineConfig, devices } from "@playwright/test"
import { loadE2EEnvironment } from "./e2e/test-env"

const env = loadE2EEnvironment()

export default defineConfig({
    testDir: "./e2e/specs",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    use: {
        baseURL: env.E2E_BASE_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: {
        command: "npx next start -H 127.0.0.1 -p 3100",
        url: `${env.E2E_BASE_URL}/login`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
            ...process.env,
            ...env,
            DATABASE_URL: env.E2E_DATABASE_URL,
            DIRECT_URL: env.E2E_DIRECT_URL,
        },
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                channel: "chrome",
            },
        },
    ],
})
