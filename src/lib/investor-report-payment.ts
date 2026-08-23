export const PAID_PROFIT_REPORT_HEADER = "Bagi Hasil Telah Dibayar (Rp)"

export type InvestorReportPaymentInput = {
    initialInvestorCapital: number
    investorProfitAmount: number
    totalPaid: number
}

export function mapInvestorReportPayment(input: InvestorReportPaymentInput) {
    return {
        investorTransactionCapital: input.initialInvestorCapital,
        investorProfitAmount: input.investorProfitAmount,
        paidProfitAmount: input.totalPaid,
    }
}
