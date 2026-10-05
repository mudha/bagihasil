import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { mapInvestorReportPayment, PAID_PROFIT_REPORT_HEADER } from './investor-report-payment'
import { getCostTypeLabel } from './cost-types'

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

// ─────────────────────────────────────────────────────────────────────────────
// Resilient image pipeline for the transaction PDF export (fail-closed).
//
// - Every fetch attempt is bounded by a per-attempt timeout built on
//   AbortController (compatible with browsers that lack AbortSignal.timeout).
// - Remote HTTP(S) images get exactly one optimizer attempt first, then at most
//   two direct ImageKit fallback candidates (transformed + original), for a hard
//   ceiling of three network requests per original URL. CDN CORS/network errors
//   are not retried. Non-remote resources keep the bounded attempt setting.
// - Remote HTTP(S) images are fetched through the same-origin Next.js image
//   optimizer first. The original URL is encoded with URLSearchParams so query,
//   fragment, and escaping remain intact; optimizer URLs are never ImageKit-
//   transformed a second time.
// - Only after an optimizer failure do we make one bounded direct-CDN fallback
//   request (or ImageKit rendition + original, still capped at three attempts).
//   Optimizer requests use same-origin credentials; cross-origin CDN requests
//   explicitly omit credentials so application cookies are never sent.
// - A global deadline (REPORT_IMAGE_GLOBAL_DEADLINE_MS) bounds the entire
//   loadAll phase: when it fires, all in-flight requests are aborted and no
//   new URL is started, so the export never hangs indefinitely.
// - Outcomes are structured results ({ ok } / { ok:false, code }) — no silent
//   catch, no partial success.
// ─────────────────────────────────────────────────────────────────────────────

export const REPORT_IMAGE_TIMEOUT_MS = 8_000
export const REPORT_IMAGE_MAX_ATTEMPTS = 3 // 1 initial attempt + max 2 retries
export const REPORT_IMAGE_RETRY_DELAYS_MS: readonly number[] = [500, 1500]
export const REPORT_IMAGE_CONCURRENCY = 3
export const REPORT_IMAGE_GLOBAL_DEADLINE_MS = 90_000

const IMAGEKIT_TRANSFORM_VALUE = 'w-800,q-75'

export type ReportImageErrorCode = 'timeout' | 'network' | 'http' | 'mime' | 'decode'

export interface DecodedReportImage {
    dataUrl: string
    width: number
    height: number
}

export type ReportImageResult =
    | ({ ok: true } & DecodedReportImage)
    | { ok: false; code: ReportImageErrorCode; message: string; httpStatus?: number }

export type ReportImageDecoder = (blob: Blob, timeoutMs: number) => Promise<DecodedReportImage>

export interface ReportImageLoader {
    load(url: string): Promise<ReportImageResult>
    loadAll(urls: string[]): Promise<ReportImageResult[]>
}

export interface ReportImageLoaderOptions {
    fetchImpl?: typeof fetch
    decodeBlob?: ReportImageDecoder
    timeoutMs?: number
    maxAttempts?: number
    retryDelaysMs?: readonly number[]
    sleep?: (ms: number) => Promise<void>
    transformUrl?: (url: string) => string
    globalDeadlineMs?: number
}

export function resolveReportImageUrl(rawUrl: string): string {
    return rawUrl.startsWith('http') ? rawUrl : `${window.location.origin}${rawUrl}`
}

function isImageKitUrl(parsed: URL): boolean {
    if (parsed.hostname === 'ik.imagekit.io' || parsed.hostname.endsWith('.imagekit.io')) {
        return true
    }
    const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
    if (!endpoint) return false
    try {
        return parsed.origin === new URL(endpoint).origin
    } catch {
        return false
    }
}

/**
 * Ask ImageKit for a bounded rendition (max width 800px, reasonable quality)
 * while keeping every existing query parameter byte-for-byte. Non-ImageKit
 * URLs (Cloudinary, legacy, relative, data:) are returned unchanged.
 */
export function transformReportImageUrl(url: string): string {
    if (!/^https?:\/\//i.test(url)) return url
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return url
    }
    if (!isImageKitUrl(parsed)) return url
    if (parsed.searchParams.has('tr')) return url // already transformed — leave it alone
    const hashIndex = url.indexOf('#')
    const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
    const separator = parsed.search ? '&' : '?'
    return `${base}${separator}tr=${IMAGEKIT_TRANSFORM_VALUE}${hash}`
}

function buildNextImageOptimizerUrl(rawUrl: string): string | null {
    if (!/^https?:\/\//i.test(rawUrl)) return null
    try {
        const source = new URL(rawUrl)
        const appOrigin = window.location.origin
        if (source.origin === appOrigin) return null
        const optimizer = new URL('/_next/image', appOrigin)
        optimizer.searchParams.set('url', rawUrl)
        optimizer.searchParams.set('w', '800')
        optimizer.searchParams.set('q', '75')
        return optimizer.toString()
    } catch {
        return null
    }
}

function toErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
        promise.then(
            (value) => {
                clearTimeout(timer)
                resolve(value)
            },
            (error) => {
                clearTimeout(timer)
                reject(error)
            }
        )
    })
}

