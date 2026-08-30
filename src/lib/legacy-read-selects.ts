import { Prisma } from "@prisma/client"

export const legacyInvestorScalarSelect = {
    id: true,
    userId: true,
    name: true,
    contactInfo: true,
    notes: true,
    bankAccountDetails: true,
    marginPercentage: true,
    isActive: true,
    managedCapitalBalance: true,
    managedCapitalBalanceUpdatedAt: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.InvestorSelect

export const legacyInvestorSelect = legacyInvestorScalarSelect

export const legacyUnitScalarSelect = {
    id: true,
    investorId: true,
    name: true,
    plateNumber: true,
    code: true,
    imageUrl: true,
    stnkImageUrl: true,
    engineNumber: true,
    chassisNumber: true,
    taxDueDate: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    vehicleType: true,
    brand: true,
    model: true,
    type: true,
    year: true,
    color: true,
    kilometer: true,
} satisfies Prisma.UnitSelect

export const legacyUnitWithInvestorSelect = {
    ...legacyUnitScalarSelect,
    investor: { select: legacyInvestorSelect },
} satisfies Prisma.UnitSelect

export const legacyTransactionScalarSelect = {
    id: true,
    unitId: true,
    transactionCode: true,
    buyDate: true,
    buyPrice: true,
    initialInvestorCapital: true,
    initialManagerCapital: true,
    sellDate: true,
    sellPrice: true,
    status: true,
    profitStatus: true,
    lossBearer: true,
    paymentStatus: true,
    notes: true,
    buyProofImageUrl: true,
    buyProofDescription: true,
    sellProofImageUrl: true,
    sellProofDescription: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.TransactionSelect

export const legacyCostSelect = {
    id: true,
    transactionId: true,
    costType: true,
    payer: true,
    amount: true,
    description: true,
    date: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.CostSelect

export const legacyProfitSharingSelect = {
    id: true,
    transactionId: true,
    totalCapitalInvestor: true,
    totalCapitalManager: true,
    totalCapital: true,
    netMargin: true,
    investorSharePercentage: true,
    managerSharePercentage: true,
    investorProfitAmount: true,
    managerProfitAmount: true,
    calculatedAt: true,
} satisfies Prisma.ProfitSharingSelect

export const legacyPaymentHistorySelect = {
    id: true,
    transactionId: true,
    investorId: true,
    idempotencyKey: true,
    idempotencyFingerprint: true,
    amount: true,
    paymentDate: true,
    method: true,
    proofImageUrl: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.PaymentHistorySelect

export const legacyTransactionSelect = {
    ...legacyTransactionScalarSelect,
    unit: { select: legacyUnitWithInvestorSelect },
    costs: { select: legacyCostSelect },
    profitSharing: { select: legacyProfitSharingSelect },
    paymentHistories: { select: legacyPaymentHistorySelect },
    _count: { select: { paymentHistories: true } },
} satisfies Prisma.TransactionSelect

export const legacyTransactionWithUnitSelect = {
    ...legacyTransactionScalarSelect,
    unit: { select: legacyUnitWithInvestorSelect },
} satisfies Prisma.TransactionSelect

export const legacyInvestorDashboardSelect = {
    ...legacyInvestorScalarSelect,
    units: { select: legacyUnitScalarSelect, where: { status: "AVAILABLE" } },
    paymentHistories: { select: legacyPaymentHistorySelect },
} satisfies Prisma.InvestorSelect

export const legacyTransactionForDashboardSelect = {
    ...legacyTransactionScalarSelect,
    costs: { select: legacyCostSelect },
    profitSharing: { select: legacyProfitSharingSelect },
} satisfies Prisma.TransactionSelect

export const legacyUnitWithTransactionsSelect = {
    ...legacyUnitScalarSelect,
    transactions: { select: legacyTransactionScalarSelect },
} satisfies Prisma.UnitSelect
