import type { PrismaClient } from "@prisma/client"
import { withVerifiedE2EDatabase } from "../src/lib/e2e-database-collector"
import { loadE2EEnvironment } from "./test-env"

export const UNIT_FIXTURE = {
    investorName: "E2E Investor Unit Flow",
    code: "E2E-UNIT-001",
    plateNumber: "B 9001 E2E",
    vehicleType: "Motor",
    brand: "Yamaha",
    model: "XMAX",
    type: "Connected",
    year: "2025",
    color: "Hitam",
    kilometer: 1234,
    expectedName: "Yamaha XMAX Connected 2025 warna Hitam",
} as const

type FinancialFixtureClient = Pick<PrismaClient, "activityLog" | "unit" | "investor">

async function cleanupWithVerifiedClient(direct: FinancialFixtureClient): Promise<void> {
    await direct.activityLog.deleteMany({
        where: {
            entity: "UNIT",
            details: { contains: UNIT_FIXTURE.code },
        },
    })
    await direct.unit.deleteMany({
        where: { code: UNIT_FIXTURE.code },
    })
    await direct.investor.deleteMany({
        where: { name: UNIT_FIXTURE.investorName },
    })
}

async function createInvestorWithVerifiedClient(direct: FinancialFixtureClient): Promise<void> {
    await direct.investor.create({
        data: {
            name: UNIT_FIXTURE.investorName,
            marginPercentage: 50,
            isActive: true,
        },
    })
}

async function countWithVerifiedClient(direct: FinancialFixtureClient): Promise<number> {
    const [logs, units, investors] = await Promise.all([
        direct.activityLog.count({
            where: {
                entity: "UNIT",
                details: { contains: UNIT_FIXTURE.code },
            },
        }),
        direct.unit.count({ where: { code: UNIT_FIXTURE.code } }),
        direct.investor.count({ where: { name: UNIT_FIXTURE.investorName } }),
    ])
    return logs + units + investors
}

export async function cleanupE2EFinancialFixtures(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupWithVerifiedClient(direct)
    })
}

export async function seedE2EFinancialFixtures(): Promise<void> {
    const env = loadE2EEnvironment()
    await withVerifiedE2EDatabase(env, async ({ direct }) => {
        await cleanupWithVerifiedClient(direct)
        await createInvestorWithVerifiedClient(direct)
    })
}

export async function getE2EUnitByCode(code: string) {
    if (!code.startsWith("E2E-")) {
        throw new Error("E2E safety guard: refusing to inspect a non-E2E unit code")
    }
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => direct.unit.findUnique({
        where: { code },
        include: { investor: true },
    }))
}

export async function countE2EFinancialFixtures(): Promise<number> {
    const env = loadE2EEnvironment()
    return withVerifiedE2EDatabase(env, async ({ direct }) => countWithVerifiedClient(direct))
}
