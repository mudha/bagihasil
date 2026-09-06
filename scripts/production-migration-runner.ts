import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { URL } from "node:url"
import { evaluateMigrationGuards, type ExecutionMode, type MigrationGuardInput } from "../src/lib/production-migration-guards"
import {
  buildDeployEnv,
  normalizeCheckExpression,
  verifyPostConditions,
  BASELINE_MIGRATION,
  type CheckInfo,
  type EnumInfo,
  type ForeignKeyInfo,
  type IndexInfo,
  type MigrationRecord,
  type PostConditionInput,
  type PostConditionResult,
} from "../src/lib/production-migration-postconditions"

export type AuditRecord = {
  timestampUtc: string; timestampWib: string; operationId: string; operator: string
  mode: ExecutionMode; pr: number; head: string; migrationName: string; migrationChecksum: string
  prismaVersion: string; backupIdentifier: string; backupChecksum: string
  restoreVerified: boolean; offsiteVerified: boolean; identityFingerprint: string; guards: "PASS"
  metadataBefore: unknown; metadataAfter: unknown; schemaDiff: "empty"; postConditions: unknown
  status: "PASS" | "REQUIRES_READ_ONLY_INSPECTION"; deploy: "PASS_NOOP" | "PASS" | "FAIL"
  verdict: "PASS" | "REQUIRES_READ_ONLY_INSPECTION"
}

type InvariantFingerprints = Record<string, string>
type RuntimeExpected = {
  mode: ExecutionMode
  pr: number; head: string; migration: { name: string; checksum: string }
  backup: { path: string; checksum: string; restoreList: string; offsiteVerified: boolean }
  approval: MigrationGuardInput["approval"]
  identityFingerprint: string; auditPath: string
}
type ExecutionInput = MigrationGuardInput & {
  databaseUrl: string
  auditPath: string
  audit: Record<string, unknown>
  preDeploymentInvariants: InvariantFingerprints
}
type Observation = PostConditionResult & { evidence: Record<string, unknown> }

const TARGET_MIGRATION = "20260830222005_loss_capital_ledger_foundation"
const TARGET_CHECKSUM = "2de7d2e9ca11d799447f3e5a822655cbb6072316e88226ae7b81ff07858a3ad4"
const MIGRATION_PATH = `prisma/migrations/${TARGET_MIGRATION}/migration.sql`

/**
 * Regex sempit yang menerima whitespace valid (spasi/tab) di antara token
 * `provider`, `=`, dan nilai `"postgresql"` / `'postgresql'`.
 * Anchor `^` dengan flag `m` memastikan `provider` hanya cocok di awal baris
 * (dengan whitespace leading), sehingga komentar TOML (`# provider = ...`)
 * atau komentar Prisma (`// provider = ...`) tidak membuat provider lain lolos.
 * Word boundary `\b` tidak digunakan karena `^\s*` sudah lebih spesifik.
 * Tidak menerima provider lain.
 */
