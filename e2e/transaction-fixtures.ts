import type { PrismaClient } from "@prisma/client"
import { withVerifiedE2EDatabase } from "../src/lib/e2e-database-collector"
import { loadE2EEnvironment } from "./test-env"
import { UNIT_FIXTURE } from "./unit-fixtures"

const E2E_TRANSACTION_CODE_PREFIX = "E2E-TRX-"
const FINAL_INVESTOR_NAME = "E2E Investor Finalization Flow"
const PAYMENT_INVESTOR_NAME = "E2E Investor Payment Flow"

export const TRANSACTION_FIXTURE = {
    code: "E2E-TRX-001",
    buyDate: "2026-08-20",
    buyPrice: 50_000_000,
    initialInvestorCapital: 40_000_000,
    initialManagerCapital: 10_000_000,
    notes: "E2E transaksi pembelian dasar",
} as const

export const FINALIZATION_FIXTURE = {
    code: "E2E-TRX-FINAL-001",
    buyDate: "2026-08-20",
    sellDate: "2026-08-21",
    buyPrice: 50_000_000,
    sellPrice: 70_000_000,
    initialInvestorCapital: 40_000_000,
    initialManagerCapital: 10_000_000,
    investorSharePercentage: 40,
    managerSharePercentage: 60,
    notes: "E2E finalisasi profit tanpa pembayaran",
    unitCode: "E2E-UNIT-FINAL-001",
} as const

export const PAYMENT_FIXTURE = {
    code: "E2E-TRX-PAY-001",
    unitCode: "E2E-UNIT-PAY-001",
    buyDate: "2026-08-20",
    sellDate: "2026-08-21",
    buyPrice: 50_000_000,
    sellPrice: 70_000_000,
    investorProfitAmount: 8_000_000,
    firstPayment: 3_000_000,
    secondPayment: 5_000_000,
    paymentDate: "2026-08-22",
    firstNotes: "E2E pembayaran tahap pertama",
    secondNotes: "E2E pembayaran pelunasan",
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
            OR: [
                { details: { contains: UNIT_FIXTURE.code } },
                { details: { contains: FINALIZATION_FIXTURE.unitCode } },
                { details: { contains: PAYMENT_FIXTURE.unitCode } },
            ],
        },
    })
    await direct.unit.deleteMany({ where: { code: { in: [UNIT_FIXTURE.code, FINALIZATION_FIXTURE.unitCode, PAYMENT_FIXTURE.unitCode] } } })
    await direct.investor.deleteMany({ where: { name: { in: [UNIT_FIXTURE.investorName, FINAL_INVESTOR_NAME, PAYMENT_INVESTOR_NAME] } } })
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

export async function seedE2EFinalizationFixture(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupAllWithVerifiedClient(direct)
        const investor = await direct.investor.create({
            data: { name: FINAL_INVESTOR_NAME, marginPercentage: 50, isActive: true },
        })
        const unit = await direct.unit.create({
            data: {
                investorId: investor.id,
                code: FINALIZATION_FIXTURE.unitCode,
                name: "Yamaha XMAX Finalization 2025",
                plateNumber: "B 9002 E2E",
                status: "AVAILABLE",
                vehicleType: "Motor",
                brand: "Yamaha",
                model: "XMAX",
                type: "Connected",
                year: "2025",
                color: "Hitam",
                kilometer: 2000,
            },
        })
        await direct.transaction.create({
            data: {
                unitId: unit.id,
                transactionCode: FINALIZATION_FIXTURE.code,
                buyDate: new Date(`${FINALIZATION_FIXTURE.buyDate}T00:00:00.000Z`),
                buyPrice: FINALIZATION_FIXTURE.buyPrice,
                initialInvestorCapital: FINALIZATION_FIXTURE.initialInvestorCapital,
                initialManagerCapital: FINALIZATION_FIXTURE.initialManagerCapital,
                status: "ON_PROCESS",
                paymentStatus: "UNPAID",
            },
        })
    })
}

export async function seedE2EPaymentFixture(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupAllWithVerifiedClient(direct)
        const investor = await direct.investor.create({
            data: { name: PAYMENT_INVESTOR_NAME, marginPercentage: 50, isActive: true },
        })
        const unit = await direct.unit.create({
            data: {
                investorId: investor.id,
                code: PAYMENT_FIXTURE.unitCode,
                name: "Yamaha XMAX Payment 2025",
                plateNumber: "B 9003 E2E",
                status: "SOLD",
                vehicleType: "Motor",
                brand: "Yamaha",
                model: "XMAX",
                type: "Connected",
                year: "2025",
                color: "Hitam",
                kilometer: 2000,
            },
        })
        const transaction = await direct.transaction.create({
            data: {
                unitId: unit.id,
                transactionCode: PAYMENT_FIXTURE.code,
                buyDate: new Date(`${PAYMENT_FIXTURE.buyDate}T00:00:00.000Z`),
                buyPrice: PAYMENT_FIXTURE.buyPrice,
                initialInvestorCapital: 40_000_000,
                initialManagerCapital: 10_000_000,
                sellDate: new Date(`${PAYMENT_FIXTURE.sellDate}T00:00:00.000Z`),
                sellPrice: PAYMENT_FIXTURE.sellPrice,
                status: "COMPLETED",
                profitStatus: "PROFIT",
                paymentStatus: "UNPAID",
            },
        })
        await direct.profitSharing.create({
            data: {
                transactionId: transaction.id,
                totalCapitalInvestor: 40_000_000,
                totalCapitalManager: 10_000_000,
                totalCapital: 50_000_000,
                netMargin: 20_000_000,
                investorSharePercentage: 40,
                managerSharePercentage: 60,
                investorProfitAmount: PAYMENT_FIXTURE.investorProfitAmount,
                managerProfitAmount: 12_000_000,
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

export async function countE2EFinalizationFixtures(): Promise<number> {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => {
        const [units, investors, unitLogs] = await Promise.all([
            direct.unit.count({ where: { code: FINALIZATION_FIXTURE.unitCode } }),
            direct.investor.count({ where: { name: FINAL_INVESTOR_NAME } }),
            direct.activityLog.count({
                where: {
                    entity: "UNIT",
                    details: { contains: FINALIZATION_FIXTURE.unitCode },
                },
            }),
        ])
        return units + investors + unitLogs
    })
}

export async function countE2EPaymentFixtures(): Promise<number> {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => {
        const [units, investors, unitLogs] = await Promise.all([
            direct.unit.count({ where: { code: PAYMENT_FIXTURE.unitCode } }),
            direct.investor.count({ where: { name: PAYMENT_INVESTOR_NAME } }),
            direct.activityLog.count({
                where: {
                    entity: "UNIT",
                    details: { contains: PAYMENT_FIXTURE.unitCode },
                },
            }),
        ])
        return units + investors + unitLogs
    })
}
