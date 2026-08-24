import { describe, expect, it } from "vitest"
import { evaluateMigrationGuards, type MigrationGuardInput } from "./production-migration-guards"

const good: MigrationGuardInput = {
  workingTreeClean: true, localHead: "abc", expectedHead: "abc", remoteHead: "abc",
  prOpen: true, expectedPr: 68, prApproved: true, mergeable: true, checksPass: true,
  provider: "postgresql", prismaVersion: "5.22.0", clientVersion: "5.22.0",
  historyUnchanged: true, pendingMigrations: [{ name: "20260901000000_add_note", checksum: "a" }],
  expectedMigration: { name: "20260901000000_add_note", checksum: "a" },
  backup: { identifier: "backup.gpg", checksum: "b", restoreVerified: true },
  productionFlag: true, approval: { operationId: "op-pr67-001", pr: 68, head: "abc", migrationName: "20260901000000_add_note", migrationChecksum: "a", identityFingerprint: "prod-1", backupIdentifier: "backup.gpg", backupChecksum: "b", issuedAt: "2026-08-24T00:00:00Z" },
  target: { scheme: "postgresql", isDirect: true, isProduction: true, isDisposable: false, isLocal: false, isPreview: false, isDevelopment: false, isTest: false, identityFingerprint: "prod-1" },
  metadata: { failed: 0, rolledBack: 0, unexpected: 0, previousMigration: "20260824000000_postgresql_baseline" },
  lockAvailable: true, sqlKind: "additive", customSql: false, auditPathOwnerOnly: true,
}

describe("production migration guard contract", () => {
  it("accepts a fully bound additive migration", () => expect(evaluateMigrationGuards(good)).toEqual([]))
  it.each([
    ["dirty working tree", { workingTreeClean: false }], ["wrong head", { localHead: "wrong" }], ["remote mismatch", { remoteHead: "wrong" }],
    ["PR not approved", { prApproved: false }], ["checks pending", { checksPass: false }], ["wrong provider", { provider: "sqlite" }], ["wrong Prisma", { prismaVersion: "5.23.0" }],
    ["history changed", { historyUnchanged: false }], ["missing backup", { backup: undefined }], ["backup unverified", { backup: { ...good.backup!, restoreVerified: false } }],
    ["generic approval", { approval: { ...good.approval!, operationId: "yes" } }], ["target pooled", { target: { ...good.target, isDirect: false } }],
    ["target preview", { target: { ...good.target, isPreview: true } }], ["identity mismatch", { target: { ...good.target, identityFingerprint: "other" } }],
    ["failed metadata", { metadata: { ...good.metadata, failed: 1 } }], ["multiple pending", { pendingMigrations: [...good.pendingMigrations, { name: "other", checksum: "x" }] }],
    ["lock unavailable", { lockAvailable: false }], ["destructive SQL", { sqlKind: "destructive" }], ["data SQL", { sqlKind: "data" }], ["custom SQL", { customSql: true }],
    ["audit permissions", { auditPathOwnerOnly: false }],
  ])("rejects %s", (_name, patch) => expect(evaluateMigrationGuards({ ...good, ...patch } as MigrationGuardInput).length).toBeGreaterThan(0))
  it("rejects unbound approval", () => expect(evaluateMigrationGuards({ ...good, approval: { ...good.approval!, head: "other" } }).some((x) => x.includes("approval"))).toBe(true))
  it("does not leak secrets in guard messages", () => expect(JSON.stringify(evaluateMigrationGuards({ ...good, target: { ...good.target, identityFingerprint: "postgresql://secret@host/db" } }))).not.toMatch(/secret|postgresql:\/\//i))
})
