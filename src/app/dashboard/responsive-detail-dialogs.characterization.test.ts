import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const dialog = readFileSync("src/components/ui/dialog.tsx", "utf8")
const unitDetail = readFileSync("src/components/units/AdminUnitDetailDialog.tsx", "utf8")
const transactionDetail = readFileSync("src/components/transactions/AdminTransactionDetailDialog.tsx", "utf8")
const transactionsPage = readFileSync("src/app/dashboard/transactions/page.tsx", "utf8")

describe("responsive detail dialog and investor identity contracts", () => {
    it("keeps the shared dialog above the desktop sidebar with safe viewport bounds", () => {
        expect(dialog.match(/z-\[100\]/g)).toHaveLength(2)
        expect(dialog).toContain("fixed inset-0")
        expect(dialog).toContain("max-w-[calc(100vw-1rem)]")
        expect(dialog).toContain("max-h-[calc(100dvh-1rem)]")
        expect(dialog).toContain("overflow-y-auto")
    })

    it("keeps both detail dialogs constrained and accessible", () => {
        for (const source of [unitDetail, transactionDetail]) {
            expect(source).toContain("<DialogTitle")
            expect(source).toContain("<DialogContent")
            expect(source).toContain("min-w-0")
            expect(source).toContain("overflow-y-auto")
            expect(source).not.toContain("w-[1200px]")
        }
        expect(unitDetail).toContain("Detail Unit")
        expect(transactionDetail).toContain("Detail Transaksi")
    })

    it("keeps investor identity readable in mobile and desktop transaction views", () => {
        const investorCells = transactionsPage.match(/className="min-w-0 flex-1 break-words leading-tight line-clamp-2 text-left"/g) || []
        expect(investorCells).toHaveLength(2)
        expect(transactionsPage.match(/line-clamp-2/g) || []).toHaveLength(2)
        expect(transactionsPage.match(/title=\{trx\.unit\.investor\.name\}/g) || []).toHaveLength(2)
        expect(transactionsPage).not.toContain("break-all")
        expect(transactionsPage).not.toContain("w-5 h-5 rounded-full")
    })
})
