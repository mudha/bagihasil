import bcrypt from "bcryptjs"
import { withVerifiedE2EDatabase } from "../src/lib/e2e-database-collector"
import { E2E_USERS, E2E_USER_PREFIX, loadE2EEnvironment } from "./test-env"

export async function seedE2EUsers(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await direct.user.deleteMany({
            where: { username: { startsWith: E2E_USER_PREFIX } },
        })

        for (const user of Object.values(E2E_USERS)) {
            await direct.user.create({
                data: {
                    username: user.username,
                    name: `E2E ${user.role}`,
                    role: user.role,
                    passwordHash: await bcrypt.hash(user.password, 10),
                },
            })
        }
    })
}

export async function cleanupE2EUsers(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await direct.user.deleteMany({
            where: { username: { startsWith: E2E_USER_PREFIX } },
        })
    })
}

export async function countE2EUsers(): Promise<number> {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => direct.user.count({
        where: { username: { startsWith: E2E_USER_PREFIX } },
    }))
}

export async function countE2EUserByUsername(username: string): Promise<number> {
    if (!username.startsWith(E2E_USER_PREFIX)) {
        throw new Error("E2E safety guard: refusing to inspect a non-E2E username")
    }
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => direct.user.count({
        where: { username },
    }))
}

if (process.argv[1]?.endsWith("seed.ts")) {
    seedE2EUsers().catch((error) => {
        console.error(error instanceof Error ? error.message : "E2E seed failed")
        process.exitCode = 1
    })
}
