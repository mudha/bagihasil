import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { evaluateMigrationGuards, type MigrationGuardInput } from "../src/lib/production-migration-guards"

export type AuditRecord = {
  timestampUtc: string; timestampWib: string; operationId: string; operator: string
  pr: number; head: string; migrationName: string; migrationChecksum: string
  prismaVersion: string; backupIdentifier: string; backupChecksum: string
  restoreVerified: boolean; identityFingerprint: string; guards: "PASS"
  metadataBefore: unknown; metadataAfter: unknown; schemaDiff: "empty"
  status: "PASS"; deploy: "PASS_NOOP"; verdict: "PASS"
}
type FixedSpawn = (command: string, args: string[], options: Record<string, unknown>) => { status: number | null; stdout?: string; stderr?: string; error?: Error }

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
    const result = runner("flock", ["-n", lockPath, "--", "node", "./node_modules/prisma/build/index.js", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: input.databaseUrl, DIRECT_URL: input.databaseUrl }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    })
    if (result.error || result.status !== 0) throw new Error("REQUIRES_READ_ONLY_INSPECTION: migrate deploy did not complete successfully")
    writeAudit(input.auditPath, input.audit)
    return { code: 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_URL]") }
  } finally { closeSync(lock) }
}

export function runCli(argv = process.argv.slice(2)) {
  const evidenceFlag = argv.indexOf("--evidence")
  const execute = argv.includes("--execute")
  if (evidenceFlag < 0 || !argv[evidenceFlag + 1]) throw new Error("usage: --evidence <owner-only-json> [--execute]")
  const evidencePath = resolve(argv[evidenceFlag + 1])
  const input = JSON.parse(readFileSync(evidencePath, "utf8")) as MigrationGuardInput & { databaseUrl: string; auditPath: string; audit: unknown }
  const failures = evaluateMigrationGuards(input)
  if (failures.length) throw new Error(`BLOCKED: ${failures.join("; ")}`)
  if (!execute) return { mode: "preflight", result: "PASS", failures: [] }
  return executeFixedDeploy(input)
}

if (process.argv[1]?.endsWith("production-migration-runner.ts")) {
  try { console.log(JSON.stringify(runCli())) } catch (error) { console.error(error instanceof Error ? error.message : "BLOCKED"); process.exitCode = 1 }
}
