export type ColumnInfo = {
  type: string
  nullable: boolean
  defaultIsNull?: boolean
  default?: string
}

export type PostConditionInput = {
  migrationName: string
  migrationChecksum: string
  migrationRecordCount: number
  migrationStatus: string
  migrationRolledBack: boolean
  migrationChecksumPresent: boolean
  failedCount: number
  rolledBackCount: number
  pendingCount: number
  totalMigrations: number
  expectedBaseline: string
  enumCount: number
  ledgerTableCount: number
  investorCapitalLedgerOpenedAt: ColumnInfo
  transactionFinalizationVersion: ColumnInfo
  checkConstraintCount: number
  fkCount: number
  ledgerIndexCount: number
  matchExpected: boolean
}

export type PostConditionResult = {
  pass: boolean
  failures: string[]
}

// Declarative expectations bound to migration checksum
const EXPECTED_ENUM_COUNT = 5
const EXPECTED_LEDGER_TABLE_COUNT = 2
const EXPECTED_CHECK_COUNT = 5
const EXPECTED_FK_COUNT = 10
const EXPECTED_LEDGER_INDEX_COUNT = 11

export function verifyPostConditions(input: PostConditionInput): PostConditionResult {
  const failures: string[] = []

  // Migration metadata
  if (input.migrationRecordCount !== 1) failures.push("migration record count is not 1")
  if (input.migrationStatus !== "finished") failures.push("migration is not finished")
  if (input.migrationRolledBack) failures.push("migration is rolled back")
  if (!input.migrationChecksumPresent) failures.push("migration checksum is missing")

  // Migration health
  if (input.failedCount > 0 || input.rolledBackCount > 0) failures.push("failed/unfinished migration records exist")
  if (input.pendingCount > 0) failures.push("unexpected pending migrations found")

  // Schema objects: enums
  if (input.enumCount !== EXPECTED_ENUM_COUNT) failures.push(`enum count is ${input.enumCount}, expected ${EXPECTED_ENUM_COUNT}`)

  // Schema objects: ledger tables
  if (input.ledgerTableCount !== EXPECTED_LEDGER_TABLE_COUNT) failures.push(`ledger table count is ${input.ledgerTableCount}, expected ${EXPECTED_LEDGER_TABLE_COUNT}`)

  // Column contracts
  if (input.investorCapitalLedgerOpenedAt.type !== "timestamp without time zone") failures.push("capitalLedgerOpenedAt type mismatch")
  if (!input.investorCapitalLedgerOpenedAt.nullable) failures.push("capitalLedgerOpenedAt should be nullable")
  if (!input.investorCapitalLedgerOpenedAt.defaultIsNull) failures.push("capitalLedgerOpenedAt default should be null")

  if (input.transactionFinalizationVersion.type !== "integer") failures.push("finalizationVersion type mismatch")
  if (input.transactionFinalizationVersion.nullable !== false) failures.push("finalizationVersion should be NOT NULL")
  if (input.transactionFinalizationVersion.default !== "0") failures.push("finalizationVersion default should be 0")

  // Constraint counts
  if (input.checkConstraintCount !== EXPECTED_CHECK_COUNT) failures.push(`CHECK constraint count is ${input.checkConstraintCount}, expected ${EXPECTED_CHECK_COUNT}`)
  if (input.fkCount !== EXPECTED_FK_COUNT) failures.push(`FK count is ${input.fkCount}, expected ${EXPECTED_FK_COUNT}`)
  if (input.ledgerIndexCount !== EXPECTED_LEDGER_INDEX_COUNT) failures.push(`ledger index count is ${input.ledgerIndexCount}, expected ${EXPECTED_LEDGER_INDEX_COUNT}`)

  // Aggregate match
  if (!input.matchExpected) failures.push("aggregate counts/fingerprints do not match pre-migration snapshot")

  return { pass: failures.length === 0, failures }
}

export type DeployEnvInput = {
  databaseUrl: string
}

export type DeployEnvResult = {
  env: Record<string, string>
  inheritedPgoptionsRejected: boolean
}

const LOCK_TIMEOUT = "3000"
const STATEMENT_TIMEOUT = "30000"

export function buildDeployEnv(input: DeployEnvInput): DeployEnvResult {
  let inheritedPgoptionsRejected = false
  const inheritedPgoptions = process.env.PGOPTIONS
  if (inheritedPgoptions && inheritedPgoptions.trim().length > 0) {
    inheritedPgoptionsRejected = true
  }

  const pgoptions = `-c lock_timeout=${LOCK_TIMEOUT} -c statement_timeout=${STATEMENT_TIMEOUT}`

  return {
    env: {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "production",
      DATABASE_URL: input.databaseUrl,
      DIRECT_URL: input.databaseUrl,
      PGOPTIONS: pgoptions,
    },
    inheritedPgoptionsRejected,
  }
}
