import bcrypt from "bcryptjs"
import { withVerifiedE2EDatabase } from "../src/lib/e2e-database-collector"
import { E2E_USERS, E2E_USER_PREFIX, loadE2EEnvironment } from "./test-env"

const E2E_ACCESS_PREFIX = "E2E-RBAC-"

export async function cleanupAccessFixtures(direct: any): Promise<void> {
    const units = await direct.unit.findMany({
        where: { code: { startsWith: E2E_ACCESS_PREFIX } },
        select: { id: true },
    })
    const unitIds = units.map((unit: { id: string }) => unit.id)
    if (unitIds.length > 0) {
        const transactions = await direct.transaction.findMany({
            where: { unitId: { in: unitIds } },
            select: { id: true, transactionCode: true },
        })
        const unsafeTransaction = transactions.find(
            (transaction: { transactionCode: string }) => !transaction.transactionCode.startsWith(E2E_ACCESS_PREFIX)
        )
        if (unsafeTransaction) {
            throw new Error("E2E safety guard: refusing to delete non-prefixed transaction")
        }
        const transactionIds = transactions.map((transaction: { id: string }) => transaction.id)
        if (transactionIds.length > 0) {
            const costs = await direct.cost.findMany({
                where: { transactionId: { in: transactionIds } },
                select: { id: true },
            })
            const costIds = costs.map((cost: { id: string }) => cost.id)
            if (costIds.length > 0) {
                await direct.costProof.deleteMany({ where: { costId: { in: costIds } } })
            }
            await direct.paymentHistory.deleteMany({ where: { transactionId: { in: transactionIds } } })
            await direct.transactionProof.deleteMany({ where: { transactionId: { in: transactionIds } } })
            await direct.cost.deleteMany({ where: { transactionId: { in: transactionIds } } })
            await direct.profitSharing.deleteMany({ where: { transactionId: { in: transactionIds } } })
            await direct.transaction.deleteMany({ where: { id: { in: transactionIds } } })
        }
        await direct.unit.deleteMany({ where: { id: { in: unitIds } } })
    }
    await direct.investor.deleteMany({ where: { name: { startsWith: E2E_ACCESS_PREFIX } } })
}

export async function seedE2EUsers(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupAccessFixtures(direct)
        await direct.user.deleteMany({ where: { username: { startsWith: E2E_USER_PREFIX } } })

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

        const investorUser = await direct.user.findUniqueOrThrow({
            where: { username: E2E_USERS.investor.username },
        })
        const ownInvestor = await direct.investor.create({
            data: { name: `${E2E_ACCESS_PREFIX}OWN`, userId: investorUser.id },
        })
        const otherInvestor = await direct.investor.create({
            data: { name: `${E2E_ACCESS_PREFIX}OTHER` },
        })
        const ownUnit = await direct.unit.create({
            data: { investorId: ownInvestor.id, name: `${E2E_ACCESS_PREFIX}OWN-UNIT`, code: `${E2E_ACCESS_PREFIX}OWN-UNIT` },
        })
        const otherUnit = await direct.unit.create({
            data: { investorId: otherInvestor.id, name: `${E2E_ACCESS_PREFIX}OTHER-UNIT`, code: `${E2E_ACCESS_PREFIX}OTHER-UNIT` },
        })
        await direct.transaction.createMany({
            data: [
                { unitId: ownUnit.id, transactionCode: `${E2E_ACCESS_PREFIX}OWN-TX`, buyDate: new Date("2026-01-01"), buyPrice: 1_000_000 },
                { unitId: otherUnit.id, transactionCode: `${E2E_ACCESS_PREFIX}OTHER-TX`, buyDate: new Date("2026-01-01"), buyPrice: 2_000_000 },
            ],
        })
    })
}

export async function cleanupE2EUsers(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupAccessFixtures(direct)
        await direct.user.deleteMany({ where: { username: { startsWith: E2E_USER_PREFIX } } })
    })
}

export async function countE2EUsers(): Promise<number> {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => {
        const [users, investors, units, transactions] = await Promise.all([
            direct.user.count({ where: { username: { startsWith: E2E_USER_PREFIX } } }),
            direct.investor.count({ where: { name: { startsWith: E2E_ACCESS_PREFIX } } }),
            direct.unit.count({ where: { code: { startsWith: E2E_ACCESS_PREFIX } } }),
            direct.transaction.count({ where: { transactionCode: { startsWith: E2E_ACCESS_PREFIX } } }),
        ])
        return users + investors + units + transactions
    })
}

export async function countE2EUserByUsername(username: string): Promise<number> {
    if (!username.startsWith(E2E_USER_PREFIX)) {
        throw new Error("E2E safety guard: refusing to inspect a non-E2E username")
    }
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => direct.user.count({ where: { username } }))
}

export async function getE2EAccessFixtures() {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => {
        const own = await direct.transaction.findUniqueOrThrow({
            where: { transactionCode: `${E2E_ACCESS_PREFIX}OWN-TX` },
            select: { id: true, unit: { select: { id: true, investorId: true } } },
        })
        const other = await direct.transaction.findUniqueOrThrow({
            where: { transactionCode: `${E2E_ACCESS_PREFIX}OTHER-TX` },
            select: { id: true, unit: { select: { investorId: true } } },
        })
        return {
            ownInvestorId: own.unit.investorId,
            ownUnitId: own.unit.id,
            ownTransactionId: own.id,
            otherInvestorId: other.unit.investorId,
            otherTransactionId: other.id,
        }
    })
}

export async function countE2EAccessFixtures(filter?: { unitCode?: string }): Promise<number> {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => direct.unit.count({
        where: filter?.unitCode ? { code: filter.unitCode } : { code: { startsWith: E2E_ACCESS_PREFIX } },
    }))
}

export async function getE2EAccessMutationState(transactionId: string) {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => {
        const transaction = await direct.transaction.findUniqueOrThrow({
            where: { id: transactionId },
            select: {
                status: true,
                sellPrice: true,
                profitSharing: { select: { id: true } },
                _count: { select: { paymentHistories: true } },
            },
        })
        return {
            status: transaction.status,
            sellPrice: transaction.sellPrice,
            profitSharingId: transaction.profitSharing?.id ?? null,
            paymentCount: transaction._count.paymentHistories,
        }
    })
}

if (process.argv[1]?.endsWith("seed.ts")) {
    seedE2EUsers().catch((error) => {
        console.error(error instanceof Error ? error.message : "E2E seed failed")
        process.exitCode = 1
    })
}
