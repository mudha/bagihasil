import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
    REPORT_IMAGE_CONCURRENCY,
    REPORT_IMAGE_MAX_ATTEMPTS,
    createReportImageLoader,
    exportTransactionReportPDF,
    transformReportImageUrl,
    type ReportImageLoader,
    type ReportImageLoaderOptions,
} from './export-utils'

// Real 8x8 JPEG so jsPDF can genuinely parse the embedded image offline.
const TINY_JPEG_DATA_URL =
    'data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKQAI2f/2Q=='

type OkResult = { ok: true; dataUrl: string; width: number; height: number }

const okDecode = () => ({ dataUrl: TINY_JPEG_DATA_URL, width: 8, height: 8 })

const okResult = (): OkResult => ({ ok: true, ...okDecode() })

const imageFetchOk = () =>
    ({
        ok: true,
        status: 200,
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    }) as unknown as Response

const imageFetchFail = (status: number, blobType = 'text/html') =>
    ({
        ok: false,
        status,
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: blobType }),
    }) as unknown as Response

const noSleep = async () => {}

const callUrls = (fn: Mock) => fn.mock.calls.map((call) => String(call[0]))

const loaderOptions = (partial: Partial<ReportImageLoaderOptions> = {}): ReportImageLoaderOptions => ({
    decodeBlob: async () => okDecode(),
    sleep: noSleep,
    timeoutMs: 50,
    ...partial,
})

// ─────────────────────────────────────────────────────────────────────────────
// Image loader unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('createReportImageLoader', () => {
    it('returns a structured success for a healthy image, fetching it once', async () => {
        const fetchImpl = vi.fn(async () => imageFetchOk())
        const loader = createReportImageLoader(loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }))

        const result = await loader.load('https://cdn.example.test/a.jpg')

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.dataUrl).toBe(TINY_JPEG_DATA_URL)
            expect(result.width).toBeGreaterThan(0)
            expect(result.height).toBeGreaterThan(0)
        }
        expect(fetchImpl).toHaveBeenCalledTimes(1)
        expect(callUrls(fetchImpl)).toEqual(['https://cdn.example.test/a.jpg'])
    })

    it('bounds a hanging image with a per-attempt timeout instead of hanging the export', async () => {
        const hangingFetch = vi.fn(
            (_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
                })
        )
        const loader = createReportImageLoader(
            loaderOptions({ fetchImpl: hangingFetch as unknown as typeof fetch, timeoutMs: 40 })
        )

        const startedAt = Date.now()
        const result = await loader.load('https://cdn.example.test/slow.jpg')
        const elapsed = Date.now() - startedAt

        expect(result).toMatchObject({ ok: false, code: 'timeout' })
        // Initial attempt + max 2 retries — never an unbounded hang.
        expect(hangingFetch).toHaveBeenCalledTimes(REPORT_IMAGE_MAX_ATTEMPTS)
        expect(elapsed).toBeLessThan(1500)
    })

    it('retries a network failure and succeeds on the next attempt', async () => {
        let call = 0
        const fetchImpl = vi.fn(async () => {
            call += 1
            if (call === 1) throw new TypeError('Failed to fetch')
            return imageFetchOk()
        })
        const loader = createReportImageLoader(loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }))

        const result = await loader.load('https://cdn.example.test/flaky.jpg')

        expect(result.ok).toBe(true)
        expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    it('gives up with a structured failure after the initial attempt plus two retries', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new TypeError('Failed to fetch')
        })
        const loader = createReportImageLoader(loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }))

        const result = await loader.load('https://cdn.example.test/down.jpg')

        expect(result).toMatchObject({ ok: false, code: 'network' })
        expect(fetchImpl).toHaveBeenCalledTimes(REPORT_IMAGE_MAX_ATTEMPTS)
    })

    it('rejects a non-image body without retrying', async () => {
        const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['<html>'], { type: 'text/html' }) }) as unknown as Response)
        const loader = createReportImageLoader(loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }))

        const result = await loader.load('https://cdn.example.test/error-page.jpg')

        expect(result).toMatchObject({ ok: false, code: 'mime' })
        expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('fails when decode reports zero dimensions', async () => {
        const fetchImpl = vi.fn(async () => imageFetchOk())
        const loader = createReportImageLoader(
            loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch, decodeBlob: async () => ({ dataUrl: TINY_JPEG_DATA_URL, width: 0, height: 0 }) })
        )

        const result = await loader.load('https://cdn.example.test/zero.jpg')

        expect(result).toMatchObject({ ok: false, code: 'decode' })
        expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('fails when decoding throws', async () => {
        const fetchImpl = vi.fn(async () => imageFetchOk())
        const loader = createReportImageLoader(
            loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch, decodeBlob: async () => { throw new Error('rusak') } })
        )

        const result = await loader.load('https://cdn.example.test/corrupt.jpg')

        expect(result).toMatchObject({ ok: false, code: 'decode' })
        expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('loads each unique URL only once (dedup)', async () => {
        const fetchImpl = vi.fn(async () => imageFetchOk())
        const loader = createReportImageLoader(loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }))
        const first = 'https://cdn.example.test/1.jpg'
        const second = 'https://cdn.example.test/2.jpg'

        const results = await loader.loadAll([first, second, first])

        expect(results).toHaveLength(3)
        expect(results.every((result) => result.ok)).toBe(true)
        expect(callUrls(fetchImpl)).toEqual([first, second])
    })

    it('never runs more than 3 image requests concurrently', async () => {
        let inFlight = 0
        let maxInFlight = 0
        const fetchImpl = vi.fn(async () => {
            inFlight += 1
            maxInFlight = Math.max(maxInFlight, inFlight)
            await new Promise((resolve) => setTimeout(resolve, 20))
            inFlight -= 1
            return imageFetchOk()
        })
        const loader = createReportImageLoader(loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }))
        const urls = Array.from({ length: 6 }, (_, index) => `https://cdn.example.test/${index}.jpg`)

        const results = await loader.loadAll(urls)

        expect(REPORT_IMAGE_CONCURRENCY).toBe(3)
        expect(results).toHaveLength(6)
        expect(results.every((result) => result.ok)).toBe(true)
        expect(fetchImpl).toHaveBeenCalledTimes(6)
        expect(maxInFlight).toBeLessThanOrEqual(3)
        expect(maxInFlight).toBeGreaterThanOrEqual(2)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// ImageKit URL transformation