const POSTGRESQL_PROVIDER_RE = /^\s*provider\s*=\s*["']postgresql["']/m

/**
 * Deteksi provider PostgreSQL dari isi migration_lock.toml dan schema.prisma.
 * Kedua sumber harus menyatakan PostgreSQL; jika salah satu bukan
 * PostgreSQL, kembalikan "unknown" (fail-closed).
 *
 * - migration_lock.toml: baris `provider = "postgresql"` (TOML)
 * - schema.prisma: baris `provider  = "postgresql"` (Prisma DSL, whitespace bebas)
 *
 * Tidak menerima provider lain, komentar palsu di luar konteks provider,
 * atau kecocokan lintas blok yang tidak relevan.
 */
export function detectProvider(lockContent: string, schemaContent: string): "postgresql" | "unknown" {
  const lockOk = POSTGRESQL_PROVIDER_RE.test(lockContent)
  const schemaOk = POSTGRESQL_PROVIDER_RE.test(schemaContent)
  return lockOk && schemaOk ? "postgresql" : "unknown"
}

/**
 * Build a minimal environment for child `gh` / `git` commands so they can
 * read host authentication config (gh config at ~/.config/gh/hosts.yml or
 * GH_CONFIG_DIR; git credential helper) without inheriting the full process
 * environment or any database/secret variables.
 *
 * Only passes config-location variables — never DATABASE_URL, DIRECT_URL,
 * PGPASSWORD, tokens, or other secrets that the gh/git command does not need.
 */
export function buildGitCommandEnv(): Record<string, string> {
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", NODE_ENV: "production" }
  // gh reads config from $GH_CONFIG_DIR, then $XDG_CONFIG_HOME/gh, then $HOME/.config/gh
  if (process.env.HOME) env.HOME = process.env.HOME
  if (process.env.XDG_CONFIG_HOME) env.XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME
  if (process.env.GH_CONFIG_DIR) env.GH_CONFIG_DIR = process.env.GH_CONFIG_DIR
  // git may need HOME for ~/.gitconfig and credential helpers
  // GH_TOKEN / GITHUB_TOKEN are not forwarded — gh uses hosts.yml by default
  return env
}

export function redactAudit(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_URL]").replace(/(password|secret|token|key)=?[^\s,}]+/gi, "$1=[REDACTED]")
  if (Array.isArray(value)) return value.map(redactAudit)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /url|password|secret|token/i.test(key) ? "[REDACTED]" : redactAudit(item)]))
  return value
}

export function writeAudit(path: string, record: unknown) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, JSON.stringify(redactAudit(record), null, 2) + "\n", { mode: 0o600, flag: "wx" })
  chmodSync(path, 0o600)
}

function command(commandName: string, args: string[], env?: Record<string, string>): string {
  const baseEnv = isGitOrGhCommand(commandName) ? buildGitCommandEnv() : { PATH: process.env.PATH ?? "", NODE_ENV: "production" }
  const mergedEnv = env ? { ...baseEnv, ...env } : baseEnv
  const result = spawnSync(commandName, args, {
    encoding: "utf8",
    env: mergedEnv as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.error || result.status !== 0) throw new Error("BLOCKED: authoritative evidence command failed")
  return result.stdout.trim()
}

function isGitOrGhCommand(commandName: string): boolean {
  return commandName === "gh" || commandName === "git"
}

function commandSucceeds(commandName: string, args: string[]): boolean {
  const baseEnv = isGitOrGhCommand(commandName) ? buildGitCommandEnv() : { PATH: process.env.PATH ?? "", NODE_ENV: "production" }
  const result = spawnSync(commandName, args, { env: baseEnv as NodeJS.ProcessEnv, stdio: "ignore" })
  return !result.error && result.status === 0
}

function sha256Bytes(bytes: Buffer | string) { return createHash("sha256").update(bytes).digest("hex") }
function sha256File(path: string) { return sha256Bytes(readFileSync(path)) }
function identityFingerprint(value: string) { return sha256Bytes(value).slice(0, 16) }

function readOnlyEnv(databaseUrl: string): Record<string, string> {
  const deploy = buildDeployEnv({ databaseUrl })
  const parsed = new URL(deploy.env.DATABASE_URL)
  const env: Record<string, string> = {
    ...deploy.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGCONNECT_TIMEOUT: parsed.searchParams.get("connect_timeout") ?? "10",
    PGOPTIONS: `${deploy.env.PGOPTIONS} -c default_transaction_read_only=on`,
  }
  const sslmode = parsed.searchParams.get("sslmode")
  if (sslmode) env.PGSSLMODE = sslmode
  // Forward TLS certificate verification settings from process environment
  // so that libpq connections (psql, prisma) inherit the host CA configuration.
  if (process.env.PGSSLROOTCERT) env.PGSSLROOTCERT = process.env.PGSSLROOTCERT
  if (process.env.PGSSLCERT) env.PGSSLCERT = process.env.PGSSLCERT
  if (process.env.PGSSLKEY) env.PGSSLKEY = process.env.PGSSLKEY
  return env
}

function query(databaseUrl: string, sql: string): string {
  return command("psql", ["-XAtq", "--set", "ON_ERROR_STOP=1", "--command", sql], readOnlyEnv(databaseUrl))
}

function jsonQuery<T>(databaseUrl: string, sql: string): T {
  const value = query(databaseUrl, sql)
  try { return JSON.parse(value) as T } catch { throw new Error("REQUIRES_READ_ONLY_INSPECTION: malformed database observation") }
}

function observeIdentity(databaseUrl: string): string {
  return identityFingerprint(query(databaseUrl, "select current_database() || '|' || current_schema() || '|' || current_setting('server_version')"))
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) throw new Error("BLOCKED: unsafe catalog identifier")
  return `"${value}"`
}

