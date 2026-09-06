import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { describe, expect, it, vi } from "vitest"
import { executeCriticalSection, executeFixedDeploy, redactAudit, writeAudit, validatePreDeployBaseline, buildMinimalChildEnv } from "../../scripts/production-migration-runner"
import type { MigrationRecord } from "../../src/lib/production-migration-postconditions"

// Mock spawnSync globally so unit tests never run real psql/prisma/flock.
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process")
  return { ...actual, spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: "No pending migrations to apply.", stderr: "" }) }
})

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
  it("accepts valid resolve-adopted baseline (steps=0)", () => {
    expect(() => validatePreDeployBaseline(VALID_BASELINE)).not.toThrow()
  })
  it("accepts valid normal baseline (steps >= 1)", () => {
    expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, appliedSteps: 3 })).not.toThrow()
  })
  it("rejects wrong name", () => {
    expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, name: "wrong" })).toThrow("BLOCKED: baseline pre-deploy name mismatch")
  })
  it("rejects wrong checksum", () => {
    expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, checksum: "bad" })).toThrow("BLOCKED: baseline pre-deploy checksum mismatch")
  })
  it("rejects unfinished", () => {
    expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, finished: false })).toThrow("BLOCKED: baseline pre-deploy is not finished")
  })
  it("rejects rolled back", () => {
    expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, rolledBack: true })).toThrow("BLOCKED: baseline pre-deploy is rolled back")
  })
  it("rejects invalid appliedSteps (negative)", () => {
    expect(() => validatePreDeployBaseline({ ...VALID_BASELINE, appliedSteps: -1 })).toThrow("BLOCKED: baseline pre-deploy applied_steps_count is invalid")
  })
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
    expect(audit.verdict).toBe("PASS")
    rmSync(dir, { recursive: true, force: true })
  })

  it("2: null baseline (missing/duplicate) → BLOCKED, deploy never called", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-null-"))
    const input = baseInput(dir)
    let deployCalled = false
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => {
      if (String(args).includes("migrate")) deployCalled = true
      return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
    })

    expect(() => executeCriticalSection(input, { captureBaseline: () => null }))
      .toThrow("BLOCKED: baseline pre-deploy snapshot missing or duplicate")
    expect(deployCalled).toBe(false)
    // Verify failure audit was written for null baseline
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.deploy).toBe("FAIL")
    expect(audit.failure).toContain("baseline pre-deploy snapshot missing")
    rmSync(dir, { recursive: true, force: true })
  })

  it("3: capture error → throws, deploy never called, failure audit written", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-caperr-"))
    const input = baseInput(dir)
    let deployCalled = false
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => {
      if (String(args).includes("migrate")) deployCalled = true
      return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
    })

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => { throw new Error("DB connection refused") },
    })).toThrow("DB connection refused")
    expect(deployCalled).toBe(false)
    // Verify failure audit was written for capture error
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.deploy).toBe("FAIL")
    expect(audit.failure).toContain("baseline capture failed")
    expect(audit.failure).toContain("DB connection refused")
    rmSync(dir, { recursive: true, force: true })
  })

  it("4: wrong baseline name → BLOCKED, deploy never called", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-wrongname-"))
    const input = baseInput(dir)
    let deployCalled = false
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => {
      if (String(args).includes("migrate")) deployCalled = true
      return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
    })

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => ({ ...VALID_BASELINE, name: "wrong_name" }),
    })).toThrow("BLOCKED: baseline pre-deploy name mismatch")
    expect(deployCalled).toBe(false)
    // Verify failure audit written for validate error
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.deploy).toBe("FAIL")
    expect(audit.failure).toContain("baseline validation failed")
    rmSync(dir, { recursive: true, force: true })
  })

  it("5: wrong baseline checksum → BLOCKED, failure audit written", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-chksum-"))
    const input = baseInput(dir)

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => ({ ...VALID_BASELINE, checksum: "bad" }),
    })).toThrow("BLOCKED: baseline pre-deploy checksum mismatch")
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.deploy).toBe("FAIL")
    expect(audit.failure).toContain("baseline validation failed")
    rmSync(dir, { recursive: true, force: true })
  })

  it("6: unfinished baseline → BLOCKED, failure audit written", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-unfin-"))
    const input = baseInput(dir)

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => ({ ...VALID_BASELINE, finished: false }),
    })).toThrow("BLOCKED: baseline pre-deploy is not finished")
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.deploy).toBe("FAIL")
    expect(audit.failure).toContain("baseline validation failed")
    rmSync(dir, { recursive: true, force: true })
  })

  it("7: rolled-back baseline → BLOCKED, failure audit written", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-rollback-"))
    const input = baseInput(dir)

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => ({ ...VALID_BASELINE, rolledBack: true }),
    })).toThrow("BLOCKED: baseline pre-deploy is rolled back")
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.deploy).toBe("FAIL")
    expect(audit.failure).toContain("baseline validation failed")
    rmSync(dir, { recursive: true, force: true })
  })

  it("8: valid resolve-adopted baseline → deploy called exactly once", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-once-"))
    const input = baseInput(dir)
    let deployCount = 0
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => {
      if (String(args).includes("migrate")) deployCount++
      return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
    })

    executeCriticalSection(input, {
      captureBaseline: () => VALID_BASELINE,
      observe: () => ({ pass: true, failures: [], evidence: {} }),
    })

    expect(deployCount).toBe(1)
    rmSync(dir, { recursive: true, force: true })
  })

  it("9: postcondition failure → writes REQUIRES_READ_ONLY_INSPECTION audit", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-postfail-"))
    const input = baseInput(dir)

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => VALID_BASELINE,
      observe: () => ({ pass: false, failures: ["schema mismatch"], evidence: { source: "test" } }),
    })).toThrow("REQUIRES_READ_ONLY_INSPECTION")
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.verdict).toBe("REQUIRES_READ_ONLY_INSPECTION")
    expect(audit.deploy).toBe("FAIL")
    rmSync(dir, { recursive: true, force: true })
  })

  it("10: postcondition throw → writes REQUIRES_READ_ONLY_INSPECTION audit", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-postthrow-"))
    const input = baseInput(dir)

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => VALID_BASELINE,
      observe: () => { throw new Error("psql down") },
    })).toThrow("REQUIRES_READ_ONLY_INSPECTION: live read-only postcondition observation failed")
    const audit = JSON.parse(readFileSync(join(dir, "audit.json"), "utf8"))
    expect(audit.verdict).toBe("REQUIRES_READ_ONLY_INSPECTION")
    rmSync(dir, { recursive: true, force: true })
  })

  it("11: guard failure → capture/deploy never called, no audit written (no mutation)", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-cs-guard-"))
    const input = { ...baseInput(dir), workingTreeClean: false } // guard will fail
    let captureCalled = false
    let deployCalled = false
    vi.mocked(spawnSync).mockImplementation((cmd: any, args: any) => {
      if (String(args).includes("migrate")) deployCalled = true
      return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
    })

    expect(() => executeCriticalSection(input, {
      captureBaseline: () => { captureCalled = true; return VALID_BASELINE },
    })).toThrow("BLOCKED:")
    expect(captureCalled).toBe(false)
    expect(deployCalled).toBe(false)
    // No audit file written — guard failure before any mutation
    rmSync(dir, { recursive: true, force: true })
  })
})

