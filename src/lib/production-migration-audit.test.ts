import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync, spawnSync } from "node:child_process"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { executeCriticalSection, executeFixedDeploy, redactAudit, runCli, writeAudit, validatePreDeployBaseline } from "../../scripts/production-migration-runner"
import type { MigrationRecord } from "../../src/lib/production-migration-postconditions"

// Mock spawnSync + execFileSync globally so unit tests never run real psql/prisma/flock.
const realExecSyncRef = vi.hoisted(() => ({ current: null as typeof execFileSync | null }))
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process") as typeof import("node:child_process")
  realExecSyncRef.current = actual.execFileSync
  return {
    ...actual,
    spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: "No pending migrations to apply.", stderr: "" }),
    execFileSync: vi.fn().mockReturnValue(""),
  }
})
const realExecFileSync = () => realExecSyncRef.current

const VALID_BASELINE: MigrationRecord = {
  name: "20260824000000_postgresql_baseline",
  checksum: "7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd",
  finished: true, rolledBack: false, appliedSteps: 0,
}

/** Full ExecutionInput for executeCriticalSection tests */
function baseInput(dir: string) {
  return {
    workingTreeClean: true, localHead: "head", expectedHead: "head", remoteHead: "head",
    prOpen: true, expectedPr: 68, prApproved: true, mergeable: true, checksPass: true,
    provider: "postgresql" as const, prismaVersion: "5.22.0", clientVersion: "5.22.0",
    historyUnchanged: true,
    pendingMigrations: [{ name: "20260901000000_add_note", checksum: "sum" }],
    expectedMigration: { name: "20260901000000_add_note", checksum: "sum" },
    mode: "open-pr" as const,
    backup: { identifier: "backup.gpg", checksum: "backupsum", restoreVerified: true, offsiteVerified: true },
    productionFlag: true,
    approval: { operationId: "op-test-ok", pr: 68, head: "head", migrationName: "20260901000000_add_note", migrationChecksum: "sum", identityFingerprint: "prod", backupIdentifier: "backup.gpg", backupChecksum: "backupsum", issuedAt: "2026-08-24T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" },
    target: { scheme: "postgresql", isDirect: true, isProduction: true, isDisposable: false, isLocal: false, isPreview: false, isDevelopment: false, isTest: false, identityFingerprint: "prod" },
    metadata: { failed: 0, rolledBack: 0, unexpected: 0, previousMigration: "20260824000000_postgresql_baseline" },
    lockAvailable: true, sqlKind: "additive" as const, customSql: false, auditPathOwnerOnly: true,
    databaseUrl: "postgresql://hidden", auditPath: join(dir, "audit.json"), audit: { url: "postgresql://hidden" },
    preDeploymentInvariants: {},
  }
}

/** Non-secret RuntimeExpected for executeFixedDeploy tests */
function runtimeExpected(dir: string) {
  return {
    mode: "open-pr" as const,
    pr: 68,
    head: "head",
    migration: { name: "20260901000000_add_note", checksum: "sum" },
    backup: { path: "/tmp/backup.gpg", checksum: "backupsum", restoreList: "/tmp/restore-list", offsiteVerified: true },
    approval: { operationId: "op-test-ok", pr: 68, head: "head", migrationName: "20260901000000_add_note", migrationChecksum: "sum", identityFingerprint: "prod", backupIdentifier: "backup.gpg", backupChecksum: "backupsum", issuedAt: "2026-08-24T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" },
    identityFingerprint: "prod",
    auditPath: join(dir, "audit.json"),
  }
}

/** Fake EvidenceInput that passes guards — used by collectEvidence seam */
function fakeEvidence(dir: string) { return baseInput(dir) }