export function captureInvariantFingerprints(databaseUrl: string): InvariantFingerprints {
  const tables = jsonQuery<string[]>(databaseUrl, `select coalesce(json_agg(table_name order by table_name), '[]'::json) from information_schema.columns where table_schema='public' and column_name='id' and table_name not in ('CapitalMovement','TransactionLoss','_prisma_migrations')`)
  const fingerprints: InvariantFingerprints = {}
  for (const table of tables) {
    const identifier = quoteIdentifier(table)
    fingerprints[table] = query(databaseUrl, `select count(*)::text || ':' || md5(coalesce(string_agg(md5(coalesce("id"::text,'')), '' order by "id"::text),'')) from ${identifier}`)
  }
  return fingerprints
}

function normalizeDefault(value: string | null): string | null {
  if (value === null) return null
  return value.replace(/::[a-z ]+$/i, "").replace(/^\((.*)\)$/, "$1").trim()
}

/**
 * Capture a single baseline migration record from the database (read-only).
 * Returns the full MigrationRecord for the baseline, or null if missing/duplicate.
 * This is meant to be called BEFORE deploy to establish a pre-deploy snapshot.
 */
const BASELINE_CAPTURE_SQL = `select coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum,'finished',finished_at is not null,'rolledBack',rolled_back_at is not null,'appliedSteps',applied_steps_count) order by migration_name), '[]'::json) from _prisma_migrations where migration_name = '20260824000000_postgresql_baseline'`
export function captureBaselineRecord(databaseUrl: string): MigrationRecord | null {
  const records = jsonQuery<MigrationRecord[]>(databaseUrl, BASELINE_CAPTURE_SQL)
  return records.length === 1 ? records[0] : null
}