function loadHtmlImage(src: string, timeoutMs: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const timer = setTimeout(() => {
            img.onload = null
            img.onerror = null
            reject(new Error('Decode gambar melebihi batas waktu'))
        }, timeoutMs)
        img.onload = () => {
            clearTimeout(timer)
            img.onload = null
            img.onerror = null
            resolve(img)
        }
        img.onerror = () => {
            clearTimeout(timer)
            img.onload = null
            img.onerror = null
            reject(new Error('Gambar tidak dapat dibaca'))
        }
        img.src = src
    })
}

/**
 * Default decoder (browser): decode the fetched blob and re-encode it as a
 * compressed JPEG capped at 800px wide — the same visual output this export
 * has always embedded in the PDF. Zero dimensions and decode failures throw,
 * so the loader reports them instead of hiding them.
 */
async function defaultDecodeReportImageBlob(blob: Blob, timeoutMs: number): Promise<DecodedReportImage> {
    const objectUrl = URL.createObjectURL(blob)
    try {
        const img = await loadHtmlImage(objectUrl, timeoutMs)
        const naturalWidth = img.naturalWidth || img.width
        const naturalHeight = img.naturalHeight || img.height
        if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
            throw new Error('Dimensi gambar tidak valid')
        }
        const maxWidth = 800
        let width = naturalWidth
        let height = naturalHeight
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Canvas context tidak tersedia')
        }
        ctx.drawImage(img, 0, 0, width, height)
        return { dataUrl: canvas.toDataURL('image/jpeg', 0.5), width, height }
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export function createReportImageLoader(options: ReportImageLoaderOptions = {}): ReportImageLoader {
    const fetchImpl = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init))
    const decodeBlob = options.decodeBlob ?? defaultDecodeReportImageBlob
    const timeoutMs = options.timeoutMs ?? REPORT_IMAGE_TIMEOUT_MS
    const maxAttempts = Math.max(1, options.maxAttempts ?? REPORT_IMAGE_MAX_ATTEMPTS)
    const retryDelaysMs = options.retryDelaysMs ?? REPORT_IMAGE_RETRY_DELAYS_MS
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
    const transformUrl = options.transformUrl ?? transformReportImageUrl
    const globalDeadlineMs = options.globalDeadlineMs ?? REPORT_IMAGE_GLOBAL_DEADLINE_MS

    type Failure = Extract<ReportImageResult, { ok: false }>
    type Success = Extract<ReportImageResult, { ok: true }>
    type AttemptOutcome = { ok: true; result: Success } | { ok: false; failure: Failure; retryable: boolean }

    const failure = (code: ReportImageErrorCode, message: string, httpStatus?: number): Failure =>
        httpStatus === undefined ? { ok: false, code, message } : { ok: false, code, message, httpStatus }

    const attemptCandidate = async (
        url: string,
        globalSignal?: AbortSignal,
        credentials: RequestCredentials = 'omit',
        redirect: RequestRedirect = 'follow',
        requireImageMime = false
    ): Promise<AttemptOutcome> => {
        if (globalSignal?.aborted) {
            return { ok: false, failure: failure('timeout', 'Batas waktu ekspor terlampaui'), retryable: false }
        }
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        const onGlobalAbort = () => controller.abort()
        globalSignal?.addEventListener('abort', onGlobalAbort)
        try {
            const response = await fetchImpl(url, { signal: controller.signal, credentials, redirect })
            if (!response.ok) {
                // Non-2xx is definitive for this URL: no retry, fallback candidate only.
                return { ok: false, failure: failure('http', `HTTP ${response.status}`, response.status), retryable: false }
            }
            const blob = await response.blob()
            if (requireImageMime ? !blob.type.startsWith('image/') : Boolean(blob.type && !blob.type.startsWith('image/'))) {
                return { ok: false, failure: failure('mime', `Konten bukan gambar (${blob.type || 'tipe tidak diketahui'})`), retryable: false }
            }
            let decoded: DecodedReportImage
            try {
                decoded = await withTimeout(decodeBlob(blob, timeoutMs), timeoutMs, 'Decode gambar melebihi batas waktu')
            } catch (error) {
                return { ok: false, failure: failure('decode', toErrorMessage(error, 'Gagal decode gambar')), retryable: false }
            }
            if (!(decoded.width > 0) || !(decoded.height > 0) || !decoded.dataUrl) {
                return { ok: false, failure: failure('decode', 'Dimensi gambar tidak valid'), retryable: false }
            }
            return { ok: true, result: { ok: true, dataUrl: decoded.dataUrl, width: decoded.width, height: decoded.height } }
        } catch (error) {
            if (controller.signal.aborted) {
                if (globalSignal?.aborted) {
                    return { ok: false, failure: failure('timeout', 'Batas waktu ekspor terlampaui'), retryable: false }
                }
                return { ok: false, failure: failure('timeout', 'Permintaan gambar melebihi batas waktu'), retryable: true }
            }
            return { ok: false, failure: failure('network', toErrorMessage(error, 'Jaringan gagal memuat gambar')), retryable: true }
        } finally {
            clearTimeout(timer)
            globalSignal?.removeEventListener('abort', onGlobalAbort)
        }
    }

    const load = async (url: string, globalSignal?: AbortSignal): Promise<ReportImageResult> => {
        const optimizerUrl = buildNextImageOptimizerUrl(url)
        const transformed = transformUrl(url)
        const directUrls = transformed !== url ? [transformed, url] : [url]
        let last: ReportImageResult = failure('network', 'Gambar tidak dapat dimuat')

        if (optimizerUrl) {
            // Remote HTTP(S): exactly one same-origin optimizer request first,
            // followed only on failure by bounded direct-CDN fallback candidates.
            const optimizerOutcome = await attemptCandidate(optimizerUrl, globalSignal, 'same-origin', 'manual', true)
            if (optimizerOutcome.ok) return optimizerOutcome.result
            last = optimizerOutcome.failure
            if (globalSignal?.aborted) return last

            for (const candidateUrl of directUrls.slice(0, 2)) {
                const outcome = await attemptCandidate(candidateUrl, globalSignal, 'omit')
                if (outcome.ok) return outcome.result
                last = outcome.failure
                if (globalSignal?.aborted) return last
            }
            return last
        }

        // Same-origin, relative, or non-HTTP resources retain bounded retries.
        let attempt = 0
        let candidateIndex = 0
        const candidates = transformed !== url ? [transformed, url] : [url]
        while (attempt < maxAttempts) {
            if (globalSignal?.aborted) break
            if (attempt > 0) {
                const delayIndex = Math.min(attempt - 1, Math.max(retryDelaysMs.length - 1, 0))
                const delay = retryDelaysMs[retryDelaysMs.length === 0 ? -1 : delayIndex] ?? 0
                if (delay > 0) await sleep(delay)
            }
            if (globalSignal?.aborted) break
            const candidateUrl = candidates[Math.min(candidateIndex, candidates.length - 1)]
            attempt++
            const outcome = await attemptCandidate(candidateUrl, globalSignal, 'same-origin')
            if (outcome.ok) return outcome.result
            last = outcome.failure
            if (!outcome.retryable) {
                candidateIndex += 1
                if (candidateIndex >= candidates.length) break
                continue
            }
            if (candidateIndex < candidates.length - 1) candidateIndex += 1
        }
        return last
    }

    const loadAll = async (urls: string[]): Promise<ReportImageResult[]> => {
        const uniqueUrls = Array.from(new Set(urls))
        const results = new Map<string, ReportImageResult>()
        if (uniqueUrls.length === 0) return urls.map((url) => results.get(url) as ReportImageResult)

        const globalController = new AbortController()
        const globalTimer = setTimeout(() => globalController.abort(), globalDeadlineMs)

        let nextIndex = 0
        const workers = Array.from({ length: Math.min(REPORT_IMAGE_CONCURRENCY, uniqueUrls.length) }, async () => {
            while (nextIndex < uniqueUrls.length) {
                if (globalController.signal.aborted) break
                const current = nextIndex
                nextIndex += 1
                const url = uniqueUrls[current]
                results.set(url, await load(url, globalController.signal))
            }
        })

        try {
            await Promise.all(workers)
        } finally {
            clearTimeout(globalTimer)
        }

        // Any URL not started (deadline prevented it) gets a deadline failure.
        for (const url of uniqueUrls) {
            if (!results.has(url)) {
                results.set(url, failure('timeout', 'Batas waktu ekspor terlampaui'))
            }
        }

        return urls.map((url) => results.get(url) as ReportImageResult)
    }

    return { load, loadAll }
}

