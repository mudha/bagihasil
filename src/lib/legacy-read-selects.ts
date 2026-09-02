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

export const legacyTransactionProofSelect = {
    id: true,
    transactionId: true,
    proofType: true,
    imageUrl: true,
    description: true,
    createdAt: true,
} satisfies Prisma.TransactionProofSelect

export const legacyCostWithProofsSelect = {
    ...legacyCostSelect,
    proofs: { select: {
        id: true,
        costId: true,
        imageUrl: true,
        description: true,
        createdAt: true,
    } },
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

export const legacyTransactionReportSelect = {
    ...legacyTransactionScalarSelect,
    costs: { select: legacyCostSelect },
    profitSharing: { select: legacyProfitSharingSelect },
    paymentHistories: { select: legacyPaymentHistorySelect },
} satisfies Prisma.TransactionSelect

const legacyInvestorReportUnitsSelect = {
    select: {
        ...legacyUnitScalarSelect,
        transactions: { select: legacyTransactionReportSelect },
    },
} satisfies Prisma.InvestorSelect["units"]

export const legacyInvestorReportSelect = {
    ...legacyInvestorScalarSelect,
    units: {
        ...legacyInvestorReportUnitsSelect,
        select: {
            ...legacyInvestorReportUnitsSelect.select,
            transactions: {
                ...legacyInvestorReportUnitsSelect.select.transactions,
                orderBy: { buyDate: "desc" },
            },
        },
    },
} satisfies Prisma.InvestorSelect

export const legacyInvestorCsvReportSelect = {
    ...legacyInvestorScalarSelect,
    units: {
        ...legacyInvestorReportUnitsSelect,
        select: {
            ...legacyInvestorReportUnitsSelect.select,
            transactions: {
                ...legacyInvestorReportUnitsSelect.select.transactions,
                orderBy: { sellDate: "desc" },
            },
        },
    },
} satisfies Prisma.InvestorSelect

export const legacyAllInvestorsReportSelect = {
    ...legacyInvestorScalarSelect,
    units: {
        select: {
            ...legacyUnitScalarSelect,
            transactions: {
                select: {
                    ...legacyTransactionScalarSelect,
                    costs: { select: legacyCostSelect, orderBy: { date: "asc" } },
                    profitSharing: { select: legacyProfitSharingSelect },
                    paymentHistories: { select: legacyPaymentHistorySelect, orderBy: { paymentDate: "asc" } },
                },
                orderBy: { buyDate: "asc" },
            },
        },
    },
} satisfies Prisma.InvestorSelect

export const legacyTransactionDetailSelect = {
    ...legacyTransactionScalarSelect,
    unit: {
        select: {
            ...legacyUnitScalarSelect,
            investor: { select: legacyInvestorScalarSelect },
        },
    },
    costs: { select: legacyCostWithProofsSelect, orderBy: { date: "asc" } },
    profitSharing: { select: legacyProfitSharingSelect },
    paymentHistories: { select: legacyPaymentHistorySelect, orderBy: { paymentDate: "asc" } },
    proofs: { select: legacyTransactionProofSelect },
} satisfies Prisma.TransactionSelect

export const transactionMutationPreReadSelect = {
    unitId: true,
    buyPrice: true,
    initialInvestorCapital: true,
    initialManagerCapital: true,
    sellDate: true,
    sellPrice: true,
    status: true,
    unit: { select: {
        investorId: true,
        investor: { select: { marginPercentage: true } },
    } },
    costs: { select: {
        payer: true,
        amount: true,
    } },
    profitSharing: { select: {
        investorSharePercentage: true,
        managerSharePercentage: true,
    } },
} satisfies Prisma.TransactionSelect

export const transactionMutationResponseSelect = {
    ...legacyTransactionScalarSelect,
    costs: { select: legacyCostSelect },
    proofs: { select: legacyTransactionProofSelect },
} satisfies Prisma.TransactionSelect

export const paymentTransactionPreReadSelect = {
    unit: { select: { investorId: true } },
    profitSharing: { select: { investorProfitAmount: true } },
    paymentHistories: { select: {
        investorId: true,
        amount: true,
        paymentDate: true,
        method: true,
        proofImageUrl: true,
        notes: true,
    } },
} satisfies Prisma.TransactionSelect

export const paymentMutationReplaySelect = {
    ...legacyPaymentHistorySelect,
    transaction: { select: { paymentStatus: true } },
} satisfies Prisma.PaymentHistorySelect

export const transactionCreateActiveCheckSelect = {
    id: true,
} satisfies Prisma.TransactionSelect

export const transactionCreateResponseSelect = {
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

export const profitSharingPatchPreReadSelect = {
    netMargin: true,
} satisfies Prisma.ProfitSharingSelect

export const profitSharingPatchTransactionSelect = {
    paymentStatus: true,
    paymentHistories: { select: { amount: true } },
} satisfies Prisma.TransactionSelect

export const profitSharingPatchUpdateSelect = {
    id: true,
} satisfies Prisma.TransactionSelect

export const transactionDeletePreReadSelect = {
    transactionCode: true,
    unitId: true,
} satisfies Prisma.TransactionSelect

export const transactionDeleteMutationSelect = {
    id: true,
} satisfies Prisma.TransactionSelect

export const transactionDeleteBulkPreReadSelect = {
    id: true,
    unitId: true,
} satisfies Prisma.TransactionSelect

export const transactionDeleteRemainingSelect = {
    id: true,
} satisfies Prisma.TransactionSelect

export const unitDeleteMutationSelect = {
    id: true,
} satisfies Prisma.UnitSelect
