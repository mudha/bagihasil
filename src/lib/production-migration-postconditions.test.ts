import { describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  LEDGER_SCHEMA_CONTRACT,
  buildDeployEnv,
  verifyPostConditions,
  type PostConditionInput,
} from "./production-migration-postconditions"
import { captureBaselineRecord, captureInvariantFingerprints, observePostConditions } from "../../scripts/production-migration-runner"

const MIGRATION = "20260830222005_loss_capital_ledger_foundation"
const CHECKSUM = "2de7d2e9ca11d799447f3e5a822655cbb6072316e88226ae7b81ff07858a3ad4"

const BASELINE_NAME = "20260824000000_postgresql_baseline"
const BASELINE_CHECKSUM = "7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd"

function baseInput(overrides: Partial<PostConditionInput> = {}): PostConditionInput {
  return {
    migrationName: MIGRATION,
    migrationChecksum: CHECKSUM,
    identityMatches: true,
    migrationRecords: [
      { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
      { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
    ],
    baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
    prismaStatusUpToDate: true,
    schemaDiffEmpty: true,
    enums: LEDGER_SCHEMA_CONTRACT.enums,
    tables: [...LEDGER_SCHEMA_CONTRACT.tables],
    investorCapitalLedgerOpenedAt: { type: "timestamp without time zone", nullable: true, default: null },
    transactionFinalizationVersion: { type: "integer", nullable: false, default: "0" },
    checks: LEDGER_SCHEMA_CONTRACT.checks,
    foreignKeys: LEDGER_SCHEMA_CONTRACT.foreignKeys,
    indexes: LEDGER_SCHEMA_CONTRACT.indexes,
    invariantFingerprintsMatch: true,
    ...overrides,
  }
}

describe("verifyPostConditions exact ledger contract", () => {
  // ── Criterion 1: Baseline exact, resolve-adopted (steps=0), unchanged → PASS ──
  it("accepts resolve-adopted baseline (appliedSteps=0) with correct name/checksum/finished/unrolledBack", () => {
    expect(verifyPostConditions(baseInput())).toEqual({ pass: true, failures: [] })
  })

  // ── Criterion 1b: Baseline normal (steps>=1) also accepted ──
  it("accepts normal baseline (appliedSteps=1) with correct name/checksum/finished/unrolledBack", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
    })
    expect(verifyPostConditions(input)).toEqual({ pass: true, failures: [] })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // Baseline pre/post stability tests
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Stability 1: Exact pre = exact post (resolve-adopted) → PASS ──
  it("passes when pre-deploy baseline exactly matches post-deploy baseline (resolve-adopted)", () => {
    const pre = { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 }
    const post = { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 }
    expect(pre).toEqual(post) // sanity: pre and post are identical
    const input = baseInput({
      migrationRecords: [post, { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 }],
      baselinePreDeploy: pre,
    })
    expect(verifyPostConditions(input)).toEqual({ pass: true, failures: [] })
  })

  // ── Stability 1b: Exact pre = exact post (normal baseline steps=1) → PASS ──
  it("passes when pre-deploy baseline exactly matches post-deploy baseline (normal, steps=1)", () => {
    const pre = { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 }
    const post = { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 }
    const input = baseInput({
      migrationRecords: [post, { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 }],
      baselinePreDeploy: pre,
    })
    expect(verifyPostConditions(input)).toEqual({ pass: true, failures: [] })
  })

  // ── Stability 2: Pre baseline missing (null) while baseline exists post → FAIL ──
  it("rejects when pre-deploy baseline snapshot is missing but baseline exists post-deploy", () => {
    const input = baseInput({
      baselinePreDeploy: null,
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline pre-deploy snapshot missing, cannot prove stability")
  })

  // ── Stability 4a: Pre baseline wrong name → FAIL ──
  it("rejects when pre-deploy baseline has wrong name", () => {
    const input = baseInput({
      baselinePreDeploy: { name: "wrong_name", checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline pre-deploy name mismatch")
  })

  // ── Stability 4b: Pre baseline wrong checksum → FAIL ──
  it("rejects when pre-deploy baseline has wrong checksum", () => {
    const input = baseInput({
      baselinePreDeploy: { name: BASELINE_NAME, checksum: "wrong", finished: true, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline pre-deploy checksum mismatch")
  })

  // ── Stability 4c: Pre baseline unfinished → FAIL ──
  it("rejects when pre-deploy baseline is not finished", () => {
    const input = baseInput({
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: false, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline pre-deploy is not finished")
  })

  // ── Stability 4d: Pre baseline rolled back → FAIL ──
  it("rejects when pre-deploy baseline is rolled back", () => {
    const input = baseInput({
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: true, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline pre-deploy is rolled back")
  })

  // ── Stability 5a: Post baseline checksum differs from pre → FAIL ──
  it("rejects when post-deploy baseline checksum differs from pre-deploy", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: "changed_checksum", finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => /baseline record changed.*checksum/.test(f))).toBe(true)
  })

  // ── Stability 5b: Post baseline finished differs from pre → FAIL ──
  it("rejects when post-deploy baseline finished differs from pre-deploy", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: false, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => /baseline record changed.*finished/.test(f))).toBe(true)
  })

  // ── Stability 5c: Post baseline rolledBack differs from pre → FAIL ──
  it("rejects when post-deploy baseline rolledBack differs from pre-deploy", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: true, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => /baseline record changed.*rolledBack/.test(f))).toBe(true)
  })

  // ── Stability 5d: Post baseline appliedSteps differs from pre → FAIL ──
  it("rejects when post-deploy baseline appliedSteps differs from pre-deploy", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 3 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => /baseline record changed.*appliedSteps/.test(f))).toBe(true)
  })

  // ── Stability 6: Steps changed from 0→1 → FAIL even though both forms are individually valid ──
  it("rejects when baseline changed from resolve-adopted (steps=0) to normal (steps=1) between pre and post", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
      baselinePreDeploy: { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures.some((f) => /baseline record changed.*appliedSteps/.test(f))).toBe(true)
  })

  // ── Criterion 2: Baseline checksum wrong → FAIL ──
  it("rejects baseline with wrong checksum", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: "wrong_checksum", finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline migration record does not match resolve-adopted or normal baseline contract")
  })

  // ── Criterion 3: Baseline unfinished → FAIL ──
  it("rejects baseline with finished=false", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: false, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline migration record does not match resolve-adopted or normal baseline contract")
  })

  // ── Criterion 3b: Baseline rolled back → FAIL ──
  it("rejects baseline with rolledBack=true", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: true, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline migration record does not match resolve-adopted or normal baseline contract")
  })

  // ── Criterion 5: Non-baseline migration with appliedSteps=0 → FAIL ──
  it("rejects target migration with appliedSteps=0", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("target migration applied_steps_count must be >= 1")
  })

  // ── Criterion 6: Target migration exact, steps >= 1 → PASS ──
  it("accepts target migration with exact checksum, finished, not rolled back, steps >= 1", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 2 },
      ],
    })
    expect(verifyPostConditions(input)).toEqual({ pass: true, failures: [] })
  })

  // ── Criterion 7a: Target missing → FAIL ──
  it("rejects when target migration record is missing", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("target migration record count is not exactly one")
  })

  // ── Criterion 7b: Target wrong checksum → FAIL ──
  it("rejects target migration with wrong checksum", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: "wrong", finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("target migration checksum mismatch")
  })

  // ── Criterion 7c: Target unfinished → FAIL ──
  it("rejects target migration with finished=false", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: false, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("target migration is not finished")
  })

  // ── Criterion 7d: Target rolled back → FAIL ──
  it("rejects target migration with rolledBack=true", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: true, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("target migration is rolled back")
  })

  // ── Criterion 7e: Target duplicate → FAIL ──
  it("rejects duplicate target migration records", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("target migration record count is not exactly one")
  })

  // ── Criterion 7f: Unexpected migration → FAIL ──
  it("rejects unexpected migration records", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
        { name: "unexpected_migration", checksum: "x", finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("unexpected migration records found")
  })

  // ── Baseline missing → FAIL ──
  it("rejects when baseline record is missing", () => {
    const input = baseInput({
      migrationRecords: [
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline migration record is not exactly one")
  })

  // ── Baseline duplicate → FAIL ──
  it("rejects duplicate baseline records", () => {
    const input = baseInput({
      migrationRecords: [
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: BASELINE_NAME, checksum: BASELINE_CHECKSUM, finished: true, rolledBack: false, appliedSteps: 0 },
        { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
      ],
    })
    const result = verifyPostConditions(input)
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("baseline migration record is not exactly one")
  })

  // ── Target mismatch, non-clean Prisma status, invariant mismatch ──
  it("rejects target mismatch, non-clean Prisma status, and invariant mismatch", () => {
    expect(verifyPostConditions(baseInput({ identityMatches: false })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ prismaStatusUpToDate: false })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ schemaDiffEmpty: false })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ invariantFingerprintsMatch: false })).pass).toBe(false)
  })

  // ── Schema contract: wrong named enum/table/column definitions → FAIL ──
  it("rejects wrong named enum/table/column definitions", () => {
    expect(verifyPostConditions(baseInput({ enums: LEDGER_SCHEMA_CONTRACT.enums.slice(1) })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ enums: LEDGER_SCHEMA_CONTRACT.enums.map((value, i) => i === 0 ? { ...value, labels: ["WRONG"] } : value) })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ tables: ["CapitalMovement"] })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ investorCapitalLedgerOpenedAt: { type: "text", nullable: true, default: null } })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ transactionFinalizationVersion: { type: "integer", nullable: true, default: "1" } })).pass).toBe(false)
  })

  // ── Same-count CHECK/FK/index substitutions → FAIL ──
  it("rejects same-count CHECK/FK/index substitutions", () => {
    const checks = LEDGER_SCHEMA_CONTRACT.checks.map((value, i) => i === 0 ? { ...value, expression: "finalizationversion >= 1" } : value)
    const foreignKeys = LEDGER_SCHEMA_CONTRACT.foreignKeys.map((value, i) => i === 0 ? { ...value, onDelete: "CASCADE" } : value)
    const indexes = LEDGER_SCHEMA_CONTRACT.indexes.map((value, i) => i === 0 ? { ...value, unique: false } : value)
    expect(verifyPostConditions(baseInput({ checks })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ foreignKeys })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ indexes })).pass).toBe(false)
  })
})