import ExcelJS from 'exceljs'
export async function exportInvestorReportXLSX(investorId: string, investorName: string) {
    try {
        const response = await fetch(`/api/reports/investor/${investorId}`)

        if (!response.ok) {
            throw new Error('Gagal mengambil data laporan')
        }

        const data: InvestorReportData = await response.json()

        // Create Workbook
        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet('Laporan')

        // Define Columns
        // Adjusted to match user's requested style broadly
        sheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Kode', key: 'code', width: 12 },
            { header: 'Nama Unit', key: 'unit', width: 25 },
            { header: 'No Polisi', key: 'plate', width: 12 },
            { header: 'Tanggal Beli', key: 'buyDate', width: 14 },
            { header: 'Tanggal Jual', key: 'sellDate', width: 14 },
            { header: 'Harga Unit (Rp)', key: 'buyPrice', width: 18 },
            { header: 'Harga Jual (Rp)', key: 'sellPrice', width: 18 },
            // { header: 'Biaya Inspector (Rp)', key: 'costInspector', width: 15 }, // We don't have detailed breakdown easily available here without mapping, keeping aggregate for now
            { header: 'Biaya Pemodal (Rp)', key: 'investorCost', width: 18 },
            { header: 'Biaya Pengelola (Rp)', key: 'managerCost', width: 18 },
            { header: 'Modal dari Pemodal (Rp)', key: 'investorCapital', width: 18 },
            { header: 'Modal dari Pengelola (Rp)', key: 'managerCapital', width: 18 },
            // { header: 'Total Modal (Rp)', key: 'totalCapital', width: 18 },
            { header: 'Margin setelah biaya (Rp)', key: 'netMargin', width: 20 },
            { header: 'Bagi Hasil Pemodal (Rp)', key: 'investorProfit', width: 20 },
            { header: 'Bagi Hasil Pengelola (Rp)', key: 'managerProfit', width: 20 },
            { header: PAID_PROFIT_REPORT_HEADER, key: 'paidProfit', width: 22 },
            { header: 'Status', key: 'status', width: 15 }
        ]

        // Add Header Row Styling (Black BG, Gold Text)
        const headerRow = sheet.getRow(1)
        headerRow.height = 40 // Taller header like screenshot

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF000000' } // Black
            }
            cell.font = {
                bold: true,
                color: { argb: 'FFFFD700' }, // Gold
                size: 10,
                name: 'Calibri'
            }
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            }
        })

        // Sort Data by Transaction Code (Smallest to Largest)
        data.transactions.sort((a, b) => {
            return a.transactionCode.localeCompare(b.transactionCode, undefined, { numeric: true })
        })

        // Add Data
        data.transactions.forEach((tx, index) => {
            const payment = mapInvestorReportPayment(tx)

            const row = sheet.addRow({
                no: index + 1,
                code: tx.transactionCode,
                unit: tx.unitName,
                plate: tx.unitPlateNumber,
                buyDate: format(new Date(tx.buyDate), 'dd/MM/yyyy'),
                sellDate: tx.sellDate ? format(new Date(tx.sellDate), 'dd/MM/yyyy') : '-',
                buyPrice: tx.buyPrice,
                sellPrice: tx.sellPrice || 0,
                investorCost: tx.investorCosts,
                managerCost: tx.managerCosts,
                investorCapital: payment.investorTransactionCapital,
                managerCapital: tx.initialManagerCapital,
                netMargin: tx.netMargin || 0,
                investorProfit: payment.investorProfitAmount,
                managerProfit: tx.managerProfitAmount || 0,
                paidProfit: payment.paidProfitAmount,
                status: tx.paymentStatus
            })

            // Style Data Rows
            row.eachCell((cell, colNumber) => {
                // Currency Formatting for columns > 6
                if (colNumber >= 7 && colNumber <= 17) {
                    cell.numFmt = '#,##0'
                    cell.alignment = { horizontal: 'right' }
                } else {
                    cell.alignment = { horizontal: 'left' }
                }

                // Borders
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            })
        })

        // Generate Blob & Download
        const buffer = await workbook.xlsx.writeBuffer()

        const fileName = `Laporan_${investorName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`

        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()

        setTimeout(() => {
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        }, 100)

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
// Attachments are collected before rendering so every expected image URL can
// be preloaded (and validated) up front — the PDF is never rendered with a
// hole where a proof should be.
interface TransactionReportAttachment {
    title: string
    description?: string
    imageUrl: string
}

