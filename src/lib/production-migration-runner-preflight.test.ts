import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { detectProvider, buildGitCommandEnv } from "../../scripts/production-migration-runner"

/**
 * Regression tests for PR #116 — Production migration runner preflight fix.
 *
 * Defect A: provider detection used exact substring `provider = "postgresql"`
 * (one space) which failed on the real schema.prisma that uses
 * `provider  = "postgresql"` (two spaces).
 *
 * Defect B: child process gh/git commands got a minimal env without HOME,
 * so gh could not read ~/.config/gh/hosts.yml and failed authentication.
 */

const REPO_ROOT = join(__dirname, "../..")
const REAL_LOCK = readFileSync(join(REPO_ROOT, "prisma/migrations/migration_lock.toml"), "utf8")
const REAL_SCHEMA = readFileSync(join(REPO_ROOT, "prisma/schema.prisma"), "utf8")

describe("detectProvider — whitespace-insensitive PostgreSQL detection", () => {
  it("accepts provider with one space (canonical format)", () => {
    expect(detectProvider('provider = "postgresql"', 'provider = "postgresql"')).toBe("postgresql")
  })

  it("accepts provider with two spaces matching real schema.prisma", () => {
    // The real schema.prisma uses `provider  = "postgresql"` (two spaces)
    expect(detectProvider('provider = "postgresql"', 'provider  = "postgresql"')).toBe("postgresql")
  })

  it("accepts provider with tab whitespace variations", () => {
    expect(detectProvider('provider\t=\t"postgresql"', 'provider=\t"postgresql"')).toBe("postgresql")
    expect(detectProvider('provider  =  "postgresql"', 'provider\t\t=\t"postgresql"')).toBe("postgresql")
  })

  it("rejects non-PostgreSQL providers", () => {
    expect(detectProvider('provider = "sqlite"', 'provider = "sqlite"')).toBe("unknown")
    expect(detectProvider('provider = "mysql"', 'provider = "mysql"')).toBe("unknown")
    expect(detectProvider('provider = "mongodb"', 'provider = "mongodb"')).toBe("unknown")
  })

  it("rejects when only one source is PostgreSQL (cross-source mismatch)", () => {
    expect(detectProvider('provider = "postgresql"', 'provider = "sqlite"')).toBe("unknown")
    expect(detectProvider('provider = "sqlite"', 'provider = "postgresql"')).toBe("unknown")
  })

  it("rejects misleading strings and comments that don't constitute a real provider", () => {
    // A TOML comment mentioning postgresql is not a real provider declaration
    expect(detectProvider('# provider = "postgresql"', 'provider = "postgresql"')).toBe("unknown")
    // A Prisma comment is not a real provider declaration
    expect(detectProvider('provider = "postgresql"', '// provider = "postgresql"')).toBe("unknown")
    // providerAccountId field is not a datasource provider declaration
    expect(
      detectProvider(
        'provider = "postgresql"',
        '  providerAccountId String\n  @@unique([provider, providerAccountId])',
      ),
    ).toBe("unknown")
    // No provider line at all
    expect(detectProvider("", "")).toBe("unknown")
  })
})

describe("detectProvider — real repository fixture", () => {
  it("detects PostgreSQL from the real migration_lock.toml and schema.prisma", () => {
    // This is the exact drift that caused the original bug: schema.prisma
    // has `provider  = "postgresql"` (two spaces), which the old substring
    // check `provider = "postgresql"` (one space) would reject.
    expect(detectProvider(REAL_LOCK, REAL_SCHEMA)).toBe("postgresql")
  })

  it("real schema.prisma uses non-canonical whitespace around provider", () => {
    // Prove the fixture is meaningful: the real schema does NOT use exactly
    // one space, which is what the old substring check required.
    expect(REAL_SCHEMA).toContain('provider  = "postgresql"')
    expect(REAL_SCHEMA).not.toContain('provider = "postgresql"')
  })

  it("real migration_lock.toml uses canonical single-space format", () => {
    expect(REAL_LOCK).toContain('provider = "postgresql"')
  })
})