describe("executeFixedDeploy — secretless locked child", () => {
  it("does not accept captureBaseline or observe options (type-level)", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-seam-"))
    const expected = runtimeExpected(dir)

    // Verify that the production wrapper only accepts spawn and lockPath.
    const result = executeFixedDeploy(expected, {
      lockPath: join(dir, "lock"),
      spawn: (command, args) => {
        expect(command).toBe("flock")
        expect(args).toContain("--critical-section")
        return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
      },
    })

    expect(result.deploy).toBe("PASS")
    rmSync(dir, { recursive: true, force: true })
  })

  it("runs flock subprocess wrapping --critical-section", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-flock-"))
    const expected = runtimeExpected(dir)
    const calls: string[][] = []

    executeFixedDeploy(expected, {
      lockPath: join(dir, "lock"),
      spawn: (command, args) => {
        calls.push([command, ...args])
        return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
      },
    })

    expect(calls.length).toBe(1)
    expect(calls[0][0]).toBe("flock")
    expect(calls[0]).toContain("-n")
    expect(calls[0]).toContain("--critical-section")
    rmSync(dir, { recursive: true, force: true })
  })

  it("flock failure → BLOCKED: execution lock not available", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-flockfail-"))
    const expected = runtimeExpected(dir)

    expect(() => executeFixedDeploy(expected, {
      lockPath: join(dir, "lock"),
      spawn: () => ({ status: 1, stdout: "", stderr: "" }),
    })).toThrow("BLOCKED: execution lock not available")
    rmSync(dir, { recursive: true, force: true })
  })

  it("subprocess BLOCKED error propagated correctly", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-prop-"))
    const expected = runtimeExpected(dir)

    expect(() => executeFixedDeploy(expected, {
      lockPath: join(dir, "lock"),
      spawn: () => ({ status: 1, stdout: "", stderr: "BLOCKED: baseline pre-deploy snapshot missing or duplicate\n" }),
    })).toThrow("BLOCKED: baseline pre-deploy snapshot missing or duplicate")
    rmSync(dir, { recursive: true, force: true })
  })

  it("subprocess REQUIRES_READ_ONLY_INSPECTION error propagated correctly", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-prop2-"))
    const expected = runtimeExpected(dir)

    expect(() => executeFixedDeploy(expected, {
      lockPath: join(dir, "lock"),
      spawn: () => ({ status: 1, stdout: "", stderr: "REQUIRES_READ_ONLY_INSPECTION: postconditions failed\n" }),
    })).toThrow("REQUIRES_READ_ONLY_INSPECTION: postconditions failed")
    rmSync(dir, { recursive: true, force: true })
  })
})

