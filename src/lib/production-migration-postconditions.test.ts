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
import { captureInvariantFingerprints, observePostConditions } from "../../scripts/production-migration-runner"

const MIGRATION = "20260830222005_loss_capital_ledger_foundation"
const CHECKSUM = "2de7d2e9ca11d799447f3e5a822655cbb6072316e88226ae7b81ff07858a3ad4"

function baseInput(overrides: Partial<PostConditionInput> = {}): PostConditionInput {
  return {
    migrationName: MIGRATION,
    migrationChecksum: CHECKSUM,
    identityMatches: true,
    migrationRecords: [
      { name: "20260824000000_postgresql_baseline", checksum: "7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd", finished: true, rolledBack: false, appliedSteps: 1 },
      { name: MIGRATION, checksum: CHECKSUM, finished: true, rolledBack: false, appliedSteps: 1 },
    ],
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
  it("passes exact runner-owned observations", () => {
    expect(verifyPostConditions(baseInput())).toEqual({ pass: true, failures: [] })
  })

  it("rejects duplicate, unfinished, rolled-back, wrong-checksum, and unexpected migration records", () => {
    const base = baseInput()
    expect(verifyPostConditions({ ...base, migrationRecords: [...base.migrationRecords, base.migrationRecords[1]] }).pass).toBe(false)
    expect(verifyPostConditions({ ...base, migrationRecords: base.migrationRecords.map((r) => r.name === MIGRATION ? { ...r, finished: false } : r) }).pass).toBe(false)
    expect(verifyPostConditions({ ...base, migrationRecords: base.migrationRecords.map((r) => r.name === MIGRATION ? { ...r, rolledBack: true } : r) }).pass).toBe(false)
    expect(verifyPostConditions({ ...base, migrationRecords: base.migrationRecords.map((r) => r.name === MIGRATION ? { ...r, checksum: "wrong" } : r) }).pass).toBe(false)
    expect(verifyPostConditions({ ...base, migrationRecords: [...base.migrationRecords, { name: "unexpected", checksum: "x", finished: true, rolledBack: false, appliedSteps: 1 }] }).pass).toBe(false)
  })

  it("rejects target mismatch, non-clean Prisma status, and invariant mismatch", () => {
    expect(verifyPostConditions(baseInput({ identityMatches: false })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ prismaStatusUpToDate: false })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ schemaDiffEmpty: false })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ invariantFingerprintsMatch: false })).pass).toBe(false)
  })

  it("rejects wrong named enum/table/column definitions", () => {
    expect(verifyPostConditions(baseInput({ enums: LEDGER_SCHEMA_CONTRACT.enums.slice(1) })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ enums: LEDGER_SCHEMA_CONTRACT.enums.map((value, i) => i === 0 ? { ...value, labels: ["WRONG"] } : value) })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ tables: ["CapitalMovement"] })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ investorCapitalLedgerOpenedAt: { type: "text", nullable: true, default: null } })).pass).toBe(false)
    expect(verifyPostConditions(baseInput({ transactionFinalizationVersion: { type: "integer", nullable: true, default: "1" } })).pass).toBe(false)
  })

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
      const first = observePostConditions(databaseUrl, identity, pre, MIGRATION, CHECKSUM)
      expect(first).toMatchObject({ pass: true, evidence: { source: "runner-owned-live-read-only", schemaContract: "MATCH", invariantFingerprints: "MATCH" } })

      const beforeSecond = captureInvariantFingerprints(databaseUrl)
      const secondOutput = deploy()
      expect(secondOutput).toMatch(/no pending migrations/i)
      expect(observePostConditions(databaseUrl, identity, beforeSecond, MIGRATION, CHECKSUM).pass).toBe(true)

      psql('drop index "CapitalMovement_transactionId_idx"')
      const tampered = observePostConditions(databaseUrl, identity, beforeSecond, MIGRATION, CHECKSUM)
      expect(tampered.pass).toBe(false)
      expect(tampered.failures).toContain("exact primary/unique/secondary index contract mismatch")
    } finally {
      rmSync(temp, { recursive: true, force: true })
    }
  }, 60_000)
})