describe("buildDeployEnv", () => {
  it("sets exact bounded deploy timeouts and a bounded connection timeout", () => {
    const result = buildDeployEnv({ databaseUrl: "postgresql://user:pw@127.0.0.1:5432/db" })
    expect(result.env.PGOPTIONS).toBe("-c lock_timeout=3000 -c statement_timeout=30000")
    expect(new URL(result.env.DATABASE_URL).searchParams.get("connect_timeout")).toBe("10")
    expect(result.env.DIRECT_URL).toBe(result.env.DATABASE_URL)
  })

  it("marks inherited PGOPTIONS for fail-closed rejection instead of merging it", () => {
    const original = process.env.PGOPTIONS
    process.env.PGOPTIONS = "-c statement_timeout=0"
    try {
      const result = buildDeployEnv({ databaseUrl: "postgresql://u:pw@127.0.0.1:5432/d" })
      expect(result.inheritedPgoptionsRejected).toBe(true)
      expect(result.env.PGOPTIONS).not.toContain("statement_timeout=0")
    } finally {
      if (original === undefined) delete process.env.PGOPTIONS
      else process.env.PGOPTIONS = original
    }
  })

  it.each(["0", "-1", "11", "invalid"])("rejects invalid or excessive connect_timeout=%s", (value) => {
    expect(() => buildDeployEnv({ databaseUrl: `postgresql://u:pw@host/db?connect_timeout=${value}` })).toThrow("connect_timeout")
  })
})

