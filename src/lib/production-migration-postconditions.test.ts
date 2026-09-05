import { describe, expect, it } from "vitest"
import {
  verifyPostConditions,
  buildDeployEnv,
  type PostConditionInput,
  type DeployEnvResult,
} from "./production-migration-postconditions"

function basePostConditionInput(overrides: Partial<PostConditionInput> = {}): PostConditionInput {
  return {
    migrationName: "20260830222005_loss_capital_ledger_foundation",
    migrationChecksum: "2de7d2e9ca11d799447f3e5a822655cbb6072316e88226ae7b81ff07858a3ad4",
    migrationRecordCount: 1,
    migrationStatus: "finished",
    migrationRolledBack: false,
    migrationChecksumPresent: true,
    failedCount: 0,
    rolledBackCount: 0,
    pendingCount: 0,
    totalMigrations: 2,
    expectedBaseline: "20260824000000_postgresql_baseline",
    enumCount: 5,
    ledgerTableCount: 2,
    investorCapitalLedgerOpenedAt: { type: "timestamp without time zone", nullable: true, defaultIsNull: true },
    transactionFinalizationVersion: { type: "integer", nullable: false, default: "0" },
    checkConstraintCount: 5,
    fkCount: 10,
    ledgerIndexCount: 11,
    matchExpected: true,
    ...overrides,
  }
}

describe("verifyPostConditions", () => {
  it("passes with exact matching postconditions", () => {
    const result = verifyPostConditions(basePostConditionInput())
    expect(result.pass).toBe(true)
    expect(result.failures).toHaveLength(0)
  })
  it("fails when migration record count is not 1", () => {
    const result = verifyPostConditions(basePostConditionInput({ migrationRecordCount: 2 }))
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("migration record count is not 1")
  })
  it("fails when migration status is not finished", () => {
    const result = verifyPostConditions(basePostConditionInput({ migrationStatus: "pending" }))
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("migration is not finished")
  })
  it("fails when migration is rolled back", () => {
    const result = verifyPostConditions(basePostConditionInput({ migrationRolledBack: true }))
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("migration is rolled back")
  })
  it("fails when migration checksum is missing", () => {
    const result = verifyPostConditions(basePostConditionInput({ migrationChecksumPresent: false }))
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("migration checksum is missing")
  })
  it("fails when failed count > 0", () => {
    const result = verifyPostConditions(basePostConditionInput({ failedCount: 1 }))
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("failed/unfinished migration records exist")
  })
  it("fails when rolled back count > 0", () => {
    const result = verifyPostConditions(basePostConditionInput({ rolledBackCount: 1 }))
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("failed/unfinished migration records exist")
  })
  it("fails when pending count > 0 (unexpected pending)", () => {
    const result = verifyPostConditions(basePostConditionInput({ pendingCount: 1 }))
    expect(result.pass).toBe(false)
    expect(result.failures).toContain("unexpected pending migrations found")
  })
  it("fails when enum count differs", () => {
    const result = verifyPostConditions(basePostConditionInput({ enumCount: 4 }))
    expect(result.pass).toBe(false)
    expect(result.failures.some(f => f.includes("enum count"))).toBe(true)
  })
  it("fails when ledger table count differs", () => {
    const result = verifyPostConditions(basePostConditionInput({ ledgerTableCount: 1 }))
    expect(result.pass).toBe(false)
    expect(result.failures.some(f => f.includes("ledger table count"))).toBe(true)
  })
  it("fails when capitalLedgerOpenedAt type differs", () => {
    const result = verifyPostConditions(basePostConditionInput({
      investorCapitalLedgerOpenedAt: { type: "text", nullable: true, defaultIsNull: true },
    }))
    expect(result.pass).toBe(false)
    expect(result.failures.some(f => f.includes("capitalLedgerOpenedAt"))).toBe(true)
  })
  it("fails when finalizationVersion is nullable", () => {
    const result = verifyPostConditions(basePostConditionInput({
      transactionFinalizationVersion: { type: "integer", nullable: true, default: "0" },
    }))
    expect(result.pass).toBe(false)
    expect(result.failures.some(f => f.includes("finalizationVersion"))).toBe(true)
  })
  it("fails when finalizationVersion default is wrong", () => {
    const result = verifyPostConditions(basePostConditionInput({
      transactionFinalizationVersion: { type: "integer", nullable: false, default: "1" },
    }))
    expect(result.pass).toBe(false)
    expect(result.failures.some(f => f.includes("finalizationVersion"))).toBe(true)
  })
  it("fails when expected counts differ from actual (matchExpected=false)", () => {
    const result = verifyPostConditions(basePostConditionInput({ matchExpected: false }))
    expect(result.pass).toBe(false)
    expect(result.failures.some(f => f.includes("aggregate counts"))).toBe(true)
  })
  it("fails when check constraint count differs", () => {
    const result = verifyPostConditions(basePostConditionInput({ checkConstraintCount: 4 }))
    expect(result.pass).toBe(false)
    expect(result.failures.some(f => f.includes("CHECK constraint count"))).toBe(true)
  })
})

describe("buildDeployEnv", () => {
  it("returns correct env with bounded timeouts", () => {
    const result: DeployEnvResult = buildDeployEnv({ databaseUrl: "postgresql://user:pass@127.0.0.1:5432/db?sslmode=require" })
    expect(result.env.PGOPTIONS).toContain("lock_timeout=3000")
    expect(result.env.PGOPTIONS).toContain("statement_timeout=30000")
  })
  it("rejects inherited PGOPTIONS from parent", () => {
    const original = process.env.PGOPTIONS
    process.env.PGOPTIONS = "-c default_transaction_read_only=on"
    try {
      const result = buildDeployEnv({ databaseUrl: "postgresql://u:p@127.0.0.1:5432/d" })
      expect(result.env.PGOPTIONS).not.toContain("read_only")
      expect(result.inheritedPgoptionsRejected).toBe(true)
    } finally {
      if (original !== undefined) process.env.PGOPTIONS = original
      else delete process.env.PGOPTIONS
    }
  })
  it("does not include sensitive values in env", () => {
    const result = buildDeployEnv({ databaseUrl: "postgresql://user:pass@127.0.0.1:5432/db" })
    // PGOPTIONS should not contain password
    expect(result.env.PGOPTIONS).not.toMatch(/pass/i)
  })
})