describe("buildGitCommandEnv — minimal auth env for gh/git", () => {
  it("includes PATH and NODE_ENV", () => {
    const env = buildGitCommandEnv()
    expect(env.PATH).toBeDefined()
    expect(env.NODE_ENV).toBe("production")
  })

  it("includes HOME when available (gh reads ~/.config/gh/hosts.yml)", () => {
    const originalHome = process.env.HOME
    process.env.HOME = "/test/home"
    try {
      const env = buildGitCommandEnv()
      expect(env.HOME).toBe("/test/home")
    } finally {
      if (originalHome === undefined) delete process.env.HOME
      else process.env.HOME = originalHome
    }
  })

  it("includes XDG_CONFIG_HOME when available", () => {
    const original = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = "/test/xdg"
    try {
      const env = buildGitCommandEnv()
      expect(env.XDG_CONFIG_HOME).toBe("/test/xdg")
    } finally {
      if (original === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = original
    }
  })

  it("includes GH_CONFIG_DIR when available", () => {
    const original = process.env.GH_CONFIG_DIR
    process.env.GH_CONFIG_DIR = "/test/gh-config"
    try {
      const env = buildGitCommandEnv()
      expect(env.GH_CONFIG_DIR).toBe("/test/gh-config")
    } finally {
      if (original === undefined) delete process.env.GH_CONFIG_DIR
      else process.env.GH_CONFIG_DIR = original
    }
  })

  it("does NOT forward DATABASE_URL or DIRECT_URL", () => {
    const originalDb = process.env.DATABASE_URL
    const originalDirect = process.env.DIRECT_URL
    process.env.DATABASE_URL = "postgresql://secret:password@prod-host/db"
    process.env.DIRECT_URL = "postgresql://secret:password@prod-host/db"
    try {
      const env = buildGitCommandEnv()
      expect(env.DATABASE_URL ?? "").toBe("")
      expect(env.DIRECT_URL ?? "").toBe("")
      expect(JSON.stringify(env)).not.toContain("secret")
      expect(JSON.stringify(env)).not.toContain("password")
      expect(JSON.stringify(env)).not.toContain("prod-host")
    } finally {
      if (originalDb === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = originalDb
      if (originalDirect === undefined) delete process.env.DIRECT_URL
      else process.env.DIRECT_URL = originalDirect
    }
  })

  it("does NOT forward PGPASSWORD or other database credentials", () => {
    const originalPg = process.env.PGPASSWORD
    process.env.PGPASSWORD = "super-secret-db-password"
    try {
      const env = buildGitCommandEnv()
      expect(env.PGPASSWORD ?? "").toBe("")
      expect(JSON.stringify(env)).not.toContain("super-secret-db-password")
    } finally {
      if (originalPg === undefined) delete process.env.PGPASSWORD
      else process.env.PGPASSWORD = originalPg
    }
  })

  it("does NOT forward GH_TOKEN or GITHUB_TOKEN (gh uses hosts.yml, not env tokens)", () => {
    const originalGhToken = process.env.GH_TOKEN
    const originalGhubToken = process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = "ghp_secret_token_123"
    process.env.GITHUB_TOKEN = "ghp_secret_token_456"
    try {
      const env = buildGitCommandEnv()
      expect(env.GH_TOKEN ?? "").toBe("")
      expect(env.GITHUB_TOKEN ?? "").toBe("")
      expect(JSON.stringify(env)).not.toContain("ghp_secret_token")
    } finally {
      if (originalGhToken === undefined) delete process.env.GH_TOKEN
      else process.env.GH_TOKEN = originalGhToken
      if (originalGhubToken === undefined) delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = originalGhubToken
    }
  })

  it("only passes a minimal allowlist of config-location variables", () => {
    const env = buildGitCommandEnv()
    const allowedKeys = new Set(["PATH", "NODE_ENV", "HOME", "XDG_CONFIG_HOME", "GH_CONFIG_DIR"])
    const actualKeys = Object.keys(env)
    for (const key of actualKeys) {
      expect(allowedKeys.has(key)).toBe(true)
    }
  })
})
