import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ transactionId: string }> }
) {
    try {
        const { transactionId } = await params

        // Fetch transaction details with all related data
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                unit: {
                    include: {
                        investor: true
                    }
                },
                costs: {
                    include: {
                        proofs: true
                    },
                    orderBy: {
                        date: 'asc'
                    }
                },
                profitSharing: true,
                paymentHistories: {
                    orderBy: {
                        paymentDate: 'asc'
                    }
                },
                proofs: true
            }
        }) as any

        if (!transaction) {
            return NextResponse.json(
                { error: 'Transaksi tidak ditemukan' },
                { status: 404 }
            )
        }

        if (transaction.status !== 'COMPLETED') {
            return NextResponse.json(
                { error: 'Laporan hanya tersedia untuk transaksi yang sudah selesai' },
                { status: 400 }
            )
        }

        // Calculate costs breakdown
        const investorCosts = transaction.costs
            .filter((cost: any) => cost.payer === 'INVESTOR')
            .reduce((sum: number, cost: any) => sum + cost.amount, 0)

        const managerCosts = transaction.costs
            .filter((cost: any) => cost.payer === 'MANAGER')
            .reduce((sum: number, cost: any) => sum + cost.amount, 0)

        const totalCosts = investorCosts + managerCosts

        // Calculate capital
        const investorCapital = transaction.initialInvestorCapital || transaction.buyPrice
        const managerCapital = transaction.initialManagerCapital || 0
        const totalCapital = investorCapital + managerCapital
        // Calculate payment info
        const totalPaid = transaction.paymentHistories.reduce(
            (sum: number, ph: any) => sum + ph.amount,
            0
        )

        // Calculate what investor should receive
        // FIX: For "Laporan Bagi Hasil", user wants to track purely the Profit Share payout status.
        // We exclude capital/costs from this specific check so checking "Sisa 0" means "Profit Fully Paid".
        const investorShouldReceive = transaction.profitSharing?.investorProfitAmount || 0
        const remaining = investorShouldReceive - totalPaid

        // Determine status based on calculation - FIX FOR USER REQUEST
        let calculatedStatus = transaction.paymentStatus
        if (remaining <= 100) { // Tolerance for small rounding differences implies PAID
            calculatedStatus = 'PAID'
        } else if (totalPaid > 0) {
            calculatedStatus = 'PARTIAL'
        }

        // Calculate duration
        let duration = 0
        if (transaction.sellDate && transaction.buyDate) {
            const buyDate = new Date(transaction.buyDate)
            const sellDate = new Date(transaction.sellDate)
            duration = Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Prepare report data
        const reportData = {
            transaction: {
                id: transaction.id,
                transactionCode: transaction.transactionCode,
                buyDate: transaction.buyDate,
                sellDate: transaction.sellDate,
                buyPrice: transaction.buyPrice,
                sellPrice: transaction.sellPrice || 0,
                status: transaction.status,
                paymentStatus: calculatedStatus,
                duration,
                buyProofImageUrl: transaction.buyProofImageUrl,
                buyProofDescription: transaction.buyProofDescription,
                sellProofImageUrl: transaction.sellProofImageUrl,
                sellProofDescription: transaction.sellProofDescription,
                proofs: transaction.proofs
            },
            unit: {
                name: transaction.unit.name,
                plateNumber: transaction.unit.plateNumber,
                code: transaction.unit.code,
                imageUrl: transaction.unit.imageUrl
            },
            investor: {
                name: transaction.unit.investor.name,
                contactInfo: transaction.unit.investor.contactInfo || '-',
                bankAccountDetails: transaction.unit.investor.bankAccountDetails || '-'
            },
            capital: {
                investorCapital,
                managerCapital,
                totalCapital
            },
            costs: {
                items: transaction.costs.map((cost: any) => ({
                    costType: cost.costType,
                    payer: cost.payer,
                    amount: cost.amount,
                    description: cost.description || '-',
                    date: cost.date,
                    proofs: cost.proofs
                })),
                investorCosts,
                managerCosts,
                totalCosts
            },
            profitSharing: transaction.profitSharing ? {
                netMargin: transaction.profitSharing.netMargin,
                investorSharePercentage: transaction.profitSharing.investorSharePercentage,
                managerSharePercentage: transaction.profitSharing.managerSharePercentage,
                investorProfitAmount: transaction.profitSharing.investorProfitAmount,
                managerProfitAmount: transaction.profitSharing.managerProfitAmount
            } : null,
            payment: {
                investorShouldReceive,
                totalPaid,
                remaining,
                paymentStatus: calculatedStatus,
                histories: transaction.paymentHistories.map((ph: any) => ({
                    paymentDate: ph.paymentDate,
                    amount: ph.amount,
                    method: ph.method,
                    notes: ph.notes || '-',
                    proofImageUrl: ph.proofImageUrl
                }))
            },
            generatedAt: new Date().toISOString()
        }

        return NextResponse.json(reportData)
    } catch (error) {
        console.error('Error generating transaction report:', error)
        return NextResponse.json(
            { error: 'Gagal menghasilkan laporan transaksi' },
            { status: 500 }
        )
    }
}