describe.runIf(Boolean(process.env.PR115_DISPOSABLE_DATABASE_URL))("disposable PostgreSQL runner integration", () => {
  it("applies once, verifies runner-owned live evidence, no-ops, and rejects schema tamper", () => {
    const databaseUrl = process.env.PR115_DISPOSABLE_DATABASE_URL!
    const parsed = new URL(databaseUrl)
    expect(parsed.hostname).toBe("127.0.0.1")
    expect(parsed.pathname).toMatch(/^\/bagihasil_pr115_[a-z0-9_]+$/)
    expect(parsed.username).toMatch(/^pr115_runner_[a-z0-9_]+$/)
    expect(process.env.NODE_ENV).toBe("test")

    const env = buildDeployEnv({ databaseUrl }).env
    const childEnv = { ...process.env, ...env, NODE_ENV: "test" as const } satisfies NodeJS.ProcessEnv
    const psql = (sql: string) => execFileSync("psql", [databaseUrl, "-XAtq", "--set", "ON_ERROR_STOP=1", "--command", sql], { env: childEnv, encoding: "utf8" }).trim()
    const identity = createHash("sha256").update(psql("select current_database() || '|' || current_schema() || '|' || current_setting('server_version')")).digest("hex").slice(0, 16)
    const pre = captureInvariantFingerprints(databaseUrl)
    const temp = mkdtempSync(join(tmpdir(), "bagihasil-pr115-integration-"))
    const deploy = () => execFileSync("flock", ["-n", join(temp, "runner.lock"), "node", "./node_modules/prisma/build/index.js", "migrate", "deploy"], { env: childEnv, encoding: "utf8" })
    try {
      const firstOutput = deploy()
      expect(firstOutput).toMatch(/applied|migration/i)
      // Capture baseline AFTER first deploy (it was just created by deploy on fresh DB).
      const baselineAfterFirst = captureBaselineRecord(databaseUrl)
      expect(baselineAfterFirst).not.toBeNull()
      expect(baselineAfterFirst!.name).toBe(BASELINE_NAME)
      const first = observePostConditions(databaseUrl, identity, pre, MIGRATION, CHECKSUM, baselineAfterFirst)
      expect(first).toMatchObject({ pass: true, evidence: { source: "runner-owned-live-read-only", schemaContract: "MATCH", invariantFingerprints: "MATCH" } })

      const beforeSecond = captureInvariantFingerprints(databaseUrl)
      // Capture baseline BEFORE second deploy for stability verification.
      const baselineBeforeSecond = captureBaselineRecord(databaseUrl)
      expect(baselineBeforeSecond).not.toBeNull()
      const secondOutput = deploy()
      expect(secondOutput).toMatch(/no pending migrations/i)
      expect(observePostConditions(databaseUrl, identity, beforeSecond, MIGRATION, CHECKSUM, baselineBeforeSecond).pass).toBe(true)

      psql('drop index "CapitalMovement_transactionId_idx"')
      const tampered = observePostConditions(databaseUrl, identity, beforeSecond, MIGRATION, CHECKSUM, baselineBeforeSecond)
      expect(tampered.pass).toBe(false)
      expect(tampered.failures).toContain("exact primary/unique/secondary index contract mismatch")
    } finally {
      rmSync(temp, { recursive: true, force: true })
    }
  }, 60_000)
})
