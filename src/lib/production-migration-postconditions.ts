export type ColumnInfo = { type: string; nullable: boolean; default: string | null }
export type MigrationRecord = { name: string; checksum: string; finished: boolean; rolledBack: boolean; appliedSteps: number }
export type EnumInfo = { name: string; labels: string[] }
export type CheckInfo = { table: string; name: string; expression: string }
export type ForeignKeyInfo = { table: string; name: string; column: string; referencedTable: string; referencedColumn: string; onDelete: string; onUpdate: string }
export type IndexInfo = { table: string; name: string; columns: string[]; primary: boolean; unique: boolean }

export type PostConditionInput = {
  migrationName: string
  migrationChecksum: string
  identityMatches: boolean
  migrationRecords: MigrationRecord[]
  prismaStatusUpToDate: boolean
  schemaDiffEmpty: boolean
  enums: EnumInfo[]
  tables: string[]
  investorCapitalLedgerOpenedAt: ColumnInfo
  transactionFinalizationVersion: ColumnInfo
  checks: CheckInfo[]
  foreignKeys: ForeignKeyInfo[]
  indexes: IndexInfo[]
  invariantFingerprintsMatch: boolean
}

export type PostConditionResult = { pass: boolean; failures: string[] }

const BASELINE = {
  name: "20260824000000_postgresql_baseline",
  checksum: "7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd",
}

export const LEDGER_SCHEMA_CONTRACT = {
  enums: [
    { name: "CapitalMovementDirection", labels: ["CREDIT", "DEBIT"] },
    { name: "CapitalMovementSource", labels: ["FINALIZATION", "ADMIN", "RECONCILIATION", "REVERSAL"] },
    { name: "CapitalMovementType", labels: ["CAPITAL_TOP_UP", "CAPITAL_WITHDRAWAL", "REALIZED_NORMAL_LOSS", "HISTORICAL_LOSS_ADJUSTMENT", "MANAGER_RISK_CAPITAL_CONTRIBUTION", "MANAGER_REPAYABLE_ADVANCE", "MANAGER_VOLUNTARY_CONTRIBUTION", "MANAGER_RESTITUTION", "ADMIN_ADJUSTMENT_INCREASE", "ADMIN_ADJUSTMENT_DECREASE", "REVERSAL"] },
    { name: "LedgerTreatment", labels: ["POSTED", "IN_OPENING_BALANCE", "PENDING_REVIEW", "REVERSED"] },
    { name: "LossResponsibility", labels: ["NORMAL_BUSINESS", "MANAGER_MISCONDUCT"] },
  ] satisfies EnumInfo[],
  tables: ["CapitalMovement", "TransactionLoss"],
  checks: [
    { table: "CapitalMovement", name: "CapitalMovement_amount_positive", expression: "amount > 0" },
    { table: "CapitalMovement", name: "CapitalMovement_no_self_reversal", expression: "reversesmovementid is null or reversesmovementid <> id" },
    { table: "Transaction", name: "Transaction_finalizationVersion_nonnegative", expression: "finalizationversion >= 0" },
    { table: "TransactionLoss", name: "TransactionLoss_finalizationVersion_nonnegative", expression: "finalizationversion >= 0" },
    { table: "TransactionLoss", name: "TransactionLoss_loss_amounts_nonnegative", expression: "grosslossamount >= 0 and investorlossamount >= 0 and managercapitallossamount >= 0 and managerliabilityamount >= 0" },
  ] satisfies CheckInfo[],
  foreignKeys: [
    { table: "CapitalMovement", name: "CapitalMovement_actorUserId_fkey", column: "actorUserId", referencedTable: "User", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "CapitalMovement", name: "CapitalMovement_investorId_fkey", column: "investorId", referencedTable: "Investor", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "CapitalMovement", name: "CapitalMovement_lossEventId_fkey", column: "lossEventId", referencedTable: "TransactionLoss", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "CapitalMovement", name: "CapitalMovement_reversesMovementId_fkey", column: "reversesMovementId", referencedTable: "CapitalMovement", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "CapitalMovement", name: "CapitalMovement_transactionId_fkey", column: "transactionId", referencedTable: "Transaction", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "CapitalMovement", name: "CapitalMovement_unitId_fkey", column: "unitId", referencedTable: "Unit", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "TransactionLoss", name: "TransactionLoss_determinedByUserId_fkey", column: "determinedByUserId", referencedTable: "User", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "TransactionLoss", name: "TransactionLoss_investorId_fkey", column: "investorId", referencedTable: "Investor", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "TransactionLoss", name: "TransactionLoss_transactionId_fkey", column: "transactionId", referencedTable: "Transaction", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
    { table: "TransactionLoss", name: "TransactionLoss_unitId_fkey", column: "unitId", referencedTable: "Unit", referencedColumn: "id", onDelete: "RESTRICT", onUpdate: "CASCADE" },
  ] satisfies ForeignKeyInfo[],
  indexes: [
    { table: "CapitalMovement", name: "CapitalMovement_idempotencyKey_key", columns: ["idempotencyKey"], primary: false, unique: true },
    { table: "CapitalMovement", name: "CapitalMovement_investorId_createdAt_idx", columns: ["investorId", "createdAt"], primary: false, unique: false },
    { table: "CapitalMovement", name: "CapitalMovement_investorId_effectiveAt_idx", columns: ["investorId", "effectiveAt"], primary: false, unique: false },
    { table: "CapitalMovement", name: "CapitalMovement_pkey", columns: ["id"], primary: true, unique: true },
    { table: "CapitalMovement", name: "CapitalMovement_reversesMovementId_key", columns: ["reversesMovementId"], primary: false, unique: true },
    { table: "CapitalMovement", name: "CapitalMovement_transactionId_idx", columns: ["transactionId"], primary: false, unique: false },
    { table: "TransactionLoss", name: "TransactionLoss_investorId_createdAt_idx", columns: ["investorId", "createdAt"], primary: false, unique: false },
    { table: "TransactionLoss", name: "TransactionLoss_pkey", columns: ["id"], primary: true, unique: true },
    { table: "TransactionLoss", name: "TransactionLoss_responsibility_ledgerTreatment_idx", columns: ["responsibility", "ledgerTreatment"], primary: false, unique: false },
    { table: "TransactionLoss", name: "TransactionLoss_transactionId_finalizationVersion_key", columns: ["transactionId", "finalizationVersion"], primary: false, unique: true },
    { table: "TransactionLoss", name: "TransactionLoss_unitId_createdAt_idx", columns: ["unitId", "createdAt"], primary: false, unique: false },
  ] satisfies IndexInfo[],
} as const

function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(canonicalObject).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  return JSON.stringify(canonicalObject(value))
}
function canonicalObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalObject)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalObject(item)]))
  return value
}

