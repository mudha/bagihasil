import type { PrismaClient } from "@prisma/client"
import { withVerifiedE2EDatabase } from "../src/lib/e2e-database-collector"
import { loadE2EEnvironment } from "./test-env"
import { UNIT_FIXTURE } from "./unit-fixtures"

const E2E_TRANSACTION_CODE_PREFIX = "E2E-TRX-"

export const TRANSACTION_FIXTURE = {
    code: "E2E-TRX-001",
    buyDate: "2026-08-20",
    buyPrice: 50_000_000,
    initialInvestorCapital: 40_000_000,
    initialManagerCapital: 10_000_000,
    notes: "E2E transaksi pembelian dasar",
} as const

type TransactionFixtureClient = Pick<
    PrismaClient,
    | "activityLog"
    | "cost"
    | "investor"
    | "paymentHistory"
    | "profitSharing"
    | "transaction"
    | "transactionProof"
    | "unit"
>

async function transactionIds(direct: TransactionFixtureClient): Promise<string[]> {
    const rows = await direct.transaction.findMany({
        where: { transactionCode: { startsWith: E2E_TRANSACTION_CODE_PREFIX } },
        select: { id: true },
    })
    return rows.map(({ id }) => id)
}

async function cleanupTransactionsWithVerifiedClient(
    direct: TransactionFixtureClient
): Promise<void> {
    const ids = await transactionIds(direct)
    if (ids.length === 0) return

    await direct.paymentHistory.deleteMany({ where: { transactionId: { in: ids } } })
    await direct.profitSharing.deleteMany({ where: { transactionId: { in: ids } } })
    await direct.cost.deleteMany({ where: { transactionId: { in: ids } } })
    await direct.transactionProof.deleteMany({ where: { transactionId: { in: ids } } })
    await direct.activityLog.deleteMany({
        where: { entity: "TRANSACTION", entityId: { in: ids } },
    })
    await direct.transaction.deleteMany({ where: { id: { in: ids } } })
}

async function cleanupAllWithVerifiedClient(direct: TransactionFixtureClient): Promise<void> {
    await cleanupTransactionsWithVerifiedClient(direct)
    await direct.activityLog.deleteMany({
        where: {
            entity: "UNIT",
            details: { contains: UNIT_FIXTURE.code },
        },
    })
    await direct.unit.deleteMany({ where: { code: UNIT_FIXTURE.code } })
    await direct.investor.deleteMany({ where: { name: UNIT_FIXTURE.investorName } })
}

export async function cleanupE2ETransactionFixtures(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupAllWithVerifiedClient(direct)
    })
}

export async function seedE2ETransactionFixtures(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupAllWithVerifiedClient(direct)
        const investor = await direct.investor.create({
            data: {
                name: UNIT_FIXTURE.investorName,
                marginPercentage: 50,
                isActive: true,
            },
        })
        await direct.unit.create({
            data: {
                investorId: investor.id,
                code: UNIT_FIXTURE.code,
                name: UNIT_FIXTURE.expectedName,
                plateNumber: UNIT_FIXTURE.plateNumber,
                status: "AVAILABLE",
                vehicleType: UNIT_FIXTURE.vehicleType,
                brand: UNIT_FIXTURE.brand,
                model: UNIT_FIXTURE.model,
                type: UNIT_FIXTURE.type,
                year: UNIT_FIXTURE.year,
                color: UNIT_FIXTURE.color,
                kilometer: UNIT_FIXTURE.kilometer,
            },
        })
    })
}

export async function getE2ETransactionByCode(code: string) {
    if (!code.startsWith(E2E_TRANSACTION_CODE_PREFIX)) {
        throw new Error("E2E safety guard: refusing to inspect a non-E2E transaction code")
    }
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => direct.transaction.findUnique({
        where: { transactionCode: code },
        include: {
            unit: { include: { investor: true } },
            costs: true,
            profitSharing: true,
            paymentHistories: true,
            proofs: true,
        },
    }))
}

export async function countE2ETransactionFixtures(): Promise<number> {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => {
        const ids = await transactionIds(direct)
        const [transactions, payments, shares, costs, proofs, logs] = await Promise.all([
            direct.transaction.count({
                where: { transactionCode: { startsWith: E2E_TRANSACTION_CODE_PREFIX } },
            }),
            direct.paymentHistory.count({ where: { transactionId: { in: ids } } }),
            direct.profitSharing.count({ where: { transactionId: { in: ids } } }),
            direct.cost.count({ where: { transactionId: { in: ids } } }),
            direct.transactionProof.count({ where: { transactionId: { in: ids } } }),
            direct.activityLog.count({
                where: { entity: "TRANSACTION", entityId: { in: ids } },
            }),
        ])
        return transactions + payments + shares + costs + proofs + logs
    })
}