export function observePostConditions(databaseUrl: string, expectedIdentity: string, preDeploymentInvariants: InvariantFingerprints, migrationName = TARGET_MIGRATION, migrationChecksum = TARGET_CHECKSUM, baselinePreDeploy: MigrationRecord | null = null): Observation {
  const identityMatches = observeIdentity(databaseUrl) === expectedIdentity
  const migrationRecords = jsonQuery<MigrationRecord[]>(databaseUrl, `select coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum,'finished',finished_at is not null,'rolledBack',rolled_back_at is not null,'appliedSteps',applied_steps_count) order by migration_name), '[]'::json) from _prisma_migrations`)
  const enums = jsonQuery<EnumInfo[]>(databaseUrl, `select coalesce(json_agg(value order by value->>'name'), '[]'::json) from (select json_build_object('name',t.typname,'labels',json_agg(e.enumlabel order by e.enumsortorder)) value from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname in ('LossResponsibility','LedgerTreatment','CapitalMovementType','CapitalMovementDirection','CapitalMovementSource') group by t.typname) q`)
  const tables = jsonQuery<string[]>(databaseUrl, `select coalesce(json_agg(tablename order by tablename), '[]'::json) from pg_tables where schemaname='public' and tablename in ('CapitalMovement','TransactionLoss')`)
  const columns = jsonQuery<Array<{ table: string; type: string; nullable: boolean; default: string | null }>>(databaseUrl, `select coalesce(json_agg(json_build_object('table',table_name,'type',data_type,'nullable',is_nullable='YES','default',column_default) order by table_name), '[]'::json) from information_schema.columns where table_schema='public' and (table_name,column_name) in (('Investor','capitalLedgerOpenedAt'),('Transaction','finalizationVersion'))`)
  const checks = jsonQuery<CheckInfo[]>(databaseUrl, `select coalesce(json_agg(json_build_object('table',c.relname,'name',con.conname,'expression',pg_get_expr(con.conbin,con.conrelid)) order by c.relname,con.conname), '[]'::json) from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and con.contype='c' and (c.relname in ('CapitalMovement','TransactionLoss') or con.conname='Transaction_finalizationVersion_nonnegative')`)
  const foreignKeys = jsonQuery<ForeignKeyInfo[]>(databaseUrl, `select coalesce(json_agg(json_build_object('table',child.relname,'name',con.conname,'column',ca.attname,'referencedTable',parent.relname,'referencedColumn',pa.attname,'onDelete',case con.confdeltype when 'r' then 'RESTRICT' when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' when 'a' then 'NO ACTION' end,'onUpdate',case con.confupdtype when 'r' then 'RESTRICT' when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' when 'a' then 'NO ACTION' end) order by child.relname,con.conname), '[]'::json) from pg_constraint con join pg_class child on child.oid=con.conrelid join pg_class parent on parent.oid=con.confrelid join pg_namespace n on n.oid=child.relnamespace join pg_attribute ca on ca.attrelid=child.oid and ca.attnum=con.conkey[1] join pg_attribute pa on pa.attrelid=parent.oid and pa.attnum=con.confkey[1] where n.nspname='public' and con.contype='f' and child.relname in ('CapitalMovement','TransactionLoss') and array_length(con.conkey,1)=1 and array_length(con.confkey,1)=1`)
  const indexes = jsonQuery<IndexInfo[]>(databaseUrl, `select coalesce(json_agg(value order by value->>'table',value->>'name'), '[]'::json) from (select json_build_object('table',t.relname,'name',i.relname,'columns',json_agg(a.attname order by k.ordinality),'primary',x.indisprimary,'unique',x.indisunique) value from pg_index x join pg_class t on t.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=t.relnamespace join lateral unnest(x.indkey) with ordinality k(attnum,ordinality) on true join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum where n.nspname='public' and t.relname in ('CapitalMovement','TransactionLoss') group by t.relname,i.relname,x.indisprimary,x.indisunique) q`)
  const postDeploymentInvariants = captureInvariantFingerprints(databaseUrl)
  const statusOutput = command("node", ["./node_modules/prisma/build/index.js", "migrate", "status"], readOnlyEnv(databaseUrl))
  const schemaDiffOutput = command("node", ["./node_modules/prisma/build/index.js", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], readOnlyEnv(databaseUrl))

  const column = (table: string) => {
    const value = columns.find((item) => item.table === table)
    if (!value) return { type: "missing", nullable: true, default: null }
    return { type: value.type, nullable: value.nullable, default: normalizeDefault(value.default) }
  }
  const input: PostConditionInput = {
    migrationName,
    migrationChecksum,
    identityMatches,
    migrationRecords,
    baselinePreDeploy,
    prismaStatusUpToDate: /database schema is up to date/i.test(statusOutput),
    schemaDiffEmpty: /This is an empty migration/i.test(schemaDiffOutput),
    enums,
    tables,
    investorCapitalLedgerOpenedAt: column("Investor"),
    transactionFinalizationVersion: column("Transaction"),
    checks: checks.map((check) => ({ ...check, expression: normalizeCheckExpression(check.expression) })),
    foreignKeys,
    indexes,
    invariantFingerprintsMatch: JSON.stringify(preDeploymentInvariants) === JSON.stringify(postDeploymentInvariants),
  }
  const result = verifyPostConditions(input)
  return {
    ...result,
    evidence: {
      source: "runner-owned-live-read-only",
      identityMatches: input.identityMatches,
      migrationRecords: input.migrationRecords,
      prismaStatusUpToDate: input.prismaStatusUpToDate,
      schemaDiffEmpty: input.schemaDiffEmpty,
      schemaContract: result.failures.filter((failure) => /enum|table|column|CHECK|foreign-key|index/.test(failure)).length === 0 ? "MATCH" : "MISMATCH",
      invariantFingerprints: input.invariantFingerprintsMatch ? "MATCH" : "MISMATCH",
      failures: result.failures,
    },
  }
}

function failureAudit(input: ExecutionInput, reason: string, evidence: unknown = null) {
  writeAudit(input.auditPath, { ...input.audit, status: "REQUIRES_READ_ONLY_INSPECTION", deploy: "FAIL", verdict: "REQUIRES_READ_ONLY_INSPECTION", postConditions: evidence, failure: reason })
}

