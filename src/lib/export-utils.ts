import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

interface InvestorReportData {
    investor: {
        id: string
        name: string
        contactInfo: string
        bankAccountDetails: string
        notes: string
    }
    summary: {
        totalActiveUnits: number
        totalCompletedTransactions: number
        totalCapitalDeployed: number
        totalProfit: number
    }
    transactions: Array<{
        id: string
        transactionCode: string
        unitName: string
        unitPlateNumber: string
        buyDate: string
        sellDate: string | null
        buyPrice: number
        sellPrice: number
        initialInvestorCapital: number
        initialManagerCapital: number
        totalCosts: number
        investorCosts: number
        managerCosts: number
        netMargin: number
        investorProfitAmount: number
        managerProfitAmount: number
        paymentStatus: string
        totalPaid: number
        costs?: Array<{
            costType: string
            payer: string
            amount: number
            description?: string
        }>
        paymentHistories?: Array<{
            id: string
            amount: number
            paymentDate: string
            method: string
            proofImageUrl?: string | null
            notes?: string | null
        }>
    }>
    generatedAt: string
    monthlyProfit?: Array<{
        year: number
        month: number
        amount: number
        label: string
    }>
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(value)
}

// Helper function to convert image URL to base64 with compression
async function convertImageToBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'Anonymous'
        img.onload = () => {
            // Target dimensions
            const maxWidth = 800
            let width = img.width
            let height = img.height

            // Calculate new dimensions if image is larger than maxWidth
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width)
                width = maxWidth
            }

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Could not get canvas context'))
                return
            }

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height)

            // Return compressed JPEG
            resolve(canvas.toDataURL('image/jpeg', 0.5))
        }
        img.onerror = (error) => reject(error)
        img.src = url
    })
}

import * as XLSX from 'xlsx'