// ─────────────────────────────────────────────────────────────────────────────

describe('transformReportImageUrl', () => {
    it('requests a bounded ImageKit rendition (max width 800, reasonable quality)', () => {
        expect(transformReportImageUrl('https://ik.imagekit.io/acct/profit-sharing-app/payment-proofs/x.jpg')).toBe(
            'https://ik.imagekit.io/acct/profit-sharing-app/payment-proofs/x.jpg?tr=w-800,q-75'
        )
    })

    it('keeps existing query parameters byte-for-byte', () => {
        expect(transformReportImageUrl('https://ik.imagekit.io/acct/x.jpg?ik-t=a%20b%2Fc&ik-exp=999')).toBe(
            'https://ik.imagekit.io/acct/x.jpg?ik-t=a%20b%2Fc&ik-exp=999&tr=w-800,q-75'
        )
    })

    it('leaves an already transformed URL alone', () => {
        expect(transformReportImageUrl('https://ik.imagekit.io/acct/x.jpg?tr=w-400')).toBe(
            'https://ik.imagekit.io/acct/x.jpg?tr=w-400'
        )
    })

    it('never touches Cloudinary, legacy, relative or data URLs', () => {
        expect(transformReportImageUrl('https://res.cloudinary.com/demo/image/upload/cat.jpg?v=2')).toBe(
            'https://res.cloudinary.com/demo/image/upload/cat.jpg?v=2'
        )
        expect(transformReportImageUrl('https://legacy.example.com/bukti.png?id=7')).toBe(
            'https://legacy.example.com/bukti.png?id=7'
        )
        expect(transformReportImageUrl('/uploads/bukti.jpg')).toBe('/uploads/bukti.jpg')
        expect(transformReportImageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    })

    it('matches a configured custom ImageKit endpoint and nothing else', () => {
        vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', 'https://cdn.mysite.test/ik')
        try {
            expect(transformReportImageUrl('https://cdn.mysite.test/ik/a.jpg?x=1')).toBe(
                'https://cdn.mysite.test/ik/a.jpg?x=1&tr=w-800,q-75'
            )
            expect(transformReportImageUrl('https://other.example.com/a.jpg')).toBe('https://other.example.com/a.jpg')
        } finally {
            vi.unstubAllEnvs()
        }
    })
})

describe('createReportImageLoader — ImageKit fallback', () => {
    it('falls back once to the original URL when the transformed URL fails', async () => {
        const original = 'https://ik.imagekit.io/acct/profit-sharing-app/payment-proofs/x.jpg'
        const transformed = `${original}?tr=w-800,q-75`
        const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.includes('tr=')) return imageFetchFail(400)
            return imageFetchOk()
        })
        const loader = createReportImageLoader(loaderOptions({ fetchImpl: fetchImpl as unknown as typeof fetch }))

        const result = await loader.load(original)

        expect(result.ok).toBe(true)
        expect(callUrls(fetchImpl)).toEqual([transformed, original])
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// exportTransactionReportPDF — fail-closed behavior
// ─────────────────────────────────────────────────────────────────────────────

const IMG = {
    hero: 'https://cdn.example.test/unit/hero.jpg',
    buy: 'https://cdn.example.test/proof/buy.jpg',
    // Intentionally identical to buy — proves URL dedup at the export level.
    cost: 'https://cdn.example.test/proof/buy.jpg',
    sell: 'https://cdn.example.test/proof/sell.jpg',
    pay: 'https://cdn.example.test/proof/pay.jpg',
}

const EXPECTED_UNIQUE_URLS = [IMG.hero, IMG.buy, IMG.sell, IMG.pay]

const makeReport = () => ({
    transaction: {
        id: 'tx-1',
        transactionCode: 'TRX-2026-001',
        buyDate: '2026-01-10T00:00:00.000Z',
        sellDate: '2026-02-10T00:00:00.000Z',
        buyPrice: 100_000_000,
        sellPrice: 120_000_000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        duration: 31,
        buyProofImageUrl: null,
        buyProofDescription: null,
        sellProofImageUrl: null,
        sellProofDescription: null,
        proofs: [
            { proofType: 'BUY', imageUrl: IMG.buy, description: 'Bukti transfer ke seller' },
            { proofType: 'SELL', imageUrl: IMG.sell, description: 'Bukti pelunasan' },
        ],
        notes: 'Catatan transaksi uji',
    },
    unit: { name: 'Yamaha XMAX', plateNumber: 'B 1234 XYZ', code: 'UNIT-1', imageUrl: IMG.hero },
    investor: { name: 'Investor A', contactInfo: '-', bankAccountDetails: '-' },
    capital: { investorCapital: 50_000_000, managerCapital: 50_000_000, totalCapital: 100_000_000 },
    costs: {
        items: [
            {
                costType: 'INSPECTION',
                payer: 'INVESTOR',
                amount: 500_000,
                description: 'Inspeksi',
                date: '2026-01-11T00:00:00.000Z',
                proofs: [{ imageUrl: IMG.cost, description: 'Nota inspeksi' }],
            },
        ],
        investorCosts: 500_000,
        managerCosts: 0,
        totalCosts: 500_000,
    },
    profitSharing: {
        netMargin: 19_500_000,
        investorSharePercentage: 50,
        managerSharePercentage: 50,
        investorProfitAmount: 9_750_000,
        managerProfitAmount: 9_750_000,
    },
    payment: {
        investorShouldReceive: 9_750_000,
        totalPaid: 9_750_000,
        remaining: 0,
        paymentStatus: 'PAID',
        histories: [
            {
                paymentDate: '2026-02-11T00:00:00.000Z',
                amount: 9_750_000,
                method: 'TRANSFER',
                notes: '-',
                proofImageUrl: IMG.pay,
            },
        ],
    },
    generatedAt: '2026-10-02T12:00:00.000Z',
})

const apiResponse = (status: number, body: unknown = makeReport()) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as unknown as Response

const makeImageFetch = () => vi.fn(async () => imageFetchOk())

const makeLoader = (imageFetch: Mock): Pick<ReportImageLoader, 'loadAll'> =>
    createReportImageLoader(
        loaderOptions({ fetchImpl: imageFetch as unknown as typeof fetch, timeoutMs: 500 })
    )

// Browser surface needed by the export (module-level stubs: jsPDF initializes
// in node mode first, before these globals exist).
let anchorClick: Mock = vi.fn()
vi.stubGlobal('window', {
    location: { origin: 'https://app.example.test' },
    URL: { createObjectURL: vi.fn(() => 'blob:mock-pdf'), revokeObjectURL: vi.fn() },
})
vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: (...args: unknown[]) => anchorClick(...args),
    })),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
})