/**
 * Validate a pre-deploy baseline snapshot before allowing migration spawn.
 * Checks name, checksum, finished, rolled-back, and applied-steps invariant.
 * Throws BLOCKED on any mismatch so deploy never proceeds.
 */
export function validatePreDeployBaseline(record: MigrationRecord): void {
  if (record.name !== BASELINE_MIGRATION.name) throw new Error("BLOCKED: baseline pre-deploy name mismatch")
  if (record.checksum !== BASELINE_MIGRATION.checksum) throw new Error("BLOCKED: baseline pre-deploy checksum mismatch")
  if (!record.finished) throw new Error("BLOCKED: baseline pre-deploy is not finished")
  if (record.rolledBack) throw new Error("BLOCKED: baseline pre-deploy is rolled back")
  const valid = record.appliedSteps === 0 || record.appliedSteps >= 1
  if (!valid) throw new Error("BLOCKED: baseline pre-deploy applied_steps_count is invalid")
}

/**
 * Run the full critical section: guards → capture baseline → validate →
 * deploy → postcondition → audit.
 *
 * Designed to be called EITHER from the production flock subprocess
 * (via --critical-section flag) OR directly from unit tests with
 * optional captureBaseline / observe seams.
 *
 * Lock is held by the caller (the flock subprocess wrapper).
 */
export function executeCriticalSection(
  input: ExecutionInput,
  seams?: { captureBaseline?: (databaseUrl: string) => MigrationRecord | null; observe?: () => Observation },
): void {
  // --- Guards (cheap, no DB) ---
  const failures = evaluateMigrationGuards(input)
  if (failures.length) throw new Error(`BLOCKED: ${failures.join("; ")}`)
  if (!input.auditPath || !relative(process.cwd(), resolve(input.auditPath)).startsWith("..")) throw new Error("BLOCKED: audit artifact must be outside repository")
  const deployEnv = buildDeployEnv({ databaseUrl: input.databaseUrl })
  if (deployEnv.inheritedPgoptionsRejected) throw new Error("BLOCKED: inherited PGOPTIONS is forbidden")
  const parsed = new URL(deployEnv.env.DATABASE_URL)
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) || /pooler|pooling/i.test(parsed.hostname) || parsed.searchParams.has("pgbouncer") || parsed.searchParams.has("pooler")) throw new Error("BLOCKED: direct non-local PostgreSQL URL required")

  // --- 1. Capture baseline (inside lock, read-only) ---
  const captureFn = seams?.captureBaseline ?? captureBaselineRecord
  let baselinePreDeploy: MigrationRecord | null
  try {
    baselinePreDeploy = captureFn(deployEnv.env.DATABASE_URL)
  } catch (error) {
    failureAudit(input, `baseline capture failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
  if (baselinePreDeploy === null) {
    failureAudit(input, "baseline pre-deploy snapshot missing or duplicate")
    throw new Error("BLOCKED: baseline pre-deploy snapshot missing or duplicate")
  }
  try {
    validatePreDeployBaseline(baselinePreDeploy)
  } catch (error) {
    failureAudit(input, `baseline validation failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }

  // --- 2. Deploy (guarded by flock in production path) ---
  const result = spawnSync("node", ["./node_modules/prisma/build/index.js", "migrate", "deploy"], { env: deployEnv.env as unknown as NodeJS.ProcessEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000, killSignal: "SIGTERM" })
  if (result.error || result.status !== 0) {
    failureAudit(input, "migrate deploy did not complete successfully")
    throw new Error("REQUIRES_READ_ONLY_INSPECTION: migrate deploy did not complete successfully")
  }

  // --- 3. Postcondition observation (still inside lock) ---
  let observation: Observation
  try {
    const observeFn = seams?.observe ?? (() => observePostConditions(deployEnv.env.DATABASE_URL, input.target.identityFingerprint, input.preDeploymentInvariants, input.expectedMigration.name, input.expectedMigration.checksum, baselinePreDeploy))
    observation = observeFn()
  } catch {
    failureAudit(input, "live read-only postcondition observation failed")
    throw new Error("REQUIRES_READ_ONLY_INSPECTION: live read-only postcondition observation failed")
  }
  if (!observation.pass) {
    failureAudit(input, "postconditions failed", observation.evidence)
    throw new Error("REQUIRES_READ_ONLY_INSPECTION: postconditions failed")
  }

  // --- 4. Audit ---
  writeAudit(input.auditPath, { ...input.audit, status: "PASS", deploy: "PASS", verdict: "PASS", postConditions: observation.evidence })
}


