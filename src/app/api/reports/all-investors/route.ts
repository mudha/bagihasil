import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const investors = await prisma.investor.findMany({
            orderBy: { name: 'asc' },
            include: {
                units: {
                    include: {
                        transactions: {
                            include: {
                                costs: {
                                    orderBy: { date: 'asc' }
                                },
                                profitSharing: true,
                                paymentHistories: {
                                    orderBy: { paymentDate: 'asc' }
                                }
                            },
                            orderBy: { buyDate: 'asc' }
                        }
                    }
                }
            }
        })

        const result = investors.map((investor) => {
            // Flatten all transactions across all units for this investor
            const allTransactions = investor.units.flatMap((unit) =>
                unit.transactions.map((tx) => {
                    const investorCosts = tx.costs
                        .filter((c) => c.payer === 'INVESTOR')
                        .reduce((sum, c) => sum + c.amount, 0)
                    const managerCosts = tx.costs
                        .filter((c) => c.payer === 'MANAGER')
                        .reduce((sum, c) => sum + c.amount, 0)
                    const totalCosts = investorCosts + managerCosts
                    const totalPaid = tx.paymentHistories.reduce((sum, ph) => sum + ph.amount, 0)

                    return {
                        id: tx.id,
                        transactionCode: tx.transactionCode,
                        unitName: unit.name,
                        unitPlateNumber: unit.plateNumber || '-',
                        buyDate: tx.buyDate,
                        sellDate: tx.sellDate,
                        buyPrice: tx.buyPrice,
                        sellPrice: tx.sellPrice || 0,
                        initialInvestorCapital: tx.initialInvestorCapital ?? tx.buyPrice,
                        initialManagerCapital: tx.initialManagerCapital ?? 0,
                        investorCosts,
                        managerCosts,
                        totalCosts,
                        netMargin: tx.profitSharing?.netMargin ?? 0,
                        investorProfitAmount: tx.profitSharing?.investorProfitAmount ?? 0,
                        managerProfitAmount: tx.profitSharing?.managerProfitAmount ?? 0,
                        paymentStatus: tx.paymentStatus,
                        status: tx.status,
                        totalPaid,
                        // All cost line items — detailed
                        costs: tx.costs.map((c) => ({
                            costType: c.costType,
                            description: c.description || '',
                            payer: c.payer,
                            amount: c.amount,
                            date: c.date,
                        })),
                        // Payment history
                        paymentHistories: tx.paymentHistories.map((ph) => ({
                            amount: ph.amount,
                            paymentDate: ph.paymentDate,
                            method: ph.method,
                            notes: ph.notes || '',
                        })),
                    }
                })
            )

            return {
                investor: {
                    id: investor.id,
                    name: investor.name,
                    contactInfo: investor.contactInfo || '-',
                    bankAccountDetails: investor.bankAccountDetails || '-',
                    marginPercentage: investor.marginPercentage,
                    isActive: investor.isActive,
                },
                transactions: allTransactions,
            }
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error fetching all investors report:', error)
        return NextResponse.json(
            { error: 'Gagal mengambil data laporan' },
            { status: 500 }
        )
    }
}