let consoleErrorSpy: { mockRestore: () => void }

beforeEach(() => {
    vi.clearAllMocks()
    anchorClick = vi.fn()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    consoleErrorSpy.mockRestore()
})

describe('exportTransactionReportPDF', () => {
    it('401: asks the user to log in again, without loading images or downloading', async () => {
        const fetchImpl = vi.fn(async () => apiResponse(401, { error: 'Unauthorized' }))
        const loadAll = vi.fn(async (urls: string[]) => urls.map(() => okResult()))

        const result = await exportTransactionReportPDF('tx-1', 'TRX-2026-001', {
            fetchImpl: fetchImpl as unknown as typeof fetch,
            imageLoader: { loadAll },
        })

        expect(result).toEqual({
            success: false,
            error: 'Sesi Anda telah berakhir. Silakan login kembali lalu ekspor ulang.',
        })
        expect(loadAll).not.toHaveBeenCalled()
        expect(anchorClick).not.toHaveBeenCalled()
    })

    it('403: explains the missing access, without loading images or downloading', async () => {
        const fetchImpl = vi.fn(async () => apiResponse(403, { error: 'Forbidden' }))
        const loadAll = vi.fn(async (urls: string[]) => urls.map(() => okResult()))

        const result = await exportTransactionReportPDF('tx-1', 'TRX-2026-001', {
            fetchImpl: fetchImpl as unknown as typeof fetch,
            imageLoader: { loadAll },
        })

        expect(result).toEqual({
            success: false,
            error: 'Anda tidak memiliki akses ke laporan ini.',
        })
        expect(loadAll).not.toHaveBeenCalled()
        expect(anchorClick).not.toHaveBeenCalled()
    })

    it('other API failures: generic report error, no download', async () => {
        const fetchImpl = vi.fn(async () => apiResponse(500, { error: 'boom' }))
        const loadAll = vi.fn(async (urls: string[]) => urls.map(() => okResult()))

        const result = await exportTransactionReportPDF('tx-1', 'TRX-2026-001', {
            fetchImpl: fetchImpl as unknown as typeof fetch,
            imageLoader: { loadAll },
        })

        expect(result).toEqual({ success: false, error: 'Gagal mengekspor laporan transaksi PDF' })
        expect(loadAll).not.toHaveBeenCalled()
        expect(anchorClick).not.toHaveBeenCalled()
    })

    it('all images load: preloads unique URLs once and downloads the PDF exactly once', async () => {
        const apiFetch = vi.fn(async () => apiResponse(200))
        const imageFetch = makeImageFetch()
        const loadAll = vi.fn((urls: string[]) => makeLoader(imageFetch).loadAll(urls))

        const result = await exportTransactionReportPDF('tx-1', 'TRX-2026-001', {
            fetchImpl: apiFetch as unknown as typeof fetch,
            imageLoader: { loadAll },
        })

        expect(result).toEqual({ success: true })
        // Unique, ordered expectations: hero first, then attachments (dup dropped).
        expect(loadAll).toHaveBeenCalledTimes(1)
        expect(loadAll.mock.calls[0][0]).toEqual(EXPECTED_UNIQUE_URLS)
        expect(imageFetch).toHaveBeenCalledTimes(EXPECTED_UNIQUE_URLS.length)
        // Legacy CDN URLs must not be rewritten by the ImageKit transform.
        expect(callUrls(imageFetch).every((url) => !url.includes('tr='))).toBe(true)
        expect(anchorClick).toHaveBeenCalledTimes(1)
    })

    it('one of several images fails: no partial download, success:false with counts only', async () => {
        const apiFetch = vi.fn(async () => apiResponse(200))
        const imageFetch = vi.fn(async (input: RequestInfo | URL) =>
            String(input) === IMG.sell ? imageFetchFail(404) : imageFetchOk()
        )
        const loadAll = vi.fn((urls: string[]) => makeLoader(imageFetch).loadAll(urls))

        const result = await exportTransactionReportPDF('tx-1', 'TRX-2026-001', {
            fetchImpl: apiFetch as unknown as typeof fetch,
            imageLoader: { loadAll },
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe(
                '1 dari 4 gambar gagal dimuat. Ekspor dibatalkan agar laporan tidak terbit tanpa bukti. Silakan coba lagi.'
            )
            // Friendly error: no URLs, no tokens, no storage details.
            expect(result.error).not.toMatch(/https?:\/\//)
            expect(result.error).not.toContain('cdn.example.test')
            expect(result.error).not.toContain('.jpg')
        }
        // Fail-closed: nothing was rendered, produced or downloaded.
        expect(anchorClick).not.toHaveBeenCalled()
        expect((window as unknown as { URL: { createObjectURL: Mock } }).URL.createObjectURL).not.toHaveBeenCalled()
    })
})
