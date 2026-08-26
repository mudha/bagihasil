import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { canAccessInvestor, forbidden, requireAuth } from '@/lib/api-auth'
import { computeInvestorReportSummary } from '../../../../../lib/investor-report-summary'

const privateHeaders = { 'Cache-Control': 'private, no-store' }
const privateResponse = (response: Response) => {
    response.headers.set('Cache-Control', privateHeaders['Cache-Control'])
    return response
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ investorId: string }> }
) {
    const authResult = await requireAuth()
    if ("response" in authResult) return privateResponse(authResult.response!)

    try {
        const { investorId } = await params

        if (!(await canAccessInvestor(authResult.session, investorId))) {
            return privateResponse(forbidden())
        }

        const investor = await prisma.investor.findUnique({
            where: { id: investorId },
            include: {
                units: {
                    include: {
                        transactions: {
                            include: {
                                costs: true,
                                profitSharing: true,
                                paymentHistories: true
                            },
                            orderBy: {
                                buyDate: 'desc'
                            }
                        }
                    }
                }
            }
        })

        if (!investor) {
            return NextResponse.json(
                { error: 'Investor tidak ditemukan' },
                { status: 404, headers: privateHeaders }
            )
        }

        const allTransactions = investor.units.flatMap((unit: any) =>
            unit.transactions.map((tx: any) => ({
                ...tx,
                unitName: unit.name,
                unitPlateNumber: unit.plateNumber
            }))
        )

        const summary = computeInvestorReportSummary(investor.units)

        const monthlyProfitMap = new Map<string, number>()

        allTransactions.forEach((tx: any) => {
            if (tx.status === 'COMPLETED' && tx.profitSharing?.investorProfitAmount) {
                const date = tx.sellDate ? new Date(tx.sellDate) : (tx.buyDate ? new Date(tx.buyDate) : new Date())
                const key = format(date, 'yyyy-MM')
                const current = monthlyProfitMap.get(key) || 0
                monthlyProfitMap.set(key, current + tx.profitSharing.investorProfitAmount)
            }
        })

        const monthlyProfit = Array.from(monthlyProfitMap.entries())
            .map(([key, value]) => {
                const [year, month] = key.split('-').map(Number)
                return {
                    year,
                    month,
                    amount: value,
                    label: format(new Date(year, month - 1), 'MMM yyyy')
                }
            })
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year
                return a.month - b.month
            })

        const reportData = {
            investor: {
                id: investor.id,
                name: investor.name,
                contactInfo: investor.contactInfo || '-',
                bankAccountDetails: investor.bankAccountDetails || '-',
                notes: investor.notes || '-'
            },
            summary: {
                totalActiveUnits: summary.activeUnitsCount,
                totalCompletedTransactions: summary.totalCompletedTransactions,
                totalCapitalDeployed: summary.totalCapitalDeployed,
                totalProfit: summary.totalProfit
            },
            monthlyProfit,
            transactions: allTransactions.map((tx: any) => ({
                id: tx.id,
                transactionCode: tx.transactionCode,
                unitName: tx.unitName,
                unitPlateNumber: tx.unitPlateNumber,
                buyDate: tx.buyDate,
                sellDate: tx.sellDate,
                buyPrice: tx.buyPrice,
                sellPrice: tx.sellPrice || 0,
                initialInvestorCapital: tx.initialInvestorCapital || tx.buyPrice,
                initialManagerCapital: tx.initialManagerCapital || 0,
                totalCosts: tx.costs.reduce((sum: number, cost: any) => sum + cost.amount, 0),
                investorCosts: tx.costs
                    .filter((cost: any) => cost.payer === 'INVESTOR')
                    .reduce((sum: number, cost: any) => sum + cost.amount, 0),
                managerCosts: tx.costs
                    .filter((cost: any) => cost.payer === 'MANAGER')
                    .reduce((sum: number, cost: any) => sum + cost.amount, 0),
                netMargin: tx.profitSharing?.netMargin || 0,
                investorProfitAmount: tx.profitSharing?.investorProfitAmount || 0,
                managerProfitAmount: tx.profitSharing?.managerProfitAmount || 0,
                paymentStatus: tx.paymentStatus,
                totalPaid: tx.paymentHistories.reduce((sum: number, ph: any) => sum + ph.amount, 0),
                costs: tx.costs.map((cost: any) => ({
                    costType: cost.costType,
                    payer: cost.payer,
                    amount: cost.amount,
                    description: cost.description
                })),
                paymentHistories: tx.paymentHistories.map((ph: any) => ({
                    id: ph.id,
                    amount: ph.amount,
                    paymentDate: ph.paymentDate,
                    method: ph.method,
                    proofImageUrl: ph.proofImageUrl,
                    notes: ph.notes
                }))
            })),
            generatedAt: new Date().toISOString()
        }

        return NextResponse.json(reportData, { headers: privateHeaders })
    } catch (error) {
        console.error('Error generating investor report:', error)
        return NextResponse.json(
            { error: 'Gagal menghasilkan laporan' },
            { status: 500, headers: privateHeaders }
        )
    }
}
