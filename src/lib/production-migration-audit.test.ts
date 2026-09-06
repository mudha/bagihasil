import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { executeFixedDeploy, redactAudit, writeAudit } from "../../scripts/production-migration-runner"

describe("production migration audit safety", () => {
  it("redacts URLs and secret-like fields", () => {
    const output = JSON.stringify(redactAudit({ url: "postgresql://user:secret@host/db", token: "abc", nested: { password: "pw" } }))
    expect(output).not.toContain("postgresql://")
    expect(output).not.toContain("secret")
    expect(output).not.toContain("abc")
    expect(output).not.toContain("pw")
  })

  it("writes owner-only immutable audit artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-audit-"))
    const path = join(dir, "audit.json")
    try {
      writeAudit(path, { operationId: "op-123456", url: "postgresql://secret@host/db" })
      expect(statSync(path).mode & 0o777).toBe(0o600)
      expect(readFileSync(path, "utf8")).not.toContain("postgresql://")
      expect(() => writeAudit(path, { operationId: "op-123456" })).toThrow()
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it("executes only the fixed Prisma deploy command and writes a redacted audit", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-runner-"))
    const input = {
      workingTreeClean: true, localHead: "head", expectedHead: "head", remoteHead: "head", prOpen: true, expectedPr: 68, prApproved: true, mergeable: true, checksPass: true,
      provider: "postgresql", prismaVersion: "5.22.0", clientVersion: "5.22.0", historyUnchanged: true,
      pendingMigrations: [{ name: "20260901000000_add_note", checksum: "sum" }], expectedMigration: { name: "20260901000000_add_note", checksum: "sum" },
      mode: "open-pr" as const,
      backup: { identifier: "backup.gpg", checksum: "backupsum", restoreVerified: true, offsiteVerified: true }, productionFlag: true,
      approval: { operationId: "op-runner-1", pr: 68, head: "head", migrationName: "20260901000000_add_note", migrationChecksum: "sum", identityFingerprint: "prod", backupIdentifier: "backup.gpg", backupChecksum: "backupsum", issuedAt: "2026-08-24T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" },
      target: { scheme: "postgresql", isDirect: true, isProduction: true, isDisposable: false, isLocal: false, isPreview: false, isDevelopment: false, isTest: false, identityFingerprint: "prod" },
      metadata: { failed: 0, rolledBack: 0, unexpected: 0, previousMigration: "20260824000000_postgresql_baseline" }, lockAvailable: true, sqlKind: "additive" as const, customSql: false, auditPathOwnerOnly: true,
      databaseUrl: "postgresql://hidden", auditPath: join(dir, "audit.json"), audit: { url: "postgresql://hidden" }, preDeploymentInvariants: {},
    } satisfies Parameters<typeof executeFixedDeploy>[0]
    const calls: string[][] = []
    const result = executeFixedDeploy(input, {
      lockPath: join(dir, "lock"),
      spawn: (command, args, options) => {
        calls.push([command, ...args])
        expect((options.env as Record<string, string>).PGOPTIONS).toBe("-c lock_timeout=3000 -c statement_timeout=30000")
        expect(options.timeout).toBe(120_000)
        expect(options.killSignal).toBe("SIGTERM")
        return { status: 0, stdout: "No pending migrations to apply.", stderr: "" }
      },
      captureBaseline: () => ({ name: "20260824000000_postgresql_baseline", checksum: "7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd", finished: true, rolledBack: false, appliedSteps: 0 }),
      observe: () => ({ pass: true, failures: [], evidence: { source: "runner-owned-live-read-only" } }),
    })
    expect(result.code).toBe(0)
    expect(calls[0]).toEqual(["flock", "-n", join(dir, "lock"), "node", "./node_modules/prisma/build/index.js", "migrate", "deploy"])
    expect(readFileSync(join(dir, "audit.json"), "utf8")).not.toContain("postgresql://")
    rmSync(dir, { recursive: true, force: true })
  })

  it("writes failure audit, never PASS, when live postconditions fail after deploy exit 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-runner-negative-"))
    const auditPath = join(dir, "audit.json")
    const input = {
      workingTreeClean: true, localHead: "head", expectedHead: "head", remoteHead: "head", prOpen: true, expectedPr: 68, prApproved: true, mergeable: true, checksPass: true,
      provider: "postgresql", prismaVersion: "5.22.0", clientVersion: "5.22.0", historyUnchanged: true,
      pendingMigrations: [{ name: "20260901000000_add_note", checksum: "sum" }], expectedMigration: { name: "20260901000000_add_note", checksum: "sum" }, mode: "open-pr" as const,
      backup: { identifier: "backup.gpg", checksum: "backupsum", restoreVerified: true, offsiteVerified: true }, productionFlag: true,
      approval: { operationId: "op-runner-2", pr: 68, head: "head", migrationName: "20260901000000_add_note", migrationChecksum: "sum", identityFingerprint: "prod", backupIdentifier: "backup.gpg", backupChecksum: "backupsum", issuedAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() },
      target: { scheme: "postgresql", isDirect: true, isProduction: true, isDisposable: false, isLocal: false, isPreview: false, isDevelopment: false, isTest: false, identityFingerprint: "prod" },
      metadata: { failed: 0, rolledBack: 0, unexpected: 0, previousMigration: "20260824000000_postgresql_baseline" }, lockAvailable: true, sqlKind: "additive" as const, customSql: false, auditPathOwnerOnly: true,
      databaseUrl: "postgresql://hidden", auditPath, audit: {}, preDeploymentInvariants: {},
    }
    expect(() => executeFixedDeploy(input, { lockPath: join(dir, "lock"), spawn: () => ({ status: 0 }), captureBaseline: () => ({ name: "20260824000000_postgresql_baseline", checksum: "7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd", finished: true, rolledBack: false, appliedSteps: 0 }), observe: () => ({ pass: false, failures: ["schema mismatch"], evidence: { source: "runner-owned-live-read-only" } }) })).toThrow("REQUIRES_READ_ONLY_INSPECTION")
    const audit = JSON.parse(readFileSync(auditPath, "utf8"))
    expect(audit.verdict).toBe("REQUIRES_READ_ONLY_INSPECTION")
    expect(audit.verdict).not.toBe("PASS")
    rmSync(dir, { recursive: true, force: true })
  })
})