export async function exportInvestorReportXLSX(investorId: string, investorName: string) {
    try {
        const response = await fetch(`/api/reports/investor/${investorId}`)

        if (!response.ok) {
            throw new Error('Gagal mengambil data laporan')
        }

        const data: InvestorReportData = await response.json()

        // Prepare data for Excel
        // 1. Investor Info Sheet
        const infoData = [
            ['INFORMASI PEMODAL'],
            ['Nama', data.investor.name],
            ['Kontak', data.investor.contactInfo],
            ['Rekening', data.investor.bankAccountDetails],
            [],
            ['RINGKASAN'],
            ['Total Unit Aktif', data.summary.totalActiveUnits],
            ['Total Transaksi Selesai', data.summary.totalCompletedTransactions],
            ['Total Modal Tertanam', data.summary.totalCapitalDeployed],
            ['Total Profit', data.summary.totalProfit],
            [],
            ['Tanggal Laporan', format(new Date(), 'dd MMMM yyyy HH:mm')]
        ]

        // 2. Transactions Sheet
        const txHeaders = [
            'Kode Transaksi',
            'Unit',
            'Plat Nomor',
            'Tanggal Beli',
            'Tanggal Laku',
            'Harga Beli',
            'Harga Laku',
            'Modal Pemodal',
            'Biaya Pemodal',
            'Biaya Pengelola',
            'Total Biaya',
            'Margin Bersih',
            'Profit Pemodal',
            'Status Pembayaran'
        ]

        const txRows = data.transactions.map(tx => [
            tx.transactionCode,
            tx.unitName,
            tx.unitPlateNumber,
            format(new Date(tx.buyDate), 'dd/MM/yyyy'),
            tx.sellDate ? format(new Date(tx.sellDate), 'dd/MM/yyyy') : '-',
            tx.buyPrice,
            tx.sellPrice || '-',
            tx.initialInvestorCapital,
            tx.investorCosts,
            tx.managerCosts,
            tx.totalCosts,
            tx.netMargin || '-',
            tx.investorProfitAmount || '-',
            tx.paymentStatus
        ])

        // Create Workbook
        const wb = XLSX.utils.book_new()

        // Add Sheets
        const wsInfo = XLSX.utils.aoa_to_sheet(infoData)
        const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows])

        XLSX.utils.book_append_sheet(wb, wsInfo, "Ringkasan")
        XLSX.utils.book_append_sheet(wb, wsTx, "Data Transaksi")

        // Format Cells (Basic Number Formats) if possible
        // Note: Basic XLSX write doesn't support extensive styling in community version easily
        // But we can set column widths
        wsTx['!cols'] = [
            { wch: 15 }, // Kode
            { wch: 20 }, // Unit
            { wch: 12 }, // Plat
            { wch: 12 }, // Tgl Beli
            { wch: 12 }, // Tgl Jual
            { wch: 15 }, // Harga Beli
            { wch: 15 }, // Harga Jual
            { wch: 15 }, // Modal
            { wch: 12 }, // Biaya Inv
            { wch: 12 }, // Biaya Mgr
            { wch: 15 }, // Total Biaya
            { wch: 15 }, // Margin
            { wch: 15 }, // Profit
            { wch: 15 }  // Status
        ]

        // Export
        const fileName = `Laporan_${investorName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
        XLSX.writeFile(wb, fileName)

        return { success: true }
    } catch (error) {
        console.error('Error exporting XLSX:', error)
        return { success: false, error: 'Gagal mengekspor laporan Excel' }
    }
}

const drawBarChart = (doc: jsPDF, data: { label: string, amount: number }[], x: number, y: number, w: number, h: number, title: string) => {
    // 1. Draw Container & Title
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(title, x, y - 5)

    doc.setDrawColor(200, 200, 200)
    doc.rect(x, y, w, h)

    if (data.length === 0) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('Tidak ada data profit.', x + w / 2, y + h / 2, { align: 'center' })
        return
    }

    const padding = 10
    const chartW = w - (padding * 2)
    const chartH = h - (padding * 2)
    const chartX = x + padding
    const chartY = y + padding

    // 2. Determine Scale
    const maxVal = Math.max(...data.map(d => d.amount), 1000000) // Min max 1jt to avoid scale issues
    const scaleY = chartH / maxVal

    // 3. Draw Bars
    const barW = (chartW / data.length) * 0.6
    const gap = (chartW / data.length) * 0.4

    data.forEach((d, i) => {
        const barH = d.amount * scaleY
        const bx = chartX + (i * (barW + gap)) + (gap / 2)
        const by = chartY + chartH - barH

        // Bar
        doc.setFillColor(66, 139, 202) // Blue
        doc.rect(bx, by, barW, barH, 'F')

        // Value Label (formatted K/M)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(50, 50, 50)

        let valStr = ''
        if (d.amount >= 1000000) valStr = (d.amount / 1000000).toFixed(1) + 'Jt'
        else if (d.amount >= 1000) valStr = (d.amount / 1000).toFixed(0) + 'Rb'
        else valStr = d.amount.toString()

        doc.text(valStr, bx + barW / 2, by - 2, { align: 'center' })

        // X Label (Month)
        doc.text(d.label.split(' ')[0], bx + barW / 2, chartY + chartH + 4, { align: 'center' })
    })

    // 4. Axis Line
    doc.setDrawColor(150, 150, 150)
    doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH)
}

export async function exportInvestorReportPDF(investorId: string, investorName: string) {
    try {
        const response = await fetch(`/api/reports/investor/${investorId}`)

        if (!response.ok) {
            throw new Error('Gagal menghasilkan laporan PDF')
        }

        const data: InvestorReportData = await response.json()

        // Create PDF document
        const doc = new jsPDF()

        // Set font
        doc.setFont('helvetica')

        // Title
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('LAPORAN PEMODAL', 14, 20)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Tanggal Laporan: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 27)

        let yPosition = 35

        // Investor Information Section
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('INFORMASI PEMODAL', 14, yPosition)
        yPosition += 7

        autoTable(doc, {
            startY: yPosition,
            head: [['Nama', 'Kontak', 'Rekening']],
            body: [[
                data.investor.name,
                data.investor.contactInfo,
                data.investor.bankAccountDetails
            ]],
            theme: 'grid',
            headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 50 },
                2: { cellWidth: 80 }
            }
        })

        yPosition = (doc as any).lastAutoTable.finalY + 10

        // Summary Section
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('RINGKASAN', 14, yPosition)
        yPosition += 7

        autoTable(doc, {
            startY: yPosition,
            head: [['Metrik', 'Nilai']],
            body: [
                ['Total Unit Aktif', data.summary.totalActiveUnits.toString()],
                ['Total Transaksi Selesai', data.summary.totalCompletedTransactions.toString()],
                ['Total Modal Tertanam', formatCurrency(data.summary.totalCapitalDeployed)],
                ['Total Profit', formatCurrency(data.summary.totalProfit)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 90, halign: 'right' }
            }
        })

        yPosition = (doc as any).lastAutoTable.finalY + 10

        // Monthly Profit Chart
        if (data.monthlyProfit && data.monthlyProfit.length > 0) {
            // Check page break
            if (yPosition + 70 > doc.internal.pageSize.getHeight() - 10) {
                doc.addPage()
                yPosition = 20
            }

            drawBarChart(doc, data.monthlyProfit, 14, yPosition, 180, 60, 'GRAFIK PROFIT BULANAN')
            yPosition += 75
        }

        // Transactions Section
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('DETAIL TRANSAKSI', 14, yPosition)
        yPosition += 7

        if (data.transactions.length > 0) {
            const transactionRows = data.transactions.map(tx => [
                tx.transactionCode,
                tx.unitName,
                format(new Date(tx.buyDate), 'dd/MM/yy'),
                tx.sellDate ? format(new Date(tx.sellDate), 'dd/MM/yy') : '-',
                formatCurrency(tx.buyPrice),
                formatCurrency(tx.sellPrice),
                formatCurrency(tx.initialInvestorCapital),
                formatCurrency(tx.netMargin),
                formatCurrency(tx.investorProfitAmount),
                tx.paymentStatus
            ])

            autoTable(doc, {
                startY: yPosition,
                head: [[
                    'Kode',
                    'Unit',
                    'Tgl Beli',
                    'Tgl Jual',
                    'Harga Beli',
                    'Harga Jual',
                    'Modal',
                    'Margin',
                    'Profit',
                    'Status'
                ]],
                body: transactionRows,
                theme: 'striped',
                headStyles: {
                    fillColor: [66, 139, 202],
                    fontSize: 7,
                    halign: 'center'
                },
                bodyStyles: { fontSize: 6 },
                columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 16 },
                    4: { cellWidth: 22, halign: 'right' },
                    5: { cellWidth: 22, halign: 'right' },
                    6: { cellWidth: 22, halign: 'right' },
                    7: { cellWidth: 20, halign: 'right' },
                    8: { cellWidth: 20, halign: 'right' },
                    9: { cellWidth: 14, halign: 'center' }
                },
                margin: { left: 14, right: 14 }
            })
        } else {
            doc.setFontSize(9)
            doc.setFont('helvetica', 'italic')
            doc.text('Belum ada transaksi yang selesai.', 14, yPosition)
        }

        // Footer
        const pageCount = doc.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'italic')
            doc.text(
                `Halaman ${i} dari ${pageCount}`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            )
        }

        // Save PDF with proper filename using blob and anchor
        const fileName = `Laporan_${investorName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`

        // Create blob from PDF
        const pdfBlob = doc.output('blob')

        // Create download link
        const url = window.URL.createObjectURL(pdfBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        // Trigger download
        document.body.appendChild(link)
        link.click()

        // Cleanup after a delay to ensure download starts
        setTimeout(() => {
            window.URL.revokeObjectURL(url)
            document.body.removeChild(link)
        }, 100)

        return { success: true }
    } catch (error) {
        console.error('Error exporting PDF:', error)
        return { success: false, error: 'Gagal mengekspor laporan PDF' }
    }
}

// Mobile-friendly transaction report PDF with embedded proof images - Premium Design

// Mobile-friendly transaction report PDF with embedded proof images - Premium Design
export async function exportTransactionReportPDF(transactionId: string, transactionCode: string) {
    try {
        const response = await fetch(`/api/reports/transaction/${transactionId}`)

        if (!response.ok) {
            throw new Error('Gagal menghasilkan laporan transaksi PDF')
        }

        const data: any = await response.json()

        // Colors Palette
        const COLORS = {
            primary: [30, 64, 175] as [number, number, number], // dark blue #1e40af
            secondary: [243, 244, 246] as [number, number, number], // light gray #f3f4f6
            textMain: [31, 41, 55] as [number, number, number], // gray-800
            textLight: [107, 114, 128] as [number, number, number], // gray-500
            white: [255, 255, 255] as [number, number, number],
            border: [229, 231, 235] as [number, number, number], // gray-200
            success: [22, 163, 74] as [number, number, number], // green-600
            warning: [202, 138, 4] as [number, number, number], // yellow-600
            error: [220, 38, 38] as [number, number, number] // red-600
        }

        // Create PDF document - Portrait for mobile viewing
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        })

        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        const margin = 15
        const contentWidth = pageWidth - (margin * 2)
        let yPos = 0

        // Helper function to check if we need a new page
        const checkNewPage = (requiredSpace: number) => {
            if (yPos + requiredSpace > pageHeight - margin) {
                doc.addPage()
                yPos = margin
                return true
            }
            return false
        }

        const drawSectionHeader = (title: string, y: number) => {
            doc.setFillColor(...(COLORS.secondary as [number, number, number]))
            doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F')

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(...(COLORS.primary as [number, number, number]))
            doc.text(title.toUpperCase(), margin + 3, y + 5.5)

            return y + 14
        }

        // ===== 1. HERO HEADER (Modern Minimalist) =====
        // White background, colored accent, clean typography

        // 1. Accent Bar on top
        doc.setFillColor(...(COLORS.primary as [number, number, number]))
        doc.rect(0, 0, pageWidth, 6, 'F') // Top strip

        // 2. Title
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(24)
        doc.setTextColor(...(COLORS.primary as [number, number, number]))
        doc.text('LAPORAN BAGI HASIL', margin, 25)

        // 3. Status Badge (Right aligned next to title)
        const statusTxt = data.transaction.status === 'COMPLETED' ? 'SELESAI' : data.transaction.status
        doc.setFontSize(10)
        doc.setTextColor(...(COLORS.success as [number, number, number])) // Use green for status
        doc.text(statusTxt, pageWidth - margin, 25, { align: 'right' })

        // 4. Sub-info row (ID and Date)
        doc.setDrawColor(...(COLORS.border as [number, number, number]))
        doc.setLineWidth(0.5)
        doc.line(margin, 32, pageWidth - margin, 32) // Separator line

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...(COLORS.textLight as [number, number, number]))

        // Left: Transaction ID
        doc.text(`Transaction ID:`, margin, 38)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...(COLORS.textMain as [number, number, number]))
        doc.text(data.transaction.transactionCode, margin + 25, 38)

        // Right: Generated Date
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...(COLORS.textLight as [number, number, number]))
        const dateStr = format(new Date(), 'd MMMM yyyy, HH:mm')
        doc.text(dateStr, pageWidth - margin, 38, { align: 'right' })

        yPos = 50

        // ===== 2. BASIC INFORMATION & HERO IMAGE =====
        // NEW LAYOUT: [LEFT (60%): Unit Info + Details] [RIGHT (40%): Hero Image]

        const leftColWidth = contentWidth * 0.60
        const imgWidth = contentWidth * 0.40
        const imgHeightMax = 50

        // A. UNIT INFO (LEFT)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.setTextColor(...(COLORS.primary as [number, number, number]))

        const unitNameLines = doc.splitTextToSize(data.unit.name, leftColWidth - 5)
        doc.text(unitNameLines, margin, yPos)

        let currentLeftY = yPos + (unitNameLines.length * 7)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(...(COLORS.textLight as [number, number, number]))
        doc.text(data.unit.plateNumber, margin, currentLeftY)
        currentLeftY += 12

        // B. TRANSACTION DETAILS (LEFT - below Unit Info)
        // Using reportData.capital if available, else fallback
        const investorCap = data.capital?.investorCapital ?? 0
        const managerCap = data.capital?.managerCapital ?? 0

        const detailItems = [
            { label: 'Pemodal', value: data.investor.name },
            { label: 'Modal Pemodal', value: formatCurrency(investorCap) },
            { label: 'Modal Pengelola', value: formatCurrency(managerCap) },
            { label: 'Tgl Beli', value: format(new Date(data.transaction.buyDate), 'dd MMM yyyy') },
            // { label: 'Tanggal Laku', value: data.transaction.sellDate ? format(new Date(data.transaction.sellDate), 'dd MMM yyyy') : '-' }
            { label: 'Tanggal Laku', value: data.transaction.sellDate ? format(new Date(data.transaction.sellDate), 'dd MMM yyyy') : '-' }
        ]

        detailItems.forEach(item => {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            doc.setTextColor(...(COLORS.textLight as [number, number, number]))
            doc.text(item.label, margin, currentLeftY)

            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...(COLORS.textMain as [number, number, number]))
            doc.text(item.value, margin + 40, currentLeftY)

            currentLeftY += 5
        })

        // C. UNIT IMAGE (RIGHT - Hero Style)
        const imgY = yPos - 5
        let imgActualHeight = 0
        if (data.unit.imageUrl) {
            try {
                const imageUrl = data.unit.imageUrl.startsWith('http')
                    ? data.unit.imageUrl
                    : `${window.location.origin}${data.unit.imageUrl}`

                const base64 = await convertImageToBase64(imageUrl)
                const imgProps = doc.getImageProperties(base64)
                const aspect = imgProps.height / imgProps.width

                let renderW = imgWidth
                let renderH = renderW * aspect

                if (renderH > imgHeightMax) {
                    renderH = imgHeightMax
                    renderW = renderH / aspect
                }

                const imgX = pageWidth - margin - renderW

                // Draw clean gray border
                doc.setDrawColor(220, 220, 220)
                doc.setLineWidth(0.1)
                doc.rect(imgX, imgY, renderW, renderH)

                doc.addImage(base64, 'JPEG', imgX, imgY, renderW, renderH)
                imgActualHeight = renderH
            } catch (e) {
                console.error("Failed to render unit image", e)
            }
        }

        // Determine max height of this section
        yPos = Math.max(currentLeftY, imgY + imgActualHeight + 5)



        yPos += 10
        doc.setDrawColor(...(COLORS.border as [number, number, number]))
        doc.setLineWidth(0.5)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10

        // ===== 3. OPERATIONAL COSTS =====
        if (data.costs.items && data.costs.items.length > 0) {
            yPos = drawSectionHeader('Rincian Biaya Operasional', yPos)

            const costsData = data.costs.items.map((cost: any) => [
                cost.costType,
                cost.description,
                cost.payer === 'INVESTOR' ? 'Pemodal' : 'Pengelola',
                formatCurrency(cost.amount)
            ])

            autoTable(doc, {
                startY: yPos,
                head: [['JENIS', 'KETERANGAN', 'DIBAYAR', 'NOMINAL']],
                body: costsData,
                theme: 'plain',
                headStyles: {
                    fillColor: COLORS.white,
                    textColor: COLORS.textLight,
                    fontSize: 7,
                    fontStyle: 'bold',
                    lineWidth: 0
                },
                bodyStyles: {
                    fontSize: 8,
                    textColor: COLORS.textMain,
                    cellPadding: 3,
                    valign: 'middle'
                },
                columnStyles: {
                    0: { cellWidth: 35, fontStyle: 'bold' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 25, halign: 'center' },
                    3: { cellWidth: 35, halign: 'right' }
                },
                styles: {
                    lineColor: COLORS.border,
                    lineWidth: 0.1,
                    minCellHeight: 8
                },
                margin: { left: margin, right: margin }
            })

            yPos = (doc as any).lastAutoTable.finalY + 15
        }

        // ===== 4. FINANCIAL SUMMARY & PROFIT SHARE =====
        checkNewPage(80)

        yPos = drawSectionHeader('Ringkasan Keuangan & Bagi Hasil', yPos)

        const leftColX = margin
        const colWidth = (contentWidth / 2) - 3
        const rightColX = margin + colWidth + 6

        // Draw containers
        const boxHeight = 42

        // LEFT BOX (Values)
        doc.setDrawColor(...(COLORS.border as [number, number, number]))
        doc.setLineWidth(0.3)
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(leftColX, yPos, colWidth, boxHeight, 1, 1, 'S')

        let localY = yPos + 6
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...(COLORS.primary as [number, number, number]))
        doc.text('TRANSAKSI', leftColX + 4, localY)
        localY += 8

        const drawRow = (label: string, val: string, y: number, x: number, w: number, isTotal: boolean = false) => {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            doc.setTextColor(...(COLORS.textLight as [number, number, number]))
            doc.text(label, x + 4, y)

            doc.setFont('helvetica', isTotal ? 'bold' : 'normal')
            doc.setTextColor(...(isTotal ? COLORS.success : COLORS.textMain))
            doc.text(val, x + w - 4, y, { align: 'right' })
        }

        const buyPrice = data.transaction.buyPrice || 0
        const sellPrice = data.transaction.sellPrice || 0
        const totalCosts = data.costs.totalCosts || 0

        drawRow('Harga Beli', formatCurrency(buyPrice), localY, leftColX, colWidth)
        localY += 6
        drawRow('Harga Jual', formatCurrency(sellPrice), localY, leftColX, colWidth)
        localY += 6
        drawRow('Total Biaya', formatCurrency(totalCosts), localY, leftColX, colWidth)
        localY += 8

        // Line
        doc.setDrawColor(...(COLORS.border as [number, number, number]))
        doc.line(leftColX + 4, localY - 3, leftColX + colWidth - 4, localY - 3)

        // FIX: Net Margin -> Nett Margin
        const netMargin = data.profitSharing?.netMargin ?? 0
        drawRow('Nett Margin', formatCurrency(netMargin), localY, leftColX, colWidth, true)


        // RIGHT BOX (Shares)
        doc.setDrawColor(...(COLORS.border as [number, number, number]))
        doc.roundedRect(rightColX, yPos, colWidth, boxHeight, 1, 1, 'S')

        localY = yPos + 6
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...(COLORS.primary as [number, number, number]))
        doc.text('PEMBAGIAN LABA', rightColX + 4, localY)
        localY += 8

        const investorShare = data.profitSharing?.investorSharePercentage ?? 0
        const managerShare = data.profitSharing?.managerSharePercentage ?? 0
        const investorProfit = data.profitSharing?.investorProfitAmount ?? 0
        const managerProfit = data.profitSharing?.managerProfitAmount ?? 0

        drawRow(`Pemodal (${investorShare}%)`, formatCurrency(investorProfit), localY, rightColX, colWidth)
        localY += 6
        drawRow(`Pengelola (${managerShare}%)`, formatCurrency(managerProfit), localY, rightColX, colWidth)
        localY += 10

        // Green Box for Investor Total
        doc.setFillColor(240, 253, 244) // green-50
        doc.setDrawColor(22, 163, 74) // green-600
        doc.roundedRect(rightColX + 3, localY - 5, colWidth - 6, 15, 1, 1, 'FD')

        doc.setFontSize(7)
        doc.setTextColor(22, 163, 74)
        doc.text('TOTAL TERIMA PEMODAL', rightColX + 6, localY)

        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(formatCurrency(data.payment.investorShouldReceive), rightColX + colWidth - 6, localY + 5, { align: 'right' })

        yPos += boxHeight + 15

        // ===== 5. PAYMENT STATUS CARD =====
        checkNewPage(30) // lowered require space
        // FIX: Status Pembayaran -> Status Pembayaran Bagi Hasil
        yPos = drawSectionHeader('Status Pembayaran Bagi Hasil', yPos)

        const status = data.payment.paymentStatus
        let statusColor = COLORS.textLight
        let statusBg = COLORS.secondary
        if (status === 'PAID') { statusColor = COLORS.success; statusBg = [220, 252, 231] as [number, number, number] }
        else if (status === 'PARTIAL') { statusColor = COLORS.warning; statusBg = [254, 249, 195] as [number, number, number] }
        else { statusColor = COLORS.error; statusBg = [254, 226, 226] as [number, number, number] }

        // Reduced box height to 20 (was 30)
        const boxH = 20
        doc.setFillColor(...(statusBg as [number, number, number]))
        doc.setDrawColor(...(statusBg as [number, number, number]))
        doc.roundedRect(margin, yPos, contentWidth, boxH, 1, 1, 'F')

        const cardY = yPos

        doc.setFontSize(9) // Smaller font
        doc.setTextColor(...(statusColor as [number, number, number]))
        doc.setFont('helvetica', 'bold')
        doc.text(`STATUS: ${status}`, margin + 5, cardY + 7)

        // Progress Bar (compact)
        const total = data.payment.investorShouldReceive
        const paid = data.payment.totalPaid
        const percentage = total > 0 ? Math.min((paid / total) * 100, 100) : 0

        const barWidth = contentWidth - 10
        const barHeight = 2
        const barY = cardY + 9

        // Background Bar
        doc.setFillColor(229, 231, 235)
        doc.rect(margin + 5, barY, barWidth, barHeight, 'F')

        // Fill Bar
        if (percentage > 0) {
            doc.setFillColor(...(statusColor as [number, number, number]))
            doc.rect(margin + 5, barY, (barWidth * percentage) / 100, barHeight, 'F')
        }

        // Paid Amount / Remaining
        const txtY = cardY + 16
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8) // reduced font
        doc.setTextColor(...(COLORS.textMain as [number, number, number]))

        doc.text(`Telah Dibayar: ${formatCurrency(paid)}`, margin + 5, txtY)
        doc.text(`Sisa: ${formatCurrency(data.payment.remaining)}`, pageWidth - margin - 5, txtY, { align: 'right' })

        // Adjusted spacing for compact box (boxH is 20, plus padding)
        yPos += 30

        // ===== 6. PAYMENT HISTORY TIMELINE - REMOVED AS REQUESTED =====
        if (false && data.payment.histories && data.payment.histories.length > 0) {
            doc.addPage()
            yPos = margin

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(14)
            doc.setTextColor(...(COLORS.primary as [number, number, number]))
            doc.text('Riwayat Pembayaran & Bukti', margin, yPos + 5)
            yPos += 15

            for (const payment of data.payment.histories) {
                checkNewPage(25) // reduced check since no image here

                // Dot
                doc.setFillColor(...(COLORS.primary as [number, number, number]))
                doc.circle(margin + 2, yPos + 4, 1.5, 'F')

                // Date & Amount
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(10)
                doc.setTextColor(...(COLORS.textMain as [number, number, number]))
                doc.text(format(new Date(payment.paymentDate), 'dd MMM yyyy, HH:mm'), margin + 10, yPos + 5)

                doc.setFontSize(11)
                doc.setTextColor(...(COLORS.success as [number, number, number]))
                doc.text(formatCurrency(payment.amount), pageWidth - margin, yPos + 5, { align: 'right' })

                yPos += 10

                // Details
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(9)
                doc.setTextColor(...(COLORS.textLight as [number, number, number]))
                doc.text(`Metode: ${payment.method}`, margin + 10, yPos)
                yPos += 5

                if (payment.notes && payment.notes !== '-') {
                    const noteLines = doc.splitTextToSize(`Catatan: ${payment.notes}`, contentWidth - 15)
                    doc.text(noteLines, margin + 10, yPos)
                    yPos += (noteLines.length * 5)
                }

                // IMAGE REMOVED FROM HERE - MOVED TO ATTACHMENTS
                yPos += 5
            }
        }

        // ===== 7. LAMPIRAN - LAMPIRAN (ATTACHMENTS) =====
        const attachments: { title: string, description?: string, imageUrl: string }[] = []

        // Helper to add attachment
        const addAttachment = (title: string, desc: string | null | undefined, url: string) => {
            if (url) {
                attachments.push({
                    title,
                    description: desc || undefined,
                    imageUrl: url
                })
            }
        }

        // 1. Buy Proofs (Priority 1)
        if (data.transaction.buyProofImageUrl) { // Legacy
            addAttachment('Bukti Pembelian Unit ke Seller', data.transaction.buyProofDescription, data.transaction.buyProofImageUrl)
        }
        if (data.transaction.proofs && data.transaction.proofs.length > 0) {
            data.transaction.proofs
                .filter((p: any) => p.proofType === 'BUY')
                .forEach((p: any) => {
                    addAttachment('Bukti Pembelian Unit ke Seller', p.description, p.imageUrl)
                })
        }

        // 2. Cost Proofs (Priority 2)
        if (data.costs.items) {
            data.costs.items.forEach((cost: any) => {
                if (cost.proofs && cost.proofs.length > 0) {
                    cost.proofs.forEach((proof: any) => {
                        addAttachment(`Bukti Biaya: ${cost.costType} (${cost.description || '-'})`, proof.description, proof.imageUrl)
                    })
                }
            })
        }

        // 3. Sell Proofs (Priority 3)
        if (data.transaction.sellProofImageUrl) { // Legacy
            addAttachment('Bukti Pelunasan Unit dari Buyer', data.transaction.sellProofDescription, data.transaction.sellProofImageUrl)
        }
        if (data.transaction.proofs && data.transaction.proofs.length > 0) {
            data.transaction.proofs
                .filter((p: any) => p.proofType === 'SELL')
                .forEach((p: any) => {
                    addAttachment('Bukti Pelunasan Unit dari Buyer', p.description, p.imageUrl)
                })
        }

        // 4. Payment Proofs (Priority 4 - Transfer Bagi Hasil)
        if (data.payment.histories && data.payment.histories.length > 0) {
            data.payment.histories.forEach((ph: any) => {
                if (ph.proofImageUrl) {
                    addAttachment(`Bukti Transfer Bagi Hasil`, `Tanggal: ${format(new Date(ph.paymentDate), 'dd MMM yyyy, HH:mm')} - ${formatCurrency(ph.amount)}`, ph.proofImageUrl)
                }
            })
        }

        if (attachments.length > 0) {
            doc.addPage()
            yPos = margin

            // Header for Attachments Page
            doc.setFillColor(...(COLORS.primary as [number, number, number]))
            doc.rect(0, 0, pageWidth, 6, 'F') // Top strip

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(16)
            doc.setTextColor(...(COLORS.primary as [number, number, number]))
            doc.text('LAMPIRAN - LAMPIRAN', margin, 25)

            yPos = 35

            const colGap = 10
            const colWidth = (contentWidth - colGap) / 2

            // Process attachments in pairs for grid layout
            for (let i = 0; i < attachments.length; i += 2) {
                const item1 = attachments[i]
                const item2 = attachments[i + 1] // might be undefined

                // Helper to calculate height and prepare render data
                const prepareItem = async (item: typeof item1) => {
                    if (!item) return null

                    // PADDING
                    const padding = 5
                    let innerY = padding
                    let h = 0

                    // Title Height
                    innerY += 6 // font size 9 approx (Bold)

                    // Image Height
                    let imgData = null
                    try {
                        const imageUrl = item.imageUrl.startsWith('http')
                            ? item.imageUrl
                            : `${window.location.origin}${item.imageUrl}`

                        const base64 = await convertImageToBase64(imageUrl)
                        const imgProps = doc.getImageProperties(base64)
                        const aspect = imgProps.height / imgProps.width

                        // Calculate dimensions maintaining aspect ratio for portrait images
                        // Adjusted to 0.3 to ensure 2 rows fit comfortably 
                        const maxImgHeight = pageHeight * 0.3
                        const maxImgWidth = colWidth - (padding * 2)

                        let imgW = maxImgWidth
                        let imgH = imgW * aspect

                        // If height exceeds max, scale down by height instead
                        if (imgH > maxImgHeight) {
                            imgH = maxImgHeight
                            imgW = imgH / aspect
                        }

                        // For portrait images, limit width to 70% to prevent stretching
                        if (aspect > 1.2) { // Portrait orientation
                            const maxPortraitWidth = maxImgWidth * 0.7
                            if (imgW > maxPortraitWidth) {
                                imgW = maxPortraitWidth
                                imgH = imgW * aspect
                                if (imgH > maxImgHeight) {
                                    imgH = maxImgHeight
                                    imgW = imgH / aspect
                                }
                            }
                        }

                        imgData = { base64, w: imgW, h: imgH, y: innerY }
                        innerY += imgH + 3 // reduced space between img and desc
                    } catch (e) {
                        console.error("Error processing image:", e)
                    }

                    // Desc Height
                    let descLines: string[] = []
                    if (item.description) {
                        doc.setFontSize(9)
                        // effective width for text
                        const txtW = colWidth - (padding * 2)
                        descLines = doc.splitTextToSize(item.description, txtW)
                        // store y pos
                        // innerY is updated
                    }

                    // Calculate total height needed
                    // header + image + spacing + desc + padding
                    h = innerY + (descLines.length > 0 ? (descLines.length * 4) : 0) + padding

                    return { h, descLines, imgData, item, padding }
                }

                const d1 = await prepareItem(item1)
                const d2 = await prepareItem(item2)

                if (!d1) continue

                const h1 = d1.h
                const h2 = d2 ? d2.h : 0
                const rowHeight = Math.max(h1, h2)

                // Check page break
                if (yPos + rowHeight + 10 > pageHeight - margin) {
                    doc.addPage()
                    yPos = margin
                }

                // Render Item
                const renderItem = (d: any, x: number) => {
                    // Draw Border
                    doc.setDrawColor(...(COLORS.border as [number, number, number]))
                    doc.setLineWidth(0.3)
                    doc.roundedRect(x, yPos, colWidth, rowHeight, 2, 2, 'S')

                    let localY = yPos + d.padding

                    // Title
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(9)
                    doc.setTextColor(...(COLORS.primary as [number, number, number]))
                    // Clip title if too long?
                    const titleLines = doc.splitTextToSize(d.item.title, colWidth - (d.padding * 2))
                    doc.text(titleLines, x + d.padding, localY + 3)

                    // Image uses fixed y offset from preparation to avoid overlap if title wraps?
                    // actually better to flow it. 
                    // Let's recalculate flow for safety or use the layout from prepare.
                    // If title wrapped, we might need more space?
                    // Simplifying: Title is usually 1 line. If 2 lines, simpler logic might overlap.
                    // For now assume title fits or pushes.
                    // Let's rely on flow here:
                    localY += (titleLines.length * 5) + 2

                    // Image
                    if (d.imgData) {
                        try {
                            // Center image horizontally within the border
                            const imgX = x + (colWidth - d.imgData.w) / 2
                            doc.addImage(d.imgData.base64, 'JPEG', imgX, localY, d.imgData.w, d.imgData.h)
                            localY += d.imgData.h + 3
                        } catch (e) { }
                    }

                    // Description
                    if (d.descLines.length > 0) {
                        doc.setFont('helvetica', 'italic')
                        doc.setFontSize(9)
                        doc.setTextColor(...(COLORS.textMain as [number, number, number]))
                        // Center text: x is start of box. Center is x + (colWidth/2).
                        doc.text(d.descLines, x + (colWidth / 2), localY + 3, { align: 'center' })
                    }
                }

                renderItem(d1, margin)
                if (d2) {
                    renderItem(d2, margin + colWidth + colGap)
                }

                yPos += rowHeight + 5 // Reduced Space between rows
            }
        }

        // ===== FOOTER =====
        const pageCount = doc.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(...(COLORS.textLight as [number, number, number]))
            doc.text(
                `Halaman ${i} dari ${pageCount} | ${transactionCode} | Digenerate oleh Sistem by Armudha Abu Zain`,
                pageWidth / 2,
                pageHeight - 8,
                { align: 'center' }
            )
        }

        // Save PDF
        const fileName = `LAPORAN BAGI HASIL - ${transactionCode}.pdf`
        const pdfBlob = doc.output('blob')
        const url = window.URL.createObjectURL(pdfBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()

        setTimeout(() => {
            window.URL.revokeObjectURL(url)
            document.body.removeChild(link)
        }, 100)

        return { success: true }
    } catch (error) {
        console.error('Error exporting transaction PDF:', error)
        return { success: false, error: 'Gagal mengekspor laporan transaksi PDF' }
    }
}