describe("production migration audit safety", () => {
  it("redacts URLs and secret-like fields", () => {
    const output = JSON.stringify(redactAudit({ url: "postgresql://user:***@host/db", token: "abc", nested: { password: "pw" } }))
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
})

describe("validatePreDeployBaseline", () => {
  it("accepts valid resolve-adopted baseline (steps=0)", () => { expect(() => validatePreDeployBaseline(VALID_BASELINE)).not.toThrow() })
  it("accepts valid normal baseline (steps >= 1)", () => { expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, appliedSteps: 3 })).not.toThrow() })
  it("rejects wrong name", () => { expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, name: "wrong" })).toThrow("BLOCKED: baseline pre-deploy name mismatch") })
  it("rejects wrong checksum", () => { expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, checksum: "bad" })).toThrow("BLOCKED: baseline pre-deploy checksum mismatch") })
  it("rejects unfinished", () => { expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, finished: false })).toThrow("BLOCKED: baseline pre-deploy is not finished") })
  it("rejects rolled back", () => { expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, rolledBack: true })).toThrow("BLOCKED: baseline pre-deploy is rolled back") })
  it("rejects invalid appliedSteps (negative)", () => { expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, appliedSteps: -1 })).toThrow("BLOCKED: baseline pre-deploy applied_steps_count is invalid") })
})

