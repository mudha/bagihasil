import { describe, expect, it } from "vitest"
import { evaluateMigrationGuards, type MigrationGuardInput } from "./production-migration-guards"

function baseOpenPr(overrides: Partial<MigrationGuardInput> = {}): MigrationGuardInput {
  return {
    workingTreeClean: true,
    localHead: "a".repeat(40),
    expectedHead: "a".repeat(40),
    remoteHead: "a".repeat(40),
    prOpen: true,
    expectedPr: 1,
    prApproved: true,
    mergeable: true,
    checksPass: true,
    provider: "postgresql",
    prismaVersion: "5.22.0",
    clientVersion: "5.22.0",
    historyUnchanged: true,
    pendingMigrations: [{ name: "mig1", checksum: "cs1" }],
    expectedMigration: { name: "mig1", checksum: "cs1" },
    backup: { identifier: "backup.dump.gpg", checksum: "abc123", restoreVerified: true, offsiteVerified: true },
    productionFlag: true,
    approval: {
      operationId: "op-12345678",
      pr: 1,
      head: "a".repeat(40),
      migrationName: "mig1",
      migrationChecksum: "cs1",
      identityFingerprint: "fp1",
      backupIdentifier: "backup.dump.gpg",
      backupChecksum: "abc123",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    target: { scheme: "postgresql", isDirect: true, isProduction: true, isDisposable: false, isLocal: false, isPreview: false, isDevelopment: false, isTest: false, identityFingerprint: "fp1" },
    metadata: { failed: 0, rolledBack: 0, unexpected: 0, previousMigration: "20260824000000_postgresql_baseline" },
    lockAvailable: true,
    sqlKind: "additive",
    customSql: false,
    auditPathOwnerOnly: true,
    mode: "open-pr",
    ...overrides,
  }
}

function baseMergedMain(overrides: Partial<MigrationGuardInput> = {}): MigrationGuardInput {
  const mainSha = "b".repeat(40)
  return {
    workingTreeClean: true,
    localHead: mainSha,
    expectedHead: mainSha,
    remoteHead: mainSha,
    prOpen: false,
    expectedPr: 92,
    prApproved: false,
    mergeable: false,
    checksPass: false,
    provider: "postgresql",
    prismaVersion: "5.22.0",
    clientVersion: "5.22.0",
    historyUnchanged: true,
    pendingMigrations: [{ name: "20260830222005_loss_capital_ledger_foundation", checksum: "cs2" }],
    expectedMigration: { name: "20260830222005_loss_capital_ledger_foundation", checksum: "cs2" },
    backup: { identifier: "backup.dump.gpg", checksum: "abc123", restoreVerified: true, offsiteVerified: true },
    productionFlag: true,
    approval: {
      operationId: "op-1234567890",
      pr: 92,
      head: mainSha,
      migrationName: "20260830222005_loss_capital_ledger_foundation",
      migrationChecksum: "cs2",
      identityFingerprint: "fp1",
      backupIdentifier: "backup.dump.gpg",
      backupChecksum: "abc123",
      mergeCommit: "c".repeat(40),
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    target: { scheme: "postgresql", isDirect: true, isProduction: true, isDisposable: false, isLocal: false, isPreview: false, isDevelopment: false, isTest: false, identityFingerprint: "fp1" },
    metadata: { failed: 0, rolledBack: 0, unexpected: 0, previousMigration: "20260824000000_postgresql_baseline" },
    lockAvailable: true,
    sqlKind: "additive",
    customSql: false,
    auditPathOwnerOnly: true,
    mode: "merged-main",
    prMerged: true,
    prMergeCommit: "c".repeat(40),
    mergeLineageAncestor: true,
    migrationBlobSha256: "cs2",
    migrationBlobSha256AtMerge: "cs2",
    currentMainSha: mainSha,
    remoteMainSha: mainSha,
    ...overrides,
  }
}

describe("evaluateMigrationGuards", () => {
  describe("mode validation", () => {
    it("rejects missing mode", () => {
      const input = baseOpenPr() as any
      delete input.mode
      const failures = evaluateMigrationGuards(input)
      expect(failures).toContain("execution mode must be open-pr or merged-main")
    })
    it("rejects ambiguous mode (both prOpen and prMerged)", () => {
      const input = baseOpenPr({ prMerged: true } as any)
      const failures = evaluateMigrationGuards(input)
      expect(failures.some((f: string) => f.includes("ambiguous"))).toBe(true)
    })
  })

  describe("open-pr mode (existing behavior preserved)", () => {
    it("passes with valid open-pr inputs", () => {
      expect(evaluateMigrationGuards(baseOpenPr())).toHaveLength(0)
    })
    it("rejects when prOpen is false", () => {
      expect(evaluateMigrationGuards(baseOpenPr({ prOpen: false }))).toContain("PR is not open")
    })
    it("rejects when prApproved is false", () => {
      expect(evaluateMigrationGuards(baseOpenPr({ prApproved: false }))).toContain("PR is not approved")
    })
    it("rejects when mergeable is false", () => {
      expect(evaluateMigrationGuards(baseOpenPr({ mergeable: false }))).toContain("PR is not mergeable")
    })
    it("rejects when remoteHead differs", () => {
      expect(evaluateMigrationGuards(baseOpenPr({ remoteHead: "x".repeat(40) }))).toContain("remote PR head mismatch")
    })
    it("preserves all existing open-pr guards", () => {
      expect(evaluateMigrationGuards(baseOpenPr({ workingTreeClean: false }))).toContain("working tree is dirty")
      expect(evaluateMigrationGuards(baseOpenPr({ localHead: "z" }))).toContain("local head mismatch")
      expect(evaluateMigrationGuards(baseOpenPr({ checksPass: false }))).toContain("required checks are not pass")
      expect(evaluateMigrationGuards(baseOpenPr({ provider: "sqlite" }))).toContain("provider is not PostgreSQL")
      expect(evaluateMigrationGuards(baseOpenPr({ prismaVersion: "99.0.0" }))).toContain("Prisma version is not pinned")
      expect(evaluateMigrationGuards(baseOpenPr({ historyUnchanged: false }))).toContain("historical migration checksum changed")
      expect(evaluateMigrationGuards(baseOpenPr({ productionFlag: false }))).toContain("explicit Production flag missing")
      expect(evaluateMigrationGuards(baseOpenPr({ lockAvailable: false }))).toContain("runner lock unavailable")
      expect(evaluateMigrationGuards(baseOpenPr({ sqlKind: "destructive" }))).toContain("ordinary path rejects data or destructive migration")
      expect(evaluateMigrationGuards(baseOpenPr({ customSql: true }))).toContain("ordinary path rejects custom SQL")
      expect(evaluateMigrationGuards(baseOpenPr({ auditPathOwnerOnly: false }))).toContain("audit artifact permissions are not owner-only")
    })
  })

  describe("merged-main mode", () => {
    it("passes with valid merged-main inputs", () => {
      expect(evaluateMigrationGuards(baseMergedMain())).toHaveLength(0)
    })
    it("rejects when prMerged is false", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ prMerged: false }))).toContain("introducing PR is not merged")
    })
    it("rejects when mergeLineageAncestor is false", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ mergeLineageAncestor: false }))).toContain("merge commit is not ancestor of current main")
    })
    it("rejects when migrationBlobSha256 differs", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ migrationBlobSha256: "wrong" }))).toContain("migration file changed since merge")
    })
    it("rejects when migration bytes at the introducing merge differ", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ migrationBlobSha256AtMerge: "wrong" }))).toContain("migration file at introducing merge does not match expected checksum")
    })
    it("rejects when fetched origin/main differs from current main", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ remoteMainSha: "x".repeat(40) }))).toContain("fetched origin/main does not match current main")
    })
    it("rejects when currentMainSha differs from localHead", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ currentMainSha: "x".repeat(40) }))).toContain("current main SHA does not match local HEAD")
    })
    it("rejects when expectedPr is not 92", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ expectedPr: 99 }))).toContain("introducing PR number mismatch")
    })
    it("rejects prOpen in merged-main mode as ambiguous", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ prOpen: true })).some((f: string) => f.includes("ambiguous"))).toBe(true)
    })
    it("rejects expired approval", () => {
      const expired = new Date(Date.now() - 1000).toISOString()
      const failures = evaluateMigrationGuards(baseMergedMain({ approval: { ...baseMergedMain().approval!, expiresAt: expired } }))
      expect(failures).toContain("approval binding invalid")
    })
    it("rejects missing offsite backup verification", () => {
      const failures = evaluateMigrationGuards(baseMergedMain({ backup: { identifier: "b", checksum: "c", restoreVerified: true, offsiteVerified: false } }))
      expect(failures).toContain("offsite backup copy not verified")
    })
    it("rejects missing, multiple, wrong, or unexpected pending migrations", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ pendingMigrations: [] }))).toContain("pending migration list mismatch")
      expect(evaluateMigrationGuards(baseMergedMain({ pendingMigrations: [...baseMergedMain().pendingMigrations, { name: "unexpected", checksum: "x" }] }))).toContain("pending migration list mismatch")
      expect(evaluateMigrationGuards(baseMergedMain({ pendingMigrations: [{ name: "wrong", checksum: "cs2" }] }))).toContain("pending migration list mismatch")
    })
    it("binds approval to the exact GitHub merge commit", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ approval: { ...baseMergedMain().approval!, mergeCommit: "d".repeat(40) } }))).toContain("approval binding invalid")
      expect(evaluateMigrationGuards(baseMergedMain({ prMergeCommit: "d".repeat(40) }))).toContain("approval binding invalid")
    })
    it("does NOT require prOpen/prApproved/mergeable/checksPass", () => {
      const failures = evaluateMigrationGuards(baseMergedMain({ prOpen: false, prApproved: false, mergeable: false, checksPass: false, remoteHead: "z".repeat(40) }))
      expect(failures.filter((f: string) => f.includes("PR is not open"))).toHaveLength(0)
      expect(failures.filter((f: string) => f.includes("PR is not approved"))).toHaveLength(0)
      expect(failures.filter((f: string) => f.includes("PR is not mergeable"))).toHaveLength(0)
      expect(failures.filter((f: string) => f.includes("required checks"))).toHaveLength(0)
    })
    it("preserves shared guards (target, metadata, backup, lock, sqlKind)", () => {
      expect(evaluateMigrationGuards(baseMergedMain({ target: { ...baseMergedMain().target!, isDisposable: true } }))).toContain("database target is not an approved direct Production target")
      expect(evaluateMigrationGuards(baseMergedMain({ metadata: { ...baseMergedMain().metadata, failed: 1 } }))).toContain("migration metadata contains failed, rolled-back, or unexpected records")
      expect(evaluateMigrationGuards(baseMergedMain({ backup: { identifier: "b", checksum: "c", restoreVerified: false, offsiteVerified: true } }))).toContain("backup evidence invalid")
      expect(evaluateMigrationGuards(baseMergedMain({ lockAvailable: false }))).toContain("runner lock unavailable")
      expect(evaluateMigrationGuards(baseMergedMain({ sqlKind: "data" }))).toContain("ordinary path rejects data or destructive migration")
    })
  })
})