function collectTransactionReportAttachments(data: any): TransactionReportAttachment[] {
    const attachments: TransactionReportAttachment[] = []

    // Helper to add attachment
    const addAttachment = (title: string, desc: string | null | undefined, url: string) => {
        if (url) {
            attachments.push({
                title,
                description: desc || undefined,
                imageUrl: resolveReportImageUrl(url)
            })
        }
    }

    // 1. Buy Proofs (Priority 1) - Avoid duplicates between legacy and modern fields
    const buyProofs = data.transaction.proofs?.filter((p: any) => p.proofType === 'BUY') || []

    if (buyProofs.length > 0) {
        // Use modern proofs array if available
        buyProofs.forEach((p: any) => {
            addAttachment('Bukti Pembelian Unit ke Seller', p.description, p.imageUrl)
        })
    } else if (data.transaction.buyProofImageUrl) {
        // Fallback to legacy field only if modern proofs don't exist
        addAttachment('Bukti Pembelian Unit ke Seller', data.transaction.buyProofDescription, data.transaction.buyProofImageUrl)
    }

    // 2. Cost Proofs (Priority 2)
    if (data.costs.items) {
        data.costs.items.forEach((cost: any) => {
            if (cost.proofs && cost.proofs.length > 0) {
                cost.proofs.forEach((proof: any) => {
                    addAttachment(`Bukti Biaya: ${getCostTypeLabel(cost.costType)} (${cost.description || '-'})`, proof.description, proof.imageUrl)
                })
            }
        })
    }

    // 3. Sell Proofs (Priority 3) - Avoid duplicates between legacy and modern fields
    const sellProofs = data.transaction.proofs?.filter((p: any) => p.proofType === 'SELL') || []

    if (sellProofs.length > 0) {
        // Use modern proofs array if available
        sellProofs.forEach((p: any) => {
            addAttachment('Bukti Pelunasan Unit dari Buyer', p.description, p.imageUrl)
        })
    } else if (data.transaction.sellProofImageUrl) {
        // Fallback to legacy field only if modern proofs don't exist
        const legacyUrl = data.transaction.sellProofImageUrl
        const legacyDesc = data.transaction.sellProofDescription

        if (legacyUrl.trim().startsWith('[') && legacyUrl.trim().endsWith(']')) {
            try {
                const urls = JSON.parse(legacyUrl)
                if (Array.isArray(urls)) {
                    urls.forEach((url: string) => {
                        addAttachment('Bukti Pelunasan Unit dari Buyer', legacyDesc, url)
                    })
                }
            } catch {
                addAttachment('Bukti Pelunasan Unit dari Buyer', legacyDesc, legacyUrl)
            }
        } else {
            addAttachment('Bukti Pelunasan Unit dari Buyer', legacyDesc, legacyUrl)
        }
    }

    // 4. Payment Proofs (Priority 4 - Transfer Bagi Hasil)
    if (data.payment.histories && data.payment.histories.length > 0) {
        data.payment.histories.forEach((ph: any) => {
            if (ph.proofImageUrl) {
                addAttachment(`Bukti Transfer Bagi Hasil`, `Tanggal: ${format(new Date(ph.paymentDate), 'dd MMM yyyy')} - ${formatCurrency(ph.amount)}`, ph.proofImageUrl)
            }
        })
    }

    return attachments
}

