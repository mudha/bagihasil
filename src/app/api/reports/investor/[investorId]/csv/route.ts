import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { canAccessInvestor, forbidden, requireAuth } from '@/lib/api-auth'
import { computeInvestorReportSummary } from '../../../../../../lib/investor-report-summary'
import { legacyInvestorCsvReportSelect } from '../../../../../../lib/legacy-read-selects'

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

function csvTextCell(value: unknown, fallback = ''): string {
    if (value === null || value === undefined || value === '') return csvCell(fallback)
    const text = String(value)
    const safeText = /^[=+\-@\t\r\n＝＋－＠]/.test(text) ? `'${text}` : text
    return csvCell(safeText)
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
            select: legacyInvestorCsvReportSelect,
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
        const completedTransactions = allTransactions.filter((tx: any) => tx.status === 'COMPLETED')

        const summary = computeInvestorReportSummary(investor.units)

        const formatCurrency = (value: number) => {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0
            }).format(value)
        }

        // Generate CSV content
        let csv = `Laporan Pemodal: ${csvTextCell(investor.name)}\n`
        csv += `Tanggal Laporan: ${format(new Date(), 'dd MMM yyyy HH:mm')}\n\n`

        csv += `=== INFORMASI PEMODAL ===\n`
        csv += `Nama,Kontak,Rekening,Catatan\n`
        csv += `${csvTextCell(investor.name)},${csvTextCell(investor.contactInfo, '-')},${csvTextCell(investor.bankAccountDetails, '-')},${csvTextCell(investor.notes, '-')}\n\n`

        csv += `=== RINGKASAN ===\n`
        csv += `Metrik,Nilai\n`
        csv += `Total Unit Aktif,${csvCell(summary.activeUnitsCount)}\n`
        csv += `Total Transaksi Selesai,${csvCell(summary.totalCompletedTransactions)}\n`
        csv += `Total Modal Tertanam,${csvCell(formatCurrency(summary.totalCapitalDeployed))}\n`
        csv += `Total Profit,${csvCell(formatCurrency(summary.totalProfit))}\n\n`

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

            csv += `${csvTextCell(tx.transactionCode)},`
            csv += `${csvTextCell(tx.unitName)},`
            csv += `${csvTextCell(tx.unitPlateNumber)},`
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
            csv += `${csvTextCell(tx.paymentStatus)},`
            csv += `${csvCell(formatCurrency(totalPaid))}\n`
        })

        const fileName = `Laporan_${investor.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`

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
