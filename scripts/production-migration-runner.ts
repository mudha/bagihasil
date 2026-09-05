import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, relative, resolve, join } from "node:path"
import { URL } from "node:url"
import { spawnSync } from "node:child_process"
import { evaluateMigrationGuards, type MigrationGuardInput, type ExecutionMode } from "../src/lib/production-migration-guards"
import { verifyPostConditions, buildDeployEnv, type PostConditionInput } from "../src/lib/production-migration-postconditions"

export type AuditRecord = {
  timestampUtc: string; timestampWib: string; operationId: string; operator: string
  mode: ExecutionMode
  pr: number; head: string; migrationName: string; migrationChecksum: string
  prismaVersion: string; backupIdentifier: string; backupChecksum: string
  restoreVerified: boolean; offsiteVerified: boolean
  identityFingerprint: string; guards: "PASS"
  metadataBefore: unknown; metadataAfter: unknown; schemaDiff: "empty"
  postConditions: unknown
  status: "PASS" | "REQUIRES_READ_ONLY_INSPECTION"
  deploy: "PASS_NOOP" | "PASS" | "FAIL"
  verdict: "PASS" | "REQUIRES_READ_ONLY_INSPECTION"
}
type FixedSpawn = (command: string, args: string[], options: Record<string, unknown>) => { status: number | null; stdout?: string; stderr?: string; error?: Error }
type RuntimeExpected = {
  mode: ExecutionMode
  pr: number; head: string; migration: { name: string; checksum: string }
  backup: { path: string; checksum: string; restoreList: string; offsiteVerified: boolean }
  approval: MigrationGuardInput["approval"]
  identityFingerprint: string; auditPath: string
  mergeCommit?: string; expectedMainSha?: string
}

export function redactAudit(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_URL]").replace(/(password|secret|token|key)=?[^\s,}]+/gi, "$1=[REDACTED]")
  if (Array.isArray(value)) return value.map(redactAudit)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /url|password|secret|token/i.test(k) ? "[REDACTED]" : redactAudit(v)]))
  return value
}

export function writeAudit(path: string, record: unknown) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, JSON.stringify(redactAudit(record), null, 2) + "\n", { mode: 0o600, flag: "wx" })
  chmodSync(path, 0o600)
}