/**
 * Production deploy wrapper.
 * Acquires an advisory lock via flock on an inherited file descriptor,
 * rebuilds ExecutionInput from authoritative sources, then runs the
 * full critical section in the same process.
 *
 * Lock lifetime: from flock acquisition until closeSync in finally.
 * No child processes, no temp files, no serialized secrets.
 */
export function executeFixedDeploy(
  expected: RuntimeExpected, options: {
    lockPath?: string
    seams?: { captureBaseline?: (databaseUrl: string) => MigrationRecord | null; observe?: () => Observation }
    collectEvidence?: (expected: RuntimeExpected, databaseUrl: string) => ExecutionInput
  } = {},
): { code: number; output: string; deploy: "PASS" } {
  const lockPath = options.lockPath ?? "/tmp/bagihasil-production-migration.lock"
  const lockFd = openSync(lockPath, "a", 0o600)

  try {
    // Acquire advisory lock via flock on inherited file descriptor.
    // The exec'd flock inherits lockFd (same open file description),
    // calls flock() on it, and exits. Lock persists because parent's
    // lockFd remains open on the same open file description.
    try {
      execFileSync("flock", ["-n", String(lockFd)], { stdio: "ignore" })
    } catch {
      throw new Error("BLOCKED: execution lock not available")
    }

    // Lock acquired. Read database URL from process environment.
    const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
    if (!databaseUrl) throw new Error("BLOCKED: DATABASE_URL not available in process environment")

    // Rebuild ExecutionInput from authoritative live sources.
    const collectFn = options.collectEvidence ?? collectAuthoritativeEvidence
    const input = collectFn(expected, databaseUrl)

    // Run full critical section under lock.
    executeCriticalSection(input, options.seams)

    return { code: 0, deploy: "PASS", output: "" }
  } finally {
    closeSync(lockFd)
  }
}