export interface TransactionReportExportDeps {
    fetchImpl?: typeof fetch
    imageLoader?: Pick<ReportImageLoader, 'loadAll'>
}

export async function exportTransactionReportPDF(transactionId: string, transactionCode: string, deps: TransactionReportExportDeps = {}) {
    try {
        const fetchImpl = deps.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init))
        const response = await fetchImpl(`/api/reports/transaction/${transactionId}`)

        if (response.status === 401) {
            return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali lalu ekspor ulang.' }
        }
        if (response.status === 403) {
            return { success: false, error: 'Anda tidak memiliki akses ke laporan ini.' }
        }
        if (!response.ok) {
            throw new Error('Gagal menghasilkan laporan transaksi PDF')
        }

        const data: any = await response.json()

        // ===== Fail-closed image preload =====
        // Every image field that carries a URL is an image the report expects:
        // the hero unit image plus every attachment. All of them must load
        // (after bounded retries) before a single PDF page is rendered.
        const attachments = collectTransactionReportAttachments(data)
        const unitImageUrl = data.unit?.imageUrl ? resolveReportImageUrl(data.unit.imageUrl) : null
        const expectedImageUrls = Array.from(new Set<string>([
            ...(unitImageUrl ? [unitImageUrl] : []),
            ...attachments.map((item) => item.imageUrl)
        ]))
        const imageLoader = deps.imageLoader ?? createReportImageLoader({ fetchImpl })
        const imageResults = await imageLoader.loadAll(expectedImageUrls)

        // Global deadline: if any result is a deadline timeout, abort the export.
        const deadlineHit = imageResults.some((r) => !r.ok && r.message === 'Batas waktu ekspor terlampaui')
        if (deadlineHit) {
            return {
                success: false,
                error: 'Ekspor dibatalkan karena gambar membutuhkan waktu terlalu lama. Periksa koneksi lalu coba kembali.',
            }
        }

        const imagesByUri = new Map<string, { ok: true } & DecodedReportImage>()
        let failedImageCount = 0
        expectedImageUrls.forEach((uri, index) => {
            const result = imageResults[index]
            if (result && result.ok) {
                imagesByUri.set(uri, result)
            } else {
                failedImageCount++
            }
        })
        if (failedImageCount > 0) {
            return {
                success: false,
                error: `${failedImageCount} dari ${expectedImageUrls.length} gambar gagal dimuat. Ekspor dibatalkan agar laporan tidak terbit tanpa bukti. Silakan coba lagi.`
            }
        }

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
        if (unitImageUrl) {
            const heroImage = imagesByUri.get(unitImageUrl)
            if (!heroImage) {
                // Unreachable: the preload step fail-closed above.
                throw new Error('Gambar unit tidak tersedia')
            }
            const base64 = heroImage.dataUrl
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
                getCostTypeLabel(cost.costType),
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

        // Store start Y for side-by-side layout
        const summaryStartY = yPos

        // LEFT BOX (Values)
        doc.setDrawColor(...(COLORS.border as [number, number, number]))
        doc.setLineWidth(0.3)
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(leftColX, summaryStartY, colWidth, boxHeight, 1, 1, 'S')

        let localY = summaryStartY + 6
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


        // RIGHT BOX (Shares) - Draw immediately at same Y as Left Box
        doc.setDrawColor(...(COLORS.border as [number, number, number]))
        doc.roundedRect(rightColX, summaryStartY, colWidth, boxHeight, 1, 1, 'S')

        localY = summaryStartY + 6
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

        // Update yPos to below the boxes
        yPos = summaryStartY + boxHeight + 10

        // Add Notes Section if exists - BELOW the boxes
        if (data.transaction.notes) {
            // Check page break for notes
            checkNewPage(30)

            yPos = drawSectionHeader('Catatan Transaksi', yPos)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            doc.setTextColor(...(COLORS.textMain as [number, number, number]))

            const noteLines = doc.splitTextToSize(data.transaction.notes, contentWidth - 4)
            doc.text(noteLines, margin + 2, yPos)
            yPos += (noteLines.length * 5) + 10
        }

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
        // (attachments were collected before rendering, together with the
        //  fail-closed image preload above)

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

                    // Image Height — already preloaded and validated by the
                    // fail-closed step, so this can no longer silently skip.
                    let imgData = null
                    const attachmentImage = imagesByUri.get(item.imageUrl)
                    if (!attachmentImage) {
                        // Unreachable: the preload step fail-closed above.
                        throw new Error('Gambar lampiran tidak tersedia')
                    }
                    const base64 = attachmentImage.dataUrl
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
                        // Center image horizontally within the border
                        const imgX = x + (colWidth - d.imgData.w) / 2
                        doc.addImage(d.imgData.base64, 'JPEG', imgX, localY, d.imgData.w, d.imgData.h)
                        localY += d.imgData.h + 3
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

// ─────────────────────────────────────────────────────────────────────────────
// Export SEMUA PEMODAL ke satu file Excel — 1 sheet per pemodal
// ─────────────────────────────────────────────────────────────────────────────

interface AllInvestorTx {
    transactionCode: string
    unitName: string
    unitPlateNumber: string
    buyDate: string
    sellDate: string | null
    buyPrice: number
    sellPrice: number
    initialInvestorCapital: number
    initialManagerCapital: number
    investorCosts: number
    managerCosts: number
    totalCosts: number
    netMargin: number
    investorProfitAmount: number
    managerProfitAmount: number
    paymentStatus: string
    status: string
    totalPaid: number
    costs: Array<{
        costType: string
        description: string
        payer: string
        amount: number
        date: string
    }>
    paymentHistories: Array<{
        amount: number
        paymentDate: string
        method: string
        notes: string
    }>
}

interface AllInvestorData {
    investor: {
        id: string
        name: string
        contactInfo: string
        bankAccountDetails: string
        marginPercentage: number
        isActive: boolean
    }
    transactions: AllInvestorTx[]
}

const fmtDate = (d: string | null | undefined) => {
    if (!d) return '-'
    return format(new Date(d), 'dd/MM/yyyy')
}

// Warna tema
const BLACK    = 'FF1A1A2E'   // header gelap
const GOLD     = 'FFFFD700'   // teks gold
const BLUE_HDR = 'FF1E3A5F'   // sub-header biru tua
const WHITE    = 'FFFFFFFF'
const GREEN_BG = 'FFD9F0D9'   // baris total
const GRAY_ROW = 'FFF8F8F8'   // alternating row
const RED_LOSS = 'FFFFF0F0'   // merah muda untuk rugi

function applyHeaderStyle(cell: ExcelJS.Cell, bgArgb: string, fgArgb: string, size = 9) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
    cell.font = { bold: true, color: { argb: fgArgb }, size, name: 'Calibri' }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
        top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
    }
}

