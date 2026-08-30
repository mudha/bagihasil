-- CreateEnum
CREATE TYPE "LossResponsibility" AS ENUM ('NORMAL_BUSINESS', 'MANAGER_MISCONDUCT');

-- CreateEnum
CREATE TYPE "LedgerTreatment" AS ENUM ('POSTED', 'IN_OPENING_BALANCE', 'PENDING_REVIEW', 'REVERSED');

-- CreateEnum
CREATE TYPE "CapitalMovementType" AS ENUM (
    'CAPITAL_TOP_UP',
    'CAPITAL_WITHDRAWAL',
    'REALIZED_NORMAL_LOSS',
    'HISTORICAL_LOSS_ADJUSTMENT',
    'MANAGER_RISK_CAPITAL_CONTRIBUTION',
    'MANAGER_REPAYABLE_ADVANCE',
    'MANAGER_VOLUNTARY_CONTRIBUTION',
    'MANAGER_RESTITUTION',
    'ADMIN_ADJUSTMENT_INCREASE',
    'ADMIN_ADJUSTMENT_DECREASE',
    'REVERSAL'
);

-- CreateEnum
CREATE TYPE "CapitalMovementDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "CapitalMovementSource" AS ENUM ('FINALIZATION', 'ADMIN', 'RECONCILIATION', 'REVERSAL');

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN "capitalLedgerOpenedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "finalizationVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TransactionLoss" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "finalizationVersion" INTEGER NOT NULL,
    "investorId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "grossLossAmount" DECIMAL(18,0) NOT NULL,
    "investorLossAmount" DECIMAL(18,0) NOT NULL,
    "managerCapitalLossAmount" DECIMAL(18,0) NOT NULL,
    "managerLiabilityAmount" DECIMAL(18,0) NOT NULL,
    "responsibility" "LossResponsibility" NOT NULL,
    "ledgerTreatment" "LedgerTreatment" NOT NULL,
    "reason" TEXT,
    "determinedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionLoss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalMovement" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "transactionId" TEXT,
    "unitId" TEXT,
    "lossEventId" TEXT,
    "type" "CapitalMovementType" NOT NULL,
    "amount" DECIMAL(18,0) NOT NULL,
    "direction" "CapitalMovementDirection" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "source" "CapitalMovementSource" NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reversesMovementId" TEXT,

    CONSTRAINT "CapitalMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLoss_transactionId_finalizationVersion_key"
    ON "TransactionLoss"("transactionId", "finalizationVersion");

-- CreateIndex
CREATE INDEX "TransactionLoss_investorId_createdAt_idx"
    ON "TransactionLoss"("investorId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionLoss_unitId_createdAt_idx"
    ON "TransactionLoss"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionLoss_responsibility_ledgerTreatment_idx"
    ON "TransactionLoss"("responsibility", "ledgerTreatment");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalMovement_idempotencyKey_key"
    ON "CapitalMovement"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalMovement_reversesMovementId_key"
    ON "CapitalMovement"("reversesMovementId");

-- CreateIndex
CREATE INDEX "CapitalMovement_investorId_effectiveAt_idx"
    ON "CapitalMovement"("investorId", "effectiveAt");

-- CreateIndex
CREATE INDEX "CapitalMovement_investorId_createdAt_idx"
    ON "CapitalMovement"("investorId", "createdAt");

-- CreateIndex
CREATE INDEX "CapitalMovement_transactionId_idx"
    ON "CapitalMovement"("transactionId");

-- AddCheckConstraint
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_finalizationVersion_nonnegative"
    CHECK ("finalizationVersion" >= 0);

-- AddCheckConstraint
ALTER TABLE "TransactionLoss"
    ADD CONSTRAINT "TransactionLoss_finalizationVersion_nonnegative"
    CHECK ("finalizationVersion" >= 0);

-- AddCheckConstraint
ALTER TABLE "TransactionLoss"
    ADD CONSTRAINT "TransactionLoss_loss_amounts_nonnegative"
    CHECK (
        "grossLossAmount" >= 0
        AND "investorLossAmount" >= 0
        AND "managerCapitalLossAmount" >= 0
        AND "managerLiabilityAmount" >= 0
    );

-- AddCheckConstraint
ALTER TABLE "CapitalMovement"
    ADD CONSTRAINT "CapitalMovement_amount_positive"
    CHECK ("amount" > 0);

-- AddForeignKey
ALTER TABLE "TransactionLoss"
    ADD CONSTRAINT "TransactionLoss_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLoss"
    ADD CONSTRAINT "TransactionLoss_investorId_fkey"
    FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLoss"
    ADD CONSTRAINT "TransactionLoss_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLoss"
    ADD CONSTRAINT "TransactionLoss_determinedByUserId_fkey"
    FOREIGN KEY ("determinedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalMovement"
    ADD CONSTRAINT "CapitalMovement_investorId_fkey"
    FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalMovement"
    ADD CONSTRAINT "CapitalMovement_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalMovement"
    ADD CONSTRAINT "CapitalMovement_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalMovement"
    ADD CONSTRAINT "CapitalMovement_lossEventId_fkey"
    FOREIGN KEY ("lossEventId") REFERENCES "TransactionLoss"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalMovement"
    ADD CONSTRAINT "CapitalMovement_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalMovement"
    ADD CONSTRAINT "CapitalMovement_reversesMovementId_fkey"
    FOREIGN KEY ("reversesMovementId") REFERENCES "CapitalMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
