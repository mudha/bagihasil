import { describe, expect, it } from "vitest"
import { mapInvestorReportPayment, PAID_PROFIT_REPORT_HEADER } from "./investor-report-payment"

const base = {
    initialInvestorCapital: 1_000_000,
    investorProfitAmount: 0,
    totalPaid: 0,
}

describe("investor report payment mapping", () => {
    it("labels recorded payments as paid profit, not capital transfer", () => {
        expect(PAID_PROFIT_REPORT_HEADER).toBe("Bagi Hasil Telah Dibayar (Rp)")
    })
    it("keeps transaction capital separate from paid profit for a profitable transaction", () => {
        expect(mapInvestorReportPayment({
            ...base,
            investorProfitAmount: 100_000,
            totalPaid: 75_000,
        })).toEqual({
            investorTransactionCapital: 1_000_000,
            investorProfitAmount: 100_000,
            paidProfitAmount: 75_000,
        })
    })

    it("does not report transaction capital as payment at break-even", () => {
        expect(mapInvestorReportPayment(base)).toEqual({
            investorTransactionCapital: 1_000_000,
            investorProfitAmount: 0,
            paidProfitAmount: 0,
        })
    })

    it("does not report transaction capital or a negative amount as payment on loss", () => {
        expect(mapInvestorReportPayment({ ...base, totalPaid: 0 })).toEqual({
            investorTransactionCapital: 1_000_000,
            investorProfitAmount: 0,
            paidProfitAmount: 0,
        })
    })
})