function applyDataStyle(cell: ExcelJS.Cell, bgArgb?: string, bold = false, align: 'left'|'right'|'center' = 'left') {
    if (bgArgb) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
    }
    cell.font = { size: 8, name: 'Calibri', bold }
    cell.alignment = { vertical: 'middle', horizontal: align, wrapText: false }
    cell.border = {
        top:    { style: 'hair', color: { argb: 'FFDDDDDD' } },
        left:   { style: 'hair', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        right:  { style: 'hair', color: { argb: 'FFDDDDDD' } },
    }
}

export async function exportAllInvestorsXLSX(): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('/api/reports/all-investors')
        if (!response.ok) throw new Error('Gagal mengambil data laporan')

        const allData: AllInvestorData[] = await response.json()

        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'BagiHasil App'
        workbook.created = new Date()

        for (const { investor, transactions } of allData) {
            // ── Kumpulkan semua jenis biaya unik untuk sheet ini ──────────
            const costTypeSet = new Set<string>()
            transactions.forEach(tx => {
                tx.costs?.forEach(c => costTypeSet.add(c.costType))
            })
            // Urutkan alfabetis agar kolom konsisten
            const costTypes = Array.from(costTypeSet).sort()

            // ── Definisi kolom tetap (sebelum & sesudah kolom biaya) ──────
            // FIXED KIRI  : No, Kode, Unit, Polisi, Tgl Beli, Tgl Jual, Harga Beli, Harga Jual, Modal Pemodal, Modal Pengelola
            // DINAMIS     : [costTypes…]  ← kolom biaya per jenis
            // FIXED KANAN : Total Biaya, Biaya Pemodal, Biaya Pengelola, Margin, BH Pemodal, BH Pengelola, Bagi Hasil Dibayar, Status Bayar, Status Tx

            const FIXED_LEFT  = 10  // kolom 1-10
            const FIXED_RIGHT = 9   // jumlah kolom kanan tetap
            const TOTAL_COLS  = FIXED_LEFT + costTypes.length + FIXED_RIGHT

            // Nama sheet: max 31 karakter, hapus karakter ilegal Excel
            const sheetName = investor.name
                .replace(/[:\\/?*[\]]/g, '')
                .substring(0, 31)

            const sheet = workbook.addWorksheet(sheetName, {
                properties: { tabColor: { argb: '1E3A5F' } },
            })

            // ── Lebar kolom ──────────────────────────────────────────────
            const colDefs: Partial<ExcelJS.Column>[] = [
                { key: 'c1',  width: 4  },  // No
                { key: 'c2',  width: 14 },  // Kode
                { key: 'c3',  width: 22 },  // Nama Unit
                { key: 'c4',  width: 12 },  // No Polisi
                { key: 'c5',  width: 12 },  // Tgl Beli
                { key: 'c6',  width: 12 },  // Tgl Jual
                { key: 'c7',  width: 16 },  // Harga Beli
                { key: 'c8',  width: 16 },  // Harga Jual
                { key: 'c9',  width: 16 },  // Modal Pemodal
                { key: 'c10', width: 16 },  // Modal Pengelola
            ]
            // Kolom dinamis biaya
            costTypes.forEach((_, i) => colDefs.push({ key: `cost_${i}`, width: 15 }))
            // Kolom kanan tetap
            colDefs.push(
                { key: 'totalBiaya',      width: 15 },
                { key: 'biayaPemodal',    width: 15 },
                { key: 'biayaPengelola',  width: 15 },
                { key: 'margin',          width: 16 },
                { key: 'bhPemodal',       width: 16 },
                { key: 'bhPengelola',     width: 16 },
                { key: 'paidProfit',      width: 16 },
                { key: 'statusBayar',     width: 12 },
                { key: 'statusTx',        width: 10 },
            )
            sheet.columns = colDefs

            // ── Helper: dapatkan addr dari index kolom (1-based) ──────────
            const colAddr = (colIdx: number) =>
                sheet.getColumn(colIdx).letter

            const lastCol = colAddr(TOTAL_COLS)

            // ── Baris 1: Judul besar ──────────────────────────────────────
            sheet.mergeCells(`A1:${lastCol}1`)
            const titleCell = sheet.getCell('A1')
            titleCell.value = `LAPORAN PEMODAL — ${investor.name.toUpperCase()}`
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } }
            titleCell.font  = { bold: true, size: 13, color: { argb: GOLD }, name: 'Calibri' }
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
            sheet.getRow(1).height = 32

            // ── Baris 2: Info pemodal ─────────────────────────────────────
            const q2 = Math.floor(TOTAL_COLS / 4)
            const ranges2 = [
                [1,           q2],
                [q2+1,        q2*2],
                [q2*2+1,      q2*3],
                [q2*3+1,      TOTAL_COLS],
            ]
            const vals2 = [
                `Kontak: ${investor.contactInfo}`,
                `Rekening: ${investor.bankAccountDetails}`,
                `Margin: ${investor.marginPercentage}%`,
                `Status: ${investor.isActive ? 'Aktif' : 'Nonaktif'}  |  Dibuat: ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
            ]
            ranges2.forEach(([s, e], ri) => {
                const startAddr = colAddr(s)
                const endAddr   = colAddr(e)
                if (s !== e) sheet.mergeCells(`${startAddr}2:${endAddr}2`)
                const c = sheet.getCell(`${startAddr}2`)
                c.value = vals2[ri]
                c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HDR } }
                c.font  = { size: 8, color: { argb: WHITE }, name: 'Calibri' }
                c.alignment = { vertical: 'middle', horizontal: 'left' }
            })
            sheet.getRow(2).height = 18

            // ── Baris 3: kosong ───────────────────────────────────────────
            sheet.getRow(3).height = 6

            // ── Baris 4: Header tabel ─────────────────────────────────────
            const TXN_HDR_ROW = 4
            const hdrFixed = [
                'No', 'Kode Transaksi', 'Nama Unit', 'No Polisi',
                'Tgl Beli', 'Tgl Jual',
                'Harga Beli (Rp)', 'Harga Jual (Rp)',
                'Modal Pemodal (Rp)', 'Modal Pengelola (Rp)',
            ]
            const hdrCosts = costTypes.map(t => `Biaya\n${getCostTypeLabel(t)} (Rp)`)
            const hdrRight = [
                'Total Biaya (Rp)',
                'Biaya Pemodal (Rp)', 'Biaya Pengelola (Rp)',
                'Margin Bersih (Rp)',
                'BH Pemodal (Rp)', 'BH Pengelola (Rp)',
                PAID_PROFIT_REPORT_HEADER, 'Status Bayar', 'Status Transaksi',
            ]
            const headers = [...hdrFixed, ...hdrCosts, ...hdrRight]

            const hdrRow = sheet.getRow(TXN_HDR_ROW)
            hdrRow.height = 42
            headers.forEach((h, i) => {
                const cell = hdrRow.getCell(i + 1)
                cell.value = h
                // Kolom biaya dinamis: warna sedikit berbeda (biru tua) agar mudah dibedakan
                const isCostCol = i >= FIXED_LEFT && i < FIXED_LEFT + costTypes.length
                applyHeaderStyle(cell, isCostCol ? BLUE_HDR : BLACK, isCostCol ? WHITE : GOLD, 8)
            })

            // ── Baris data ────────────────────────────────────────────────
            let currentRow = TXN_HDR_ROW + 1

            let sumInvestorCapital = 0
            let sumManagerCapital  = 0
            let sumInvestorCosts   = 0
            let sumManagerCosts    = 0
            let sumTotalCosts      = 0
            let sumNetMargin       = 0
            let sumInvestorProfit  = 0
            let sumManagerProfit   = 0
            let sumPaidProfit      = 0
            // Akumulasi per jenis biaya
            const sumCostByType: Record<string, number> = {}
            costTypes.forEach(t => { sumCostByType[t] = 0 })

            transactions.forEach((tx, idx) => {
                const isEven = idx % 2 === 0
                const rowBg  = tx.netMargin < 0 ? RED_LOSS : (isEven ? WHITE : GRAY_ROW)

                const payment = mapInvestorReportPayment(tx)

                sumInvestorCapital += tx.initialInvestorCapital ?? 0
                sumManagerCapital  += tx.initialManagerCapital  ?? 0
                sumInvestorCosts   += tx.investorCosts ?? 0
                sumManagerCosts    += tx.managerCosts ?? 0
                sumTotalCosts      += tx.totalCosts ?? 0
                sumNetMargin       += tx.netMargin ?? 0
                sumInvestorProfit  += tx.investorProfitAmount ?? 0
                sumManagerProfit   += tx.managerProfitAmount ?? 0
                sumPaidProfit      += payment.paidProfitAmount

                // Hitung biaya per jenis untuk transaksi ini
                const costByType: Record<string, number> = {}
                costTypes.forEach(t => { costByType[t] = 0 })
                tx.costs?.forEach(c => {
                    costByType[c.costType] = (costByType[c.costType] ?? 0) + c.amount
                    sumCostByType[c.costType] = (sumCostByType[c.costType] ?? 0) + c.amount
                })

                const txRow = sheet.getRow(currentRow)
                txRow.height = 18

                // Nilai kolom kiri tetap
                const valuesLeft = [
                    idx + 1,
                    tx.transactionCode,
                    tx.unitName,
                    tx.unitPlateNumber,
                    fmtDate(tx.buyDate),
                    fmtDate(tx.sellDate),
                    tx.buyPrice,
                    tx.sellPrice,
                    payment.investorTransactionCapital,
                    tx.initialManagerCapital,
                ]
                // Nilai kolom biaya dinamis
                const valuesCosts = costTypes.map(t => costByType[t] ?? 0)
                // Nilai kolom kanan tetap
                const valuesRight = [
                    tx.totalCosts,
                    tx.investorCosts,
                    tx.managerCosts,
                    tx.netMargin,
                    payment.investorProfitAmount,
                    tx.managerProfitAmount,
                    payment.paidProfitAmount,
                    tx.paymentStatus,
                    tx.status,
                ]

                const allValues = [...valuesLeft, ...valuesCosts, ...valuesRight]
                allValues.forEach((v, i) => {
                    const cell = txRow.getCell(i + 1)
                    cell.value = v as ExcelJS.CellValue
                    const isNumLeft  = i >= 6 && i <= 9          // harga beli-jual, modal
                    const isNumCost  = i >= FIXED_LEFT && i < FIXED_LEFT + costTypes.length
                    const isNumRight = i >= FIXED_LEFT + costTypes.length && i <= FIXED_LEFT + costTypes.length + 6  // sampai paidProfit
                    const isNum = isNumLeft || isNumCost || isNumRight
                    const align = isNum ? 'right' : (i < 4 ? 'left' : 'center')
                    applyDataStyle(cell, rowBg, false, align)
                    if (isNum) cell.numFmt = '#,##0'
                })

                currentRow++
            })

            // ── Baris Total ────────────────────────────────────────────────
            if (transactions.length > 0) {
                const totRow = sheet.getRow(currentRow)
                totRow.height = 22

                const totLeft: (string|number)[] = [
                    '', 'TOTAL', '', '', '', '',
                    '', '', sumInvestorCapital, sumManagerCapital,
                ]
                const totCosts = costTypes.map(t => sumCostByType[t] ?? 0)
                const totRight: (string|number)[] = [
                    sumTotalCosts,
                    sumInvestorCosts,
                    sumManagerCosts,
                    sumNetMargin,
                    sumInvestorProfit,
                    sumManagerProfit,
                    sumPaidProfit,
                    '', '',
                ]
                const totAll = [...totLeft, ...totCosts, ...totRight]
                totAll.forEach((v, i) => {
                    const cell = totRow.getCell(i + 1)
                    cell.value = v as ExcelJS.CellValue
                    const isNumLeft  = i >= 8 && i <= 9
                    const isNumCost  = i >= FIXED_LEFT && i < FIXED_LEFT + costTypes.length
                    const isNumRight = i >= FIXED_LEFT + costTypes.length && i <= FIXED_LEFT + costTypes.length + 6
                    const isNum = isNumLeft || isNumCost || isNumRight
                    applyDataStyle(cell, GREEN_BG, true, isNum ? 'right' : (i === 1 ? 'center' : 'left'))
                    if (isNum) cell.numFmt = '#,##0'
                })
                // Merge label "TOTAL"
                sheet.mergeCells(`B${currentRow}:${colAddr(FIXED_LEFT)}${currentRow}`)
            }

            // Freeze baris 1-4 + 2 kolom pertama
            sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: TXN_HDR_ROW, activeCell: 'C5' }]
        }

        // ── Download ───────────────────────────────────────────────────────
        const buffer = await workbook.xlsx.writeBuffer()
        const fileName = `Laporan_Semua_Pemodal_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        setTimeout(() => {
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        }, 150)

        return { success: true }
    } catch (error) {
        console.error('Error exporting all investors XLSX:', error)
        return { success: false, error: 'Gagal mengekspor laporan semua pemodal' }
    }
}