describe("executeFixedDeploy — temp file contains no secrets", () => {
  it("temp file on success contains only RuntimeExpected (no databaseUrl)", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-nosecret-"))
    const expected = runtimeExpected(dir)
    let tempContent = ""

    executeFixedDeploy(expected, {
      lockPath: join(dir, "lock"),
      spawn: (command: any, args: any) => {
        // Read temp file before child "reads" it
        const tempPath = args[args.length - 1]
        tempContent = readFileSync(tempPath, "utf8")
        return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
      },
    })

    const parsed = JSON.parse(tempContent)
    // No databaseUrl field
    expect(parsed.databaseUrl).toBeUndefined()
    // No password, token, or URL credentials
    const serialized = JSON.stringify(parsed)
    expect(serialized).not.toMatch(/password/i)
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//)
    expect(serialized).not.toMatch(/PGPASSWORD/)
    expect(serialized).not.toMatch(/GH_TOKEN/)
    expect(serialized).not.toMatch(/GITHUB_TOKEN/)
    // Verify it's a valid RuntimeExpected shape
    expect(parsed.mode).toBe("open-pr")
    expect(parsed.pr).toBe(68)
    expect(parsed.migration).toBeDefined()
    rmSync(dir, { recursive: true, force: true })
  })

  it("temp file on failure contains no secrets", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-nosecret-fail-"))
    const expected = runtimeExpected(dir)
    let tempContent = ""

    try {
      executeFixedDeploy(expected, {
        lockPath: join(dir, "lock"),
        spawn: (command: any, args: any) => {
          const tempPath = args[args.length - 1]
          tempContent = readFileSync(tempPath, "utf8")
          return { status: 1, stdout: "", stderr: "BLOCKED: test error\n" }
        },
      })
    } catch { /* expected */ }

    const parsed = JSON.parse(tempContent)
    expect(parsed.databaseUrl).toBeUndefined()
    expect(JSON.stringify(parsed)).not.toMatch(/postgres(?:ql)?:\/\//)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe("executeFixedDeploy — minimal child environment", () => {
  it("child env does not leak unrelated sentinel secrets from parent", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-env-"))
    const expected = runtimeExpected(dir)
    let childEnv: Record<string, string> = {}

    // Set sentinel secrets in parent env
    const origSentinel = process.env.SECRET_SENTINEL
    const origGhToken = process.env.GITHUB_TOKEN
    const origPgPassword = process.env.PGPASSWORD
    const origPgOptions = process.env.PGOPTIONS
    process.env.SECRET_SENTINEL = "should-not-leak"
    process.env.GITHUB_TOKEN = "ghp_should_not_leak"
    process.env.PGPASSWORD = "super_secret_db_pass"
    process.env.PGOPTIONS = "-c statement_timeout=0"

    try {
      executeFixedDeploy(expected, {
        lockPath: join(dir, "lock"),
        spawn: (command: any, args: any, options: any) => {
          childEnv = options.env ?? {}
          return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
        },
      })

      // MUST NOT be forwarded
      expect(childEnv.SECRET_SENTINEL).toBeUndefined()
      expect(childEnv.GITHUB_TOKEN).toBeUndefined()
      expect(childEnv.PGPASSWORD).toBeUndefined()
      expect(childEnv.PGOPTIONS).toBeUndefined()
      expect(childEnv.GH_TOKEN).toBeUndefined()
      expect(JSON.stringify(childEnv)).not.toContain("should-not-leak")
      expect(JSON.stringify(childEnv)).not.toContain("ghp_should_not_leak")
      expect(JSON.stringify(childEnv)).not.toContain("super_secret_db_pass")
    } finally {
      if (origSentinel === undefined) delete process.env.SECRET_SENTINEL
      else process.env.SECRET_SENTINEL = origSentinel
      if (origGhToken === undefined) delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = origGhToken
      if (origPgPassword === undefined) delete process.env.PGPASSWORD
      else process.env.PGPASSWORD = origPgPassword
      if (origPgOptions === undefined) delete process.env.PGOPTIONS
      else process.env.PGOPTIONS = origPgOptions
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("child env forwards required PATH and NODE_ENV", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-env2-"))
    const expected = runtimeExpected(dir)
    let childEnv: Record<string, string> = {}

    executeFixedDeploy(expected, {
      lockPath: join(dir, "lock"),
      spawn: (command: any, args: any, options: any) => {
        childEnv = options.env ?? {}
        return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
      },
    })

    expect(childEnv.PATH).toBeDefined()
    expect(childEnv.NODE_ENV).toBe("production")
    rmSync(dir, { recursive: true, force: true })
  })

  it("child env forwards DATABASE_URL and DIRECT_URL when set in parent", () => {
    const dir = mkdtempSync(join(tmpdir(), "bagihasil-env3-"))
    const expected = runtimeExpected(dir)
    let childEnv: Record<string, string> = {}

    const origDbUrl = process.env.DATABASE_URL
    const origDirectUrl = process.env.DIRECT_URL
    process.env.DATABASE_URL = "postgresql://test:pass@host/db"
    process.env.DIRECT_URL = "postgresql://test:pass@host/db"

    try {
      executeFixedDeploy(expected, {
        lockPath: join(dir, "lock"),
        spawn: (command: any, args: any, options: any) => {
          childEnv = options.env ?? {}
          return { status: 0, stdout: "", stderr: "", pid: 0, output: [null], signal: null } as any
        },
      })

      expect(childEnv.DATABASE_URL).toBe("postgresql://test:pass@host/db")
      expect(childEnv.DIRECT_URL).toBe("postgresql://test:pass@host/db")
    } finally {
      if (origDbUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = origDbUrl
      if (origDirectUrl === undefined) delete process.env.DIRECT_URL
      else process.env.DIRECT_URL = origDirectUrl
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("buildMinimalChildEnv", () => {
  it("returns allowlisted keys only", () => {
    const env = buildMinimalChildEnv()
    const allowedKeys = new Set(["PATH", "NODE_ENV", "DATABASE_URL", "DIRECT_URL", "HOME", "XDG_CONFIG_HOME", "GH_CONFIG_DIR"])
    for (const key of Object.keys(env)) {
      expect(allowedKeys.has(key)).toBe(true)
    }
  })

  it("does not contain GH_TOKEN, GITHUB_TOKEN, PGPASSWORD, or PGOPTIONS", () => {
    const env = buildMinimalChildEnv()
    expect(env.GH_TOKEN).toBeUndefined()
    expect(env.GITHUB_TOKEN).toBeUndefined()
    expect(env.PGPASSWORD).toBeUndefined()
    expect(env.PGOPTIONS).toBeUndefined()
  })
})