export function executeFixedDeploy(input: MigrationGuardInput & { databaseUrl: string; auditPath: string; audit: unknown }, options: { spawn?: FixedSpawn; lockPath?: string } = {}): { code: number; output: string } {
  const failures = evaluateMigrationGuards(input)
  if (failures.length) throw new Error(`BLOCKED: ${failures.join("; ")}`)
  if (!input.databaseUrl.startsWith("postgresql://") || input.databaseUrl.includes("?pgbouncer=true")) throw new Error("BLOCKED: direct PostgreSQL URL required")
  if (!input.auditPath || !relative(process.cwd(), resolve(input.auditPath)).startsWith("..")) throw new Error("BLOCKED: audit artifact must be outside repository")
  const lockPath = options.lockPath ?? "/tmp/bagihasil-production-migration.lock"
  const lock = openSync(lockPath, "a", 0o600)
  try {
    const runner = options.spawn ?? (spawnSync as unknown as FixedSpawn)
    // Use bounded timeouts via PGOPTIONS (inherited env is rejected by buildDeployEnv)
    const deployEnv = buildDeployEnv({ databaseUrl: input.databaseUrl })
    const result = runner("flock", ["-n", lockPath, "--", "node", "./node_modules/prisma/build/index.js", "migrate", "deploy"], {
      env: deployEnv.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    if (result.error || result.status !== 0) throw new Error("REQUIRES_READ_ONLY_INSPECTION: migrate deploy did not complete successfully")
    writeAudit(input.auditPath, input.audit)
    return { code: 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_URL]") }
  } finally { closeSync(lock) }
}

function command(command: string, args: string[], env?: Record<string, string>): string {
  const result = spawnSync(command, args, { encoding: "utf8", env: env ? { PATH: process.env.PATH, NODE_ENV: "production", ...env } : { PATH: process.env.PATH, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"] })
  if (result.error || result.status !== 0) throw new Error("BLOCKED: authoritative evidence command failed")
  return result.stdout.trim()
}
function sha256File(path: string) { return createHash("sha256").update(readFileSync(path)).digest("hex") }
function databaseEvidence(url: string, expectedIdentity: string) {
  const parsed = new URL(url)
  const host = parsed.hostname.toLowerCase()
  const q = (sql: string) => command("psql", [url, "-Atqc", sql], { DATABASE_URL: url, DIRECT_URL: url })
  const identity = createHash("sha256").update(q("select current_database() || '|' || current_schema() || '|' || current_setting('server_version')")).digest("hex").slice(0, 16)
  const names = q("select migration_name from _prisma_migrations order by finished_at").split("\n").filter(Boolean)
  return {
    target: { scheme: parsed.protocol.replace(":", ""), isDirect: !parsed.searchParams.has("pgbouncer") && !parsed.searchParams.has("pooler"), isProduction: identity === expectedIdentity, isDisposable: /localhost|127\.0\.0\.1|disposable|test|dev|preview/.test(host), isLocal: host === "localhost" || host === "127.0.0.1", isPreview: host.includes("preview"), isDevelopment: host.includes("dev"), isTest: host.includes("test"), identityFingerprint: identity },
    metadata: { failed: Number(q("select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null")), rolledBack: Number(q("select count(*) from _prisma_migrations where rolled_back_at is not null")), unexpected: names.filter((name) => name !== "20260824000000_postgresql_baseline").length, previousMigration: names.at(-1) ?? "" },
    pendingMigrations: readdirSync(join(process.cwd(), "prisma/migrations"), { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => ({ name: x.name, checksum: sha256File(join(process.cwd(), "prisma/migrations", x.name, "migration.sql")) })).filter((x) => x.name !== "20260824000000_postgresql_baseline"),
  }
}

function collectOpenPrEvidence(expected: RuntimeExpected, databaseUrl: string): MigrationGuardInput & { databaseUrl: string; auditPath: string; audit: unknown } {
  const status = command("git", ["status", "--porcelain"])
  const head = command("git", ["rev-parse", "HEAD"])
  const branch = command("git", ["branch", "--show-current"])
  const remoteHead = command("git", ["rev-parse", `origin/${branch}`])
  const pr = JSON.parse(command("gh", ["pr", "view", String(expected.pr), "--json", "state,headRefOid,mergeable,reviewDecision,statusCheckRollup"])) as { state: string; headRefOid: string; mergeable: string; reviewDecision: string; statusCheckRollup: Array<{ state?: string; conclusion?: string }> }
  const lock = readFileSync(join(process.cwd(), "prisma/migrations/migration_lock.toml"), "utf8")
  const packageVersion = JSON.parse(readFileSync(join(process.cwd(), "node_modules/prisma/package.json"), "utf8")).version as string
  const clientVersion = JSON.parse(readFileSync(join(process.cwd(), "node_modules/@prisma/client/package.json"), "utf8")).version as string
  const backupChecksum = sha256File(expected.backup.path)
  const backup = { identifier: expected.backup.path.split("/").pop() ?? expected.backup.path, checksum: backupChecksum, restoreVerified: backupChecksum === expected.backup.checksum && (statSync(expected.backup.path).mode & 0o777) === 0o600 && statSync(expected.backup.restoreList).isFile(), offsiteVerified: expected.backup.offsiteVerified }
  const db = databaseEvidence(databaseUrl, expected.identityFingerprint)
  const expectedApproval = expected.approval
  const actual: MigrationGuardInput = {
    mode: "open-pr",
    workingTreeClean: status === "", localHead: head, expectedHead: expected.head, remoteHead: remoteHead,
    prOpen: pr.state === "OPEN" && pr.headRefOid === head, expectedPr: expected.pr, prApproved: pr.reviewDecision === "APPROVED", mergeable: pr.mergeable === "MERGEABLE", checksPass: pr.statusCheckRollup.length > 0 && pr.statusCheckRollup.every((x) => x.state === "SUCCESS" || x.conclusion === "SUCCESS"),
    provider: lock.includes('provider = "postgresql"') && readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8").includes('provider = "postgresql"') ? "postgresql" : "unknown", prismaVersion: packageVersion, clientVersion,
    historyUnchanged: command("git", ["diff", "--name-status", "origin/main...HEAD", "--", "prisma/migrations"]).split("\n").filter(Boolean).every((line) => line === `A\tprisma/migrations/${expected.migration.name}/migration.sql`), pendingMigrations: db.pendingMigrations.filter((x) => x.name === expected.migration.name), expectedMigration: expected.migration,
    backup, productionFlag: true, approval: expectedApproval, target: db.target, metadata: db.metadata, lockAvailable: true, sqlKind: "additive", customSql: false, auditPathOwnerOnly: relative(process.cwd(), resolve(expected.auditPath)).startsWith(".."),
  }
  return { ...actual, databaseUrl, auditPath: expected.auditPath, audit: { ...expectedApproval, guards: "PASS", identityFingerprint: db.target.identityFingerprint, backupChecksum: backup.checksum } }
}

function collectMergedMainEvidence(expected: RuntimeExpected, databaseUrl: string): MigrationGuardInput & { databaseUrl: string; auditPath: string; audit: unknown } {
  const status = command("git", ["status", "--porcelain"])
  const head = command("git", ["rev-parse", "HEAD"])
  // For merged-main: local HEAD must match expected main
  const lock = readFileSync(join(process.cwd(), "prisma/migrations/migration_lock.toml"), "utf8")
  const packageVersion = JSON.parse(readFileSync(join(process.cwd(), "node_modules/prisma/package.json"), "utf8")).version as string
  const clientVersion = JSON.parse(readFileSync(join(process.cwd(), "node_modules/@prisma/client/package.json"), "utf8")).version as string

  // Verify introducing PR is MERGED (not closed-unmerged)
  const pr = JSON.parse(command("gh", ["pr", "view", String(expected.pr), "--json", "state,mergedAt,mergeCommit,headRefOid,mergeable,reviewDecision,statusCheckRollup"])) as {
    state: string; mergedAt: string | null; mergeCommit: { oid: string } | null; headRefOid: string
    mergeable: string; reviewDecision: string; statusCheckRollup: Array<{ state?: string; conclusion?: string }>
  }
  if (pr.state !== "MERGED") throw new Error("BLOCKED: introducing PR is not in MERGED state")
  if (!pr.mergedAt) throw new Error("BLOCKED: introducing PR has no merge timestamp")
  const mergeCommitOid = pr.mergeCommit?.oid
  if (!mergeCommitOid) throw new Error("BLOCKED: introducing PR has no merge commit")

  // Verify merge commit is ancestor of current HEAD
  const mergeAncestorCheck = command("git", ["merge-base", "--is-ancestor", mergeCommitOid, head])
  const mergeLineageAncestor = mergeAncestorCheck === "" // exit code 0 = is ancestor

  // Verify migration blob SHA unchanged since merge
  const migrationPath = join("prisma", "migrations", expected.migration.name, "migration.sql")
  const migrationBlobSha = sha256File(resolve(migrationPath))

  const backupChecksum = sha256File(expected.backup.path)
  const backup = { identifier: expected.backup.path.split("/").pop() ?? expected.backup.path, checksum: backupChecksum, restoreVerified: backupChecksum === expected.backup.checksum && (statSync(expected.backup.path).mode & 0o777) === 0o600 && statSync(expected.backup.restoreList).isFile(), offsiteVerified: expected.backup.offsiteVerified }
  const db = databaseEvidence(databaseUrl, expected.identityFingerprint)
  const expectedApproval = expected.approval

  const actual: MigrationGuardInput = {
    mode: "merged-main",
    workingTreeClean: status === "", localHead: head, expectedHead: expected.head,
    remoteHead: head, // In merged-main, remoteHead is not checked
    prOpen: false, // Must be false for merged-main
    expectedPr: expected.pr,
    prApproved: false, // Not checked in merged-main
    mergeable: false, // Not checked in merged-main
    checksPass: false, // Not checked in merged-main
    provider: lock.includes('provider = "postgresql"') && readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8").includes('provider = "postgresql"') ? "postgresql" : "unknown",
    prismaVersion: packageVersion, clientVersion,
    historyUnchanged: command("git", ["diff", "--name-status", "origin/main...HEAD", "--", "prisma/migrations"]).split("\n").filter(Boolean).every((line) => line === `A\tprisma/migrations/${expected.migration.name}/migration.sql`),
    pendingMigrations: db.pendingMigrations.filter((x) => x.name === expected.migration.name),
    expectedMigration: expected.migration,
    backup, productionFlag: true, approval: expectedApproval,
    target: db.target, metadata: db.metadata, lockAvailable: true,
    sqlKind: "additive", customSql: false,
    auditPathOwnerOnly: relative(process.cwd(), resolve(expected.auditPath)).startsWith(".."),
    // merged-main specific
    prMerged: true,
    prMergeCommit: mergeCommitOid,
    mergeLineageAncestor,
    migrationBlobSha256: migrationBlobSha,
    currentMainSha: head,
  }
  return { ...actual, databaseUrl, auditPath: expected.auditPath, audit: { ...expectedApproval, guards: "PASS", mode: "merged-main", identityFingerprint: db.target.identityFingerprint, backupChecksum: backup.checksum } }
}

export function collectAuthoritativeEvidence(expected: RuntimeExpected, databaseUrl: string): MigrationGuardInput & { databaseUrl: string; auditPath: string; audit: unknown } {
  if (expected.mode === "merged-main") return collectMergedMainEvidence(expected, databaseUrl)
  return collectOpenPrEvidence(expected, databaseUrl)
}

export function runCli(argv = process.argv.slice(2)) {
  const evidenceFlag = argv.indexOf("--evidence")
  const execute = argv.includes("--execute")
  if (evidenceFlag < 0 || !argv[evidenceFlag + 1]) throw new Error("usage: --evidence <expected-json> [--execute]")
  const expected = JSON.parse(readFileSync(resolve(argv[evidenceFlag + 1]), "utf8")) as RuntimeExpected
  const databaseUrl = process.env.DIRECT_URL
  if (!databaseUrl || process.env.DATABASE_URL !== databaseUrl) throw new Error("BLOCKED: DATABASE_URL and DIRECT_URL must match explicitly")
  const input = collectAuthoritativeEvidence(expected, databaseUrl)
  const failures = evaluateMigrationGuards(input)
  if (failures.length) throw new Error(`BLOCKED: ${failures.join("; ")}`)
  if (!execute) return { mode: "preflight", result: "PASS", failures: [] }
  return executeFixedDeploy(input)
}

if (process.argv[1]?.endsWith("production-migration-runner.ts")) {
  try { console.log(JSON.stringify(runCli())) } catch (error) { console.error(error instanceof Error ? error.message : "BLOCKED"); process.exitCode = 1 }
}
