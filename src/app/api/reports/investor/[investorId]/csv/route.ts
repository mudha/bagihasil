import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { canAccessInvestor, forbidden, requireAuth } from '@/lib/api-auth'

const privateHeaders = { 'Cache-Control': 'private, no-store' }
const privateResponse = (response: Response) => {
    response.headers.set('Cache-Control', privateHeaders['Cache-Control'])
    return response
}

function csvCell(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value)
    if (/[\u000d\u0022\u002c\u000a]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`
    }
    return text
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

        // Fetch investor details
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
                { status: 404, headers: privateHeaders }
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
        const completedTransactions = allTransactions.filter((tx: any) => tx.status === 'COMPLETED')
        const activeTransactions = allTransactions.filter((tx: any) => tx.status === 'ON_PROCESS')

        // Calculate summary
        const totalCompletedTransactions = completedTransactions.length
        const totalProfit = completedTransactions.reduce(
            (sum: number, tx: any) => sum + (tx.profitSharing?.investorProfitAmount || 0),
            0
        )
        const totalCapitalDeployed = activeTransactions.reduce(
            (sum: number, tx: any) => sum + (tx.initialInvestorCapital ?? tx.buyPrice),
            0
        )

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
        let csv = `Laporan Pemodal: ${csvCell(investor.name)}\n`
        csv += `Tanggal Laporan: ${format(new Date(), 'dd MMM yyyy HH:mm')}\n\n`

        csv += `=== INFORMASI PEMODAL ===\n`
        csv += `Nama,Kontak,Rekening,Catatan\n`
        csv += `${csvCell(investor.name)},${csvCell(investor.contactInfo || '-')},${csvCell(investor.bankAccountDetails || '-')},${csvCell(investor.notes || '-')}\n\n`

        csv += `=== RINGKASAN ===\n`
        csv += `Metrik,Nilai\n`
        csv += `Total Unit Aktif,${csvCell(activeUnitsCount)}\n`
        csv += `Total Transaksi Selesai,${csvCell(totalCompletedTransactions)}\n`
        csv += `Total Modal Tertanam,${csvCell(formatCurrency(totalCapitalDeployed))}\n`
        csv += `Total Profit,${csvCell(formatCurrency(totalProfit))}\n\n`

        csv += `=== DETAIL TRANSAKSI ===\n`
        csv += `Kode,Unit,Plat Nomor,Tanggal Beli,Tanggal Jual,Harga Beli,Harga Jual,Modal Investor,Modal Manager,Total Biaya,Biaya Investor,Biaya Manager,Margin Bersih,Profit Investor,Profit Manager,Status Bayar,Total Terbayar\n`

        completedTransactions.forEach((tx: any) => {
            const totalCosts = tx.costs.reduce((sum: number, cost: any) => sum + cost.amount, 0)
            const investorCosts = tx.costs
                .filter((cost: any) => cost.payer === 'INVESTOR')
                .reduce((sum: number, cost: any) => sum + cost.amount, 0)
            const managerCosts = tx.costs
                .filter((cost: any) => cost.payer === 'MANAGER')
                .reduce((sum: number, cost: any) => sum + cost.amount, 0)
            const totalPaid = tx.paymentHistories.reduce((sum: number, ph: any) => sum + ph.amount, 0)

            csv += `${csvCell(tx.transactionCode)},`
            csv += `${csvCell(tx.unitName)},`
            csv += `${csvCell(tx.unitPlateNumber)},`
            csv += `${csvCell(format(new Date(tx.buyDate), 'dd MMM yyyy'))},`
            csv += `${csvCell(tx.sellDate ? format(new Date(tx.sellDate), 'dd MMM yyyy') : '-')},`
            csv += `${csvCell(formatCurrency(tx.buyPrice))},`
            csv += `${csvCell(formatCurrency(tx.sellPrice || 0))},`
            csv += `${csvCell(formatCurrency(tx.initialInvestorCapital ?? tx.buyPrice))},`
            csv += `${csvCell(formatCurrency(tx.initialManagerCapital ?? 0))},`
            csv += `${csvCell(formatCurrency(totalCosts))},`
            csv += `${csvCell(formatCurrency(investorCosts))},`
            csv += `${csvCell(formatCurrency(managerCosts))},`
            csv += `${csvCell(formatCurrency(tx.profitSharing?.netMargin || 0))},`
            csv += `${csvCell(formatCurrency(tx.profitSharing?.investorProfitAmount || 0))},`
            csv += `${csvCell(formatCurrency(tx.profitSharing?.managerProfitAmount || 0))},`
            csv += `${csvCell(tx.paymentStatus)},`
            csv += `${csvCell(formatCurrency(totalPaid))}\n`
        })

        // Return CSV file
        const fileName = `Laporan_${csvCell(investor.name).replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`

        return new NextResponse(csv, {
            headers: {
                ...privateHeaders,
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        })
    } catch (error) {
        console.error('Error generating CSV report:', error)
        return NextResponse.json(
            { error: 'Gagal menghasilkan laporan CSV' },
            { status: 500, headers: privateHeaders }
        )
    }
}