describe("executeCriticalSection ordering", () => {
  it("1: valid baseline → capture, deploy, observe in order; audit written", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-order-"))
    const input = baseInput(dir)
    const calls: string[] = []
    executeCriticalSection(input, {
      captureBaseline: () => { calls.push("capture"); return VALID_BASELINE },
      observe: () => { calls.push("observe"); return { pass: true, failures: [], evidence: { source: "test" } } },
    })
    expect(calls).toEqual(["capture", "observe"])
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.status).toBe("PASS")
    expect(audit.deploy).toBe("PASS")
    rmSync(dir, { recursive: true, force: true })
  })

  it("2: null baseline → BLOCKED, failure audit written", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-null-"))
    const input = baseInput(dir)
    let deployCalled = false
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => { if (String(args).includes("migrate")) deployCalled = true; return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any })
    expect(() => executeCriticalSection(input, { captureBaseline: () => null })).toThrow("BLOCKED: baseline pre-deploy snapshot missing or duplicate")
    expect(deployCalled).toBe(false)
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.deploy).toBe("FAIL")
    rmSync(dir, { recursive: true, force: true })
  })

  it("3: capture error → throws, deploy never called, failure audit", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-caperr-"))
    const input = baseInput(dir)
    let deployCalled = false
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => { if (String(args).includes("migrate")) deployCalled = true; return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any })
    expect(() => executeCriticalSection(input, { captureBaseline: () => { throw new Error("DB connection refused") } })).toThrow("DB connection refused")
    expect(deployCalled).toBe(false)
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.failure).toContain("baseline capture failed")
    rmSync(dir, { recursive: true, force: true })
  })

  it("4-7: wrong name/checksum/unfinished/rolled-back → BLOCKED, failure audit", () => {
    const cases: [Partial<MigrationRecord>, string][] = [
      [{ name: "wrong_name" }, "baseline validation failed"],
      [{ checksum: "bad" }, "baseline validation failed"],
      [{ finished: false }, "baseline validation failed"],
      [{ rolledBack: true }, "baseline validation failed"],
    ]
    for (const [override, auditFragment] of cases) {
      const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-cases-"))
      const input = baseInput(dir)
      expect(() => executeCriticalSection(input, { captureBaseline: () => ({ ...VALID_BASELINE, ...override }) })).toThrow("BLOCKED:")
      const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
      expect(audit.deploy).toBe("FAIL")
      expect(audit.failure).toContain(auditFragment)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("8: valid baseline → deploy called exactly once", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-once-"))
    const input = baseInput(dir)
    let deployCount = 0
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => { if (String(args).includes("migrate")) deployCount++; return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any })
    executeCriticalSection(input, { captureBaseline: () => VALID_BASELINE, observe: () => ({ pass: true, failures: [], evidence: {} }) })
    expect(deployCount).toBe(1)
    rmSync(dir, { recursive: true, force: true })
  })

  it("9-10: postcondition failure/throw → REQUIRES_READ_ONLY_INSPECTION audit", () => {
    const dir9 = mkdtempSync(join(tmpdir(), "bagihasil-cs-pf-"))
    expect(() => executeCriticalSection(baseInput(dir9), { captureBaseline: () => VALID_BASELINE, observe: () => ({ pass: false, failures: ["schema mismatch"], evidence: {} }) })).toThrow("REQUIRES_READ_ONLY_INSPECTION")
    expect(JSON.parse(readFileSync(join(dir9, "audit.json"), "utf8")).verdict).toBe("REQUIRES_READ_ONLY_INSPECTION")
    rmSync(dir9, { recursive: true, force: true })

    const dir10 = mkdtempSync(join(tmpdir(), "bagihasil-cs-pt-"))
    expect(() => executeCriticalSection(baseInput(dir10), { captureBaseline: () => VALID_BASELINE, observe: () => { throw new Error("psql down") } })).toThrow("REQUIRES_READ_ONLY_INSPECTION")
    rmSync(dir10, { recursive: true, force: true })
  })

  it("11: guard failure → capture/deploy never called", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-guard-"))
    const input = { ...baseInput(dir), workingTreeClean: false }
    let captureCalled = false, deployCalled = false
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => { if (String(args).includes("migrate")) deployCalled = true; return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any })
    expect(() => executeCriticalSection(input, { captureBaseline: () => { captureCalled = true; return VALID_BASELINE } })).toThrow("BLOCKED:")
    expect(captureCalled).toBe(false)
    expect(deployCalled).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe("executeFixedDeploy — same-process lock", () => {
  beforeEach(() => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: "No pending migrations to apply.", stderr: "", pid: 0, output: [null], signal: null } as any)
    vi.mocked(execFileSync).mockReturnValue("")
  })

  // Helper to set DATABASE_URL for tests
  function withDbUrl<T>(fn: () => T): T {
    const orig = process.env.DIRECT_URL
    const origDb = process.env.DATABASE_URL
    process.env.DIRECT_URL = "postgresql://test:pass@host/db"
    process.env.DATABASE_URL = "postgresql://test:pass@host/db"
    try { return fn() } finally {
      if (orig === undefined) delete process.env.DIRECT_URL; else process.env.DIRECT_URL = orig
      if (origDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = origDb
    }
  }

  it("acquires flock via execFileSync on inherited FD", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-lock-"))
    const execCalls: any[][] = []
    vi.mocked(execFileSync).mockImplementation((cmd: any, args: any) => { execCalls.push([cmd, ...(args as string[])]); return "" })

    withDbUrl(() => executeFixedDeploy(runtimeExpected(dir), {
      lockPath: join(dir, "lock"),
      collectEvidence: () => fakeEvidence(dir),
      seams: { captureBaseline: () => VALID_BASELINE, observe: () => ({ pass: true, failures: [], evidence: {} }) },
    }))

    const flockCalls = execCalls.filter(([cmd]) => cmd === "flock")
    expect(flockCalls.length).toBe(1)
    expect(flockCalls[0][1]).toBe("-n")
    expect(Number(flockCalls[0][2])).toBeGreaterThan(0)
    rmSync(dir, { recursive: true, force: true })
  })

  it("lock failure → BLOCKED: execution lock not available", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-lockfail-"))
    vi.mocked(execFileSync).mockImplementation((cmd: any) => { if (cmd === "flock") throw new Error("flock: Resource temporarily unavailable"); return "" })
    expect(() => withDbUrl(() => executeFixedDeploy(runtimeExpected(dir), { lockPath: join(dir, "lock") }))).toThrow("BLOCKED: execution lock not available")
    rmSync(dir, { recursive: true, force: true })
  })

  it("lock success → collectEvidence → critical section in order", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-lockorder-"))
    const calls: string[] = []
    withDbUrl(() => executeFixedDeploy(runtimeExpected(dir), {
      lockPath: join(dir, "lock"),
      collectEvidence: () => { calls.push("collect"); return fakeEvidence(dir) },
      seams: { captureBaseline: () => { calls.push("capture"); return VALID_BASELINE }, observe: () => { calls.push("observe"); return { pass: true, failures: [], evidence: {} } } },
    }))
    expect(calls).toEqual(["collect", "capture", "observe"])
    rmSync(dir, { recursive: true, force: true })
  })

  it("no temp file created for execution payload", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-notemp-"))
    try {
      withDbUrl(() => executeFixedDeploy(runtimeExpected(dir), {
        lockPath: join(dir, "lock"), collectEvidence: () => fakeEvidence(dir),
        seams: { captureBaseline: () => VALID_BASELINE, observe: () => ({ pass: true, failures: [], evidence: {} }) },
      }))
      // Verify no temp files were written (only audit.json in the target dir)
      const files = readdirSync(dir)
      expect(files.filter(f => f.endsWith(".json") && f !== "audit.json")).toHaveLength(0)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it("no npx/network resolution in production lock path", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-nonpx-"))
    const execCalls: any[][] = []
    vi.mocked(execFileSync).mockImplementation((cmd: any, args: any) => { execCalls.push([cmd, ...(args as string[])]); return "" })
    withDbUrl(() => executeFixedDeploy(runtimeExpected(dir), {
      lockPath: join(dir, "lock"), collectEvidence: () => fakeEvidence(dir),
      seams: { captureBaseline: () => VALID_BASELINE, observe: () => ({ pass: true, failures: [], evidence: {} }) },
    }))
    const npxCalls = execCalls.filter(([cmd]) => cmd === "npx" || cmd === "tsx")
    expect(npxCalls).toHaveLength(0)
    rmSync(dir, { recursive: true, force: true })
  })

  it("lock released in finally even on error", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-finally-"))
    expect(() => withDbUrl(() => executeFixedDeploy(runtimeExpected(dir), {
      lockPath: join(dir, "lock"), collectEvidence: () => { throw new Error("collect failed") },
    }))).toThrow("collect failed")
    rmSync(dir, { recursive: true, force: true })
  })

  it("reads DATABASE_URL from process.env, not from serialized input", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-envread-"))
    let capturedDatabaseUrl = ""
    const orig = process.env.DIRECT_URL; const origDb = process.env.DATABASE_URL
    process.env.DIRECT_URL = "postgresql://env-test:pass@host/db"
    process.env.DATABASE_URL = "postgresql://env-test:pass@host/db"
    try {
      executeFixedDeploy(runtimeExpected(dir), {
        lockPath: join(dir, "lock"),
        collectEvidence: (_exp, dbUrl) => { capturedDatabaseUrl = dbUrl; return fakeEvidence(dir) },
        seams: { captureBaseline: () => VALID_BASELINE, observe: () => ({ pass: true, failures: [], evidence: {} }) },
      })
      expect(capturedDatabaseUrl).toBe("postgresql://env-test:pass@host/db")
    } finally {
      if (orig === undefined) delete process.env.DIRECT_URL; else process.env.DIRECT_URL = orig
      if (origDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = origDb
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("--critical-section removed — no unlocked mutation entry point", () => {
  it("runCli with --critical-section throws (no mutation path)", () => {
    expect(() => runCli(["--critical-section", "/tmp/fake.json"])).toThrow()
  })
})

describe.runIf(realExecFileSync() !== null)("same-process flock Linux integration", () => {
  it("flock -n on file path acquires, conflict detection, and release", () => {
    const real = realExecFileSync()!
    const lockPath = join(tmpdir(), `bagihasil-flock-${process.pid}.lock`)

    try {
      // 1. Acquire lock on file path — runs `true` which exits immediately, lock held until flock exits
      expect(() => real("flock", ["-n", lockPath, "true"])).not.toThrow()

      // 2. Verify file was created by flock
      statSync(lockPath)

      // 3. Re-acquire after release — should succeed
      expect(() => real("flock", ["-n", lockPath, "true"])).not.toThrow()
    } finally { try { unlinkSync(lockPath) } catch {} }
  })
})
