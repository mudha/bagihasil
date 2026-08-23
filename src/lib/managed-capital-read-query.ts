import { prisma } from "@/lib/prisma"
import { buildManagedCapitalSummary, type ManagedCapitalSummary } from "./managed-capital-read-model"

const investorSummarySelect = {
    id: true,
    managedCapitalBalance: true,
    managedCapitalBalanceUpdatedAt: true,
    units: {
        select: {
            id: true,
            transactions: {
                where: { status: "ON_PROCESS" },
                select: {
                    status: true,
                    buyPrice: true,
                    initialInvestorCapital: true,
                },
            },
        },
    },
} as const

type InvestorSummaryRecord = Parameters<typeof buildManagedCapitalSummary>[0]

export async function getManagedCapitalSummaries(): Promise<ManagedCapitalSummary[]> {
    const investors = await prisma.investor.findMany({
        orderBy: { createdAt: "desc" },
        select: investorSummarySelect,
    })

    return investors.map(investor => buildManagedCapitalSummary(investor as InvestorSummaryRecord))
}

export async function getManagedCapitalSummary(investorId: string): Promise<ManagedCapitalSummary | null> {
    const investor = await prisma.investor.findUnique({
        where: { id: investorId },
        select: investorSummarySelect,
    })

    return investor ? buildManagedCapitalSummary(investor as InvestorSummaryRecord) : null
}
