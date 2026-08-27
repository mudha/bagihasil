import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("src/app/dashboard/transactions/page.tsx", "utf8")

describe("Mudha operational transaction list contract", () => {
  it("uses the compact operational header and four summary metrics", () => {
    expect(source).toContain("<OperationalPageHeader")
    expect(source).toContain('title="Daftar Transaksi"')
    expect(source).toContain('label="Total"')
    expect(source).toContain('label="Berjalan"')
    expect(source).toContain('label="Selesai"')
    expect(source).toContain('label="Nilai beli"')
    expect(source).not.toContain("Deal flow")
    expect(source).not.toContain("Alur beli-jual tampil lebih hidup.")
    expect(source).not.toContain("<Sparkles")
    expect(source).not.toContain('bg-[#073f3b]')
    expect(source).not.toContain("shadow-2xl shadow-teal-950/15")
  })

  it("has explicit primary loading/error/loaded branches with response validation and retry", () => {
    expect(source).toContain("const [txLoading, setTxLoading] = useState(true)")
    expect(source).toContain("const [txError, setTxError] = useState<string | null>(null)")
    expect(source).toContain("if (!res.ok) throw new Error('Gagal memuat data transaksi')")
    expect(source).toContain('<LoadingState variant="table" label="Memuat data transaksi..." />')
    expect(source).toContain('<ErrorState title="Gagal memuat data transaksi" description={txError} onRetry={fetchTransactions} />')
    expect(source).toContain('loading={txLoading || !!txError}')
    expect(source).toContain("setTxLoading(false)")
    expect(source).toContain("setTxError(null)")
  })

  it("keeps transaction domain contracts, actions, status separation, and list wiring", () => {
    expect(source.indexOf("<ImportTransactionsDialog")).toBeGreaterThan(-1)
    expect(source.indexOf("<ImportTransactionsDialog")).toBeLessThan(source.indexOf("{txLoading ?"))
    expect(source).toContain("<AdminTransactionDetailDialog")
    expect(source).toContain("<PaginationControls")
    expect(source).toContain("selectedIds")
    expect(source).toContain("paymentStatus")
    expect(source).toContain("statusFilter")
    expect(source).toContain("handleBulkMarkAsPaid")
    expect(source).toContain("/dashboard/transactions/${viewingTransaction.id}")
  })
})