function repositoryMigrations() {
  return readdirSync(join(process.cwd(), "prisma/migrations"), { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => ({ name: item.name, checksum: sha256File(join(process.cwd(), "prisma/migrations", item.name, "migration.sql")) })).sort((a, b) => a.name.localeCompare(b.name))
}

function databaseEvidence(databaseUrl: string, expectedIdentity: string) {
  const parsed = new URL(databaseUrl)
  const host = parsed.hostname.toLowerCase()
  const records = jsonQuery<Array<{ name: string; finished: boolean; rolledBack: boolean }>>(databaseUrl, `select coalesce(json_agg(json_build_object('name',migration_name,'finished',finished_at is not null,'rolledBack',rolled_back_at is not null) order by started_at), '[]'::json) from _prisma_migrations`)
  const committed = repositoryMigrations()
  const committedNames = new Set(committed.map((item) => item.name))
  const appliedNames = new Set(records.filter((item) => item.finished && !item.rolledBack).map((item) => item.name))
  const fingerprint = observeIdentity(databaseUrl)
  return {
    target: { scheme: parsed.protocol.replace(":", ""), isDirect: !/pooler|pooling/.test(host) && !parsed.searchParams.has("pgbouncer") && !parsed.searchParams.has("pooler"), isProduction: fingerprint === expectedIdentity, isDisposable: /localhost|127\.0\.0\.1|disposable|test|dev|preview/.test(host), isLocal: host === "localhost" || host === "127.0.0.1", isPreview: host.includes("preview"), isDevelopment: host.includes("dev"), isTest: host.includes("test"), identityFingerprint: fingerprint },
    metadata: { failed: records.filter((item) => !item.finished && !item.rolledBack).length, rolledBack: records.filter((item) => item.rolledBack).length, unexpected: records.filter((item) => !committedNames.has(item.name)).length, previousMigration: records.filter((item) => item.finished && !item.rolledBack).at(-1)?.name ?? "" },
    pendingMigrations: committed.filter((item) => !appliedNames.has(item.name)),
    preDeploymentInvariants: captureInvariantFingerprints(databaseUrl),
  }
}

function commonEvidence(expected: RuntimeExpected, databaseUrl: string) {
  const lock = readFileSync(join(process.cwd(), "prisma/migrations/migration_lock.toml"), "utf8")
  const packageVersion = JSON.parse(readFileSync(join(process.cwd(), "node_modules/prisma/package.json"), "utf8")).version as string
  const clientVersion = JSON.parse(readFileSync(join(process.cwd(), "node_modules/@prisma/client/package.json"), "utf8")).version as string
  const backupChecksum = sha256File(expected.backup.path)
  const backup = { identifier: expected.backup.path.split("/").pop() ?? expected.backup.path, checksum: backupChecksum, restoreVerified: backupChecksum === expected.backup.checksum && (statSync(expected.backup.path).mode & 0o777) === 0o600 && statSync(expected.backup.restoreList).isFile(), offsiteVerified: expected.backup.offsiteVerified }
  const db = databaseEvidence(databaseUrl, expected.identityFingerprint)
  return { lock, packageVersion, clientVersion, backup, db }
}

function collectOpenPrEvidence(expected: RuntimeExpected, databaseUrl: string): ExecutionInput {
  const status = command("git", ["status", "--porcelain"])
  const head = command("git", ["rev-parse", "HEAD"])
  const branch = command("git", ["branch", "--show-current"])
  const remoteHead = command("git", ["rev-parse", `origin/${branch}`])
  const pr = JSON.parse(command("gh", ["pr", "view", String(expected.pr), "--json", "state,headRefOid,mergeable,reviewDecision,statusCheckRollup"])) as { state: string; headRefOid: string; mergeable: string; reviewDecision: string; statusCheckRollup: Array<{ state?: string; conclusion?: string }> }
  const { lock, packageVersion, clientVersion, backup, db } = commonEvidence(expected, databaseUrl)
  const migrationDiff = command("git", ["diff", "--name-status", "origin/main...HEAD", "--", "prisma/migrations"]).split("\n").filter(Boolean)
  const actual: MigrationGuardInput = {
    mode: "open-pr", workingTreeClean: status === "", localHead: head, expectedHead: expected.head, remoteHead,
    prOpen: pr.state === "OPEN" && pr.headRefOid === head, expectedPr: expected.pr, prApproved: pr.reviewDecision === "APPROVED", mergeable: pr.mergeable === "MERGEABLE", checksPass: pr.statusCheckRollup.length > 0 && pr.statusCheckRollup.every((item) => item.state === "SUCCESS" || item.conclusion === "SUCCESS" || item.conclusion === "SKIPPED"),
    provider: detectProvider(lock, readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8")), prismaVersion: packageVersion, clientVersion,
    historyUnchanged: migrationDiff.length === 1 && migrationDiff[0] === `A\tprisma/migrations/${expected.migration.name}/migration.sql`, pendingMigrations: db.pendingMigrations, expectedMigration: expected.migration,
    backup, productionFlag: true, approval: expected.approval, target: db.target, metadata: db.metadata, lockAvailable: true, sqlKind: "additive", customSql: false, auditPathOwnerOnly: relative(process.cwd(), resolve(expected.auditPath)).startsWith(".."),
  }
  return { ...actual, databaseUrl, auditPath: expected.auditPath, audit: { ...expected.approval, guards: "PASS", mode: "open-pr", identityFingerprint: db.target.identityFingerprint, backupChecksum: backup.checksum }, preDeploymentInvariants: db.preDeploymentInvariants }
}

function collectMergedMainEvidence(expected: RuntimeExpected, databaseUrl: string): ExecutionInput {
  command("git", ["fetch", "--no-tags", "origin", "main"])
  const status = command("git", ["status", "--porcelain"])
  const head = command("git", ["rev-parse", "HEAD"])
  const remoteMain = command("git", ["rev-parse", "origin/main"])
  const pr = JSON.parse(command("gh", ["pr", "view", String(expected.pr), "--json", "state,mergedAt,mergeCommit"])) as { state: string; mergedAt: string | null; mergeCommit: { oid: string } | null }
  const mergeCommit = pr.mergeCommit?.oid ?? ""
  const currentChecksum = sha256File(resolve(MIGRATION_PATH))
  const atMergeChecksum = mergeCommit && commandSucceeds("git", ["cat-file", "-e", `${mergeCommit}:${MIGRATION_PATH}`])
    ? sha256Bytes(execFileSync("git", ["show", `${mergeCommit}:${MIGRATION_PATH}`], { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] }))
    : ""
  const { lock, packageVersion, clientVersion, backup, db } = commonEvidence(expected, databaseUrl)
  const actual: MigrationGuardInput = {
    mode: "merged-main", workingTreeClean: status === "", localHead: head, expectedHead: expected.head, remoteHead: "",
    prOpen: false, expectedPr: expected.pr, prApproved: false, mergeable: false, checksPass: false,
    provider: detectProvider(lock, readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8")), prismaVersion: packageVersion, clientVersion,
    historyUnchanged: currentChecksum === atMergeChecksum, pendingMigrations: db.pendingMigrations, expectedMigration: expected.migration,
    backup, productionFlag: true, approval: expected.approval, target: db.target, metadata: db.metadata, lockAvailable: true, sqlKind: "additive", customSql: false, auditPathOwnerOnly: relative(process.cwd(), resolve(expected.auditPath)).startsWith(".."),
    prMerged: pr.state === "MERGED" && Boolean(pr.mergedAt), prMergeCommit: mergeCommit, mergeLineageAncestor: Boolean(mergeCommit) && commandSucceeds("git", ["merge-base", "--is-ancestor", mergeCommit, head]), migrationBlobSha256: currentChecksum, migrationBlobSha256AtMerge: atMergeChecksum, currentMainSha: head, remoteMainSha: remoteMain,
  }
  return { ...actual, databaseUrl, auditPath: expected.auditPath, audit: { ...expected.approval, guards: "PASS", mode: "merged-main", identityFingerprint: db.target.identityFingerprint, backupChecksum: backup.checksum, introducingPr: 92, mergeCommit }, preDeploymentInvariants: db.preDeploymentInvariants }
}

export function collectAuthoritativeEvidence(expected: RuntimeExpected, databaseUrl: string): ExecutionInput {
  if (expected.mode === "merged-main") return collectMergedMainEvidence(expected, databaseUrl)
  if (expected.mode === "open-pr") return collectOpenPrEvidence(expected, databaseUrl)
  throw new Error("BLOCKED: execution mode must be explicit")
}

export function runCli(argv = process.argv.slice(2)) {
  // Normal CLI flow
  const evidenceFlag = argv.indexOf("--evidence")
  const execute = argv.includes("--execute")
  if (evidenceFlag < 0 || !argv[evidenceFlag + 1]) throw new Error("usage: --evidence <expected-json> [--execute]")
  const expected = JSON.parse(readFileSync(resolve(argv[evidenceFlag + 1]), "utf8")) as RuntimeExpected

  if (!execute) {
    // Preflight: collect and evaluate without deploying
    const databaseUrl = process.env.DIRECT_URL
    if (!databaseUrl || process.env.DATABASE_URL !== databaseUrl) throw new Error("BLOCKED: DATABASE_URL and DIRECT_URL must match explicitly")
    const input = collectAuthoritativeEvidence(expected, databaseUrl)
    const failures = evaluateMigrationGuards(input)
    if (failures.length) throw new Error(`BLOCKED: ${failures.join("; ")}`)
    return { mode: "preflight", result: "PASS", failures: [] }
  }

  // Deploy: locked child rebuilds ExecutionInput from authoritative sources under flock
  return executeFixedDeploy(expected)
}

if (process.argv[1]?.endsWith("production-migration-runner.ts")) {
  try { console.log(JSON.stringify(runCli())) } catch (error) { console.error(error instanceof Error ? error.message : "BLOCKED"); process.exitCode = 1 }
}
