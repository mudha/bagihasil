import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("src/app/dashboard/transactions/[id]/page.tsx", "utf8")

describe("Transaction detail Mudha operational alignment", () => {
  it("uses StatusBadge and compact record header", () => {
    expect(source).toContain("StatusBadge")
    expect(source).toContain("getStatusBadgeTone")
    expect(source).toContain("getStatusLabel")
    expect(source).toContain("h1")
    expect(source).toContain("transaction.transactionCode")
    expect(source).toContain("ArrowLeft")
    expect(source).toContain("formatHijriFull")
  })

  it("does not contain marketing hero decorations", () => {
    expect(source).not.toContain("bg-[#073f3b]")
    expect(source).not.toContain("shadow-2xl shadow-teal-950/15")
    expect(source).not.toContain("blur-3xl")
    expect(source).not.toContain("backdrop-blur")
  })

  it("has explicit loading/error/loaded view-state branches", () => {
    expect(source).toContain("isLoading")
    expect(source).toContain("setError")
    expect(source).toContain("setIsLoading")
    expect(source).toContain("LoadingState")
    expect(source).toContain("ErrorState")
    expect(source).toContain("Memuat detail transaksi")
    expect(source).toContain("Gagal memuat data transaksi")
    expect(source).toContain("Data tidak ditemukan")
    expect(source).toContain("Gagal memuat detail transaksi")
    expect(source).toContain("setIsLoading(false)")
  })

  it("validates fetch response and localizes error messages", () => {
    expect(source).toContain("if (!res.ok)")
    expect(source).toContain("Gagal memuat data transaksi")
    expect(source).toContain("setIsLoading(true)")
    expect(source).toContain("setError(null)")
    expect(source).toContain("finally")
    expect(source).toContain("setIsLoading(false)")
  })

  it("has retry wiring with the same fetch function", () => {
    expect(source).toContain("onRetry={fetchTransaction}")
    expect(source).toContain("fetchTransaction")
  })

  it("localizes export text", () => {
    expect(source).not.toContain("Exporting...")
    expect(source).toContain("Mengekspor")
  })

  it("preserves all sections and action wiring", () => {
    expect(source).toContain("formatCurrency")
    expect(source).toContain("totalCapital")
    expect(source).toContain("baseInvestorCapital")
    expect(source).toContain("baseManagerCapital")
    expect(source).toContain("costsInvestor")
    expect(source).toContain("costsManager")
    expect(source).toContain("transaction.costs")
    expect(source).toContain("AddCostDialog")
    expect(source).toContain("AddPaymentDialog")
    expect(source).toContain("FinalizeTransactionDialog")
    expect(source).toContain("EditTransactionDetailsDialog")
    expect(source).toContain("ManageCostProofsDialog")
    expect(source).toContain("UpdateTransactionProofDialog")
    expect(source).toContain("UpdateUnitImageDialog")
    expect(source).toContain("EditProfitSharingDialog")
    expect(source).toContain("ImagePreviewDialog")
  })

  it("preserves permission-gated sections", () => {
    expect(source).toContain("transaction.status === 'COMPLETED'")
    expect(source).toContain("transaction.status !== 'COMPLETED'")
    expect(source).toContain("handleDeleteCost")
    expect(source).toContain("handleEditCost")
  })
})