export function normalizeCheckExpression(value: string): string {
  return value.toLowerCase().replace(/::[a-z ]+/g, "").replace(/[()\"]/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Determine whether a migration record represents the resolve-adopted baseline.
 * A resolve-adopted baseline (via `prisma migrate resolve --applied`) has
 * `applied_steps_count = 0` instead of the normal `>= 1`. This is valid
 * ONLY when every field matches the known baseline contract exactly.
 */
function isResolveAdoptedBaseline(record: MigrationRecord): boolean {
  return (
    record.name === BASELINE.name &&
    record.checksum === BASELINE.checksum &&
    record.finished === true &&
    record.rolledBack === false &&
    record.appliedSteps === 0
  )
}

export function verifyPostConditions(input: PostConditionInput): PostConditionResult {
  const failures: string[] = []
  if (!input.identityMatches) failures.push("postcondition target identity differs from deploy target")

  // --- Migration record validation ---
  // Separate baseline from non-baseline records.
  const baselineRecords = input.migrationRecords.filter((r) => r.name === BASELINE.name)
  const nonBaselineRecords = input.migrationRecords.filter((r) => r.name !== BASELINE.name)

  // Baseline: must exist exactly once.
  if (baselineRecords.length !== 1) {
    failures.push("baseline migration record is not exactly one")
  } else {
    const baseline = baselineRecords[0]
    // The baseline is acceptable in two forms:
    //  1. Resolve-adopted: appliedSteps=0 (the baseline was adopted via `prisma migrate resolve --applied`)
    //  2. Normal: appliedSteps >= 1 (the baseline was applied normally)
    const resolveAdopted = isResolveAdoptedBaseline(baseline)
    const normalBaseline =
      baseline.name === BASELINE.name &&
      baseline.checksum === BASELINE.checksum &&
      baseline.finished === true &&
      baseline.rolledBack === false &&
      baseline.appliedSteps >= 1
    if (!resolveAdopted && !normalBaseline) {
      failures.push("baseline migration record does not match resolve-adopted or normal baseline contract")
    }
  }

  // Target migration: strict checks, no exceptions.
  const targetRecords = nonBaselineRecords.filter((r) => r.name === input.migrationName)
  if (targetRecords.length !== 1) {
    failures.push("target migration record count is not exactly one")
  } else {
    const target = targetRecords[0]
    if (target.checksum !== input.migrationChecksum) failures.push("target migration checksum mismatch")
    if (!target.finished) failures.push("target migration is not finished")
    if (target.rolledBack) failures.push("target migration is rolled back")
    if (target.appliedSteps < 1) failures.push("target migration applied_steps_count must be >= 1")
  }

  // Unexpected records: anything not baseline and not the target.
  const unexpectedRecords = nonBaselineRecords.filter((r) => r.name !== input.migrationName)
  if (unexpectedRecords.length > 0) failures.push("unexpected migration records found")
  if (!input.prismaStatusUpToDate) failures.push("Prisma migration status is not up to date")
  if (!input.schemaDiffEmpty) failures.push("canonical Prisma schema diff is not empty")

  if (canonical(input.enums) !== canonical(LEDGER_SCHEMA_CONTRACT.enums)) failures.push("exact enum contract mismatch")
  if (canonical(input.tables) !== canonical(LEDGER_SCHEMA_CONTRACT.tables)) failures.push("exact ledger table contract mismatch")
  if (canonical(input.investorCapitalLedgerOpenedAt) !== canonical({ type: "timestamp without time zone", nullable: true, default: null })) failures.push("capitalLedgerOpenedAt column contract mismatch")
  if (canonical(input.transactionFinalizationVersion) !== canonical({ type: "integer", nullable: false, default: "0" })) failures.push("finalizationVersion column contract mismatch")

  const checks = input.checks.map((check) => ({ ...check, expression: normalizeCheckExpression(check.expression) }))
  if (canonical(checks) !== canonical(LEDGER_SCHEMA_CONTRACT.checks)) failures.push("exact CHECK constraint contract mismatch")
  if (canonical(input.foreignKeys) !== canonical(LEDGER_SCHEMA_CONTRACT.foreignKeys)) failures.push("exact foreign-key contract mismatch")
  if (canonical(input.indexes) !== canonical(LEDGER_SCHEMA_CONTRACT.indexes)) failures.push("exact primary/unique/secondary index contract mismatch")
  if (!input.invariantFingerprintsMatch) failures.push("pre/post counts or primary-key fingerprints changed")
  return { pass: failures.length === 0, failures }
}

export type DeployEnvInput = { databaseUrl: string }
export type DeployEnvResult = { env: Record<string, string>; inheritedPgoptionsRejected: boolean }

export function buildDeployEnv(input: DeployEnvInput): DeployEnvResult {
  const url = new URL(input.databaseUrl)
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("BLOCKED: direct PostgreSQL URL required")
  const existing = url.searchParams.get("connect_timeout")
  if (existing !== null && (!/^\d+$/.test(existing) || Number(existing) < 1 || Number(existing) > 10)) throw new Error("BLOCKED: connect_timeout must be between 1 and 10 seconds")
  url.searchParams.set("connect_timeout", existing ?? "10")
  return {
    env: {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "production",
      DATABASE_URL: url.toString(),
      DIRECT_URL: url.toString(),
      PGOPTIONS: "-c lock_timeout=3000 -c statement_timeout=30000",
    },
    inheritedPgoptionsRejected: Boolean(process.env.PGOPTIONS?.trim()),
  }
}
