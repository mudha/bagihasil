import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ investorId: string }> }
) {
    try {
        const { investorId } = await params

        // Fetch investor details
        const investor = await prisma.investor.findUnique({
            where: { id: investorId },
            include: {
                units: {
                    include: {
                        transactions: {
                            where: {
                                status: 'COMPLETED'
                            },
                            include: {
                                costs: true,
                                profitSharing: true,
                                paymentHistories: true
                            },
                            orderBy: {
                                sellDate: 'desc'
                            }
                        }
                    }
                }
            }
        })

        if (!investor) {
            return NextResponse.json(
                { error: 'Investor tidak ditemukan' },
                { status: 404 }
            )
        }

        // Aggregate transactions
        const allTransactions = investor.units.flatMap((unit: any) =>
            unit.transactions.map((tx: any) => ({
                ...tx,
                unitName: unit.name,
                unitPlateNumber: unit.plateNumber
            }))
        )

        // Calculate summary
        const totalCompletedTransactions = allTransactions.length
        const totalProfit = allTransactions.reduce(
            (sum: number, tx: any) => sum + (tx.profitSharing?.investorProfitAmount || 0),
            0
        )
        const totalCapitalDeployed = investor.units.reduce((sum: number, unit: any) => {
            const activeTransactions = unit.transactions.filter(
                (tx: any) => tx.status === 'ON_PROCESS'
            )
            return sum + activeTransactions.reduce(
                (txSum: number, tx: any) => txSum + (tx.initialInvestorCapital || tx.buyPrice),
                0
            )
        }, 0)

        const activeUnitsCount = investor.units.filter((unit: any) =>
            unit.status === 'AVAILABLE' || unit.transactions.some((tx: any) => tx.status === 'ON_PROCESS')
        ).length

        const formatCurrency = (value: number) => {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(value)
        }

        // Generate CSV content
        let csv = `Laporan Pemodal: ${investor.name}\\n`
        csv += `Tanggal Laporan: ${format(new Date(), 'dd MMM yyyy HH:mm')}\\n\\n`

        csv += `=== INFORMASI PEMODAL ===\\n`
        csv += `Nama,Kontak,Rekening,Catatan\\n`
        csv += `"${investor.name}","${investor.contactInfo || '-'}","${investor.bankAccountDetails || '-'}","${investor.notes || '-'}"\\n\\n`

        csv += `=== RINGKASAN ===\\n`
        csv += `Metrik,Nilai\\n`
        csv += `Total Unit Aktif,${activeUnitsCount}\\n`
        csv += `Total Transaksi Selesai,${totalCompletedTransactions}\\n`
        csv += `Total Modal Tertanam,${formatCurrency(totalCapitalDeployed)}\\n`
        csv += `Total Profit,${formatCurrency(totalProfit)}\\n\\n`

        csv += `=== DETAIL TRANSAKSI ===\\n`
        csv += `Kode,Unit,Plat Nomor,Tanggal Beli,Tanggal Jual,Harga Beli,Harga Jual,Modal Investor,Modal Manager,Total Biaya,Biaya Investor,Biaya Manager,Margin Bersih,Profit Investor,Profit Manager,Status Bayar,Total Terbayar\\n`

        allTransactions.forEach((tx: any) => {
            const totalCosts = tx.costs.reduce((sum: number, cost: any) => sum + cost.amount, 0)
            const investorCosts = tx.costs
                .filter((cost: any) => cost.payer === 'INVESTOR')
                .reduce((sum: number, cost: any) => sum + cost.amount, 0)
            const managerCosts = tx.costs
                .filter((cost: any) => cost.payer === 'MANAGER')
                .reduce((sum: number, cost: any) => sum + cost.amount, 0)
            const totalPaid = tx.paymentHistories.reduce((sum: number, ph: any) => sum + ph.amount, 0)

            csv += `"${tx.transactionCode}",`
            csv += `"${tx.unitName}",`
            csv += `"${tx.unitPlateNumber}",`
            csv += `"${format(new Date(tx.buyDate), 'dd MMM yyyy')}",`
            csv += `"${tx.sellDate ? format(new Date(tx.sellDate), 'dd MMM yyyy') : '-'}",`
            csv += `"${formatCurrency(tx.buyPrice)}",`
            csv += `"${formatCurrency(tx.sellPrice || 0)}",`
            csv += `"${formatCurrency(tx.initialInvestorCapital || tx.buyPrice)}",`
            csv += `"${formatCurrency(tx.initialManagerCapital || 0)}",`
            csv += `"${formatCurrency(totalCosts)}",`
            csv += `"${formatCurrency(investorCosts)}",`
            csv += `"${formatCurrency(managerCosts)}",`
            csv += `"${formatCurrency(tx.profitSharing?.netMargin || 0)}",`
            csv += `"${formatCurrency(tx.profitSharing?.investorProfitAmount || 0)}",`
            csv += `"${formatCurrency(tx.profitSharing?.managerProfitAmount || 0)}",`
            csv += `"${tx.paymentStatus}",`
            csv += `"${formatCurrency(totalPaid)}"\\n`
        })

        // Return CSV file
        const fileName = `Laporan_${investor.name.replace(/\\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        })
    } catch (error) {
        console.error('Error generating CSV report:', error)
        return NextResponse.json(
            { error: 'Gagal menghasilkan laporan CSV' },
            { status: 500 }
        )
    }
}
