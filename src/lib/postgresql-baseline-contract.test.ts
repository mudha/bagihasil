import { createHash } from "node:crypto"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = resolve(__dirname, "../..")
const active = join(root, "prisma", "migrations")
const baselineDir = join(active, "20260824000000_postgresql_baseline")
const baseline = join(baselineDir, "migration.sql")
const manifest = JSON.parse(readFileSync(join(root, "docs/database/postgresql/legacy-migrations/manifest.json"), "utf8")) as {
  baselineMigration: string
  legacyMigrations: Array<{ name: string; sha256: string }>
}
const prismaPackage = JSON.parse(readFileSync(join(root, "node_modules/prisma/package.json"), "utf8")) as { version: string }
const prismaClientPackage = JSON.parse(readFileSync(join(root, "node_modules/@prisma/client/package.json"), "utf8")) as { version: string }

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

describe("PostgreSQL baseline repository contract", () => {
  it("declares PostgreSQL and exactly one active baseline", () => {
    expect(readFileSync(join(active, "migration_lock.toml"), "utf8")).toContain('provider = "postgresql"')
    const folders = readdirSync(active).filter((name) => statSync(join(active, name)).isDirectory())
    expect(folders).toEqual([manifest.baselineMigration])
    expect(manifest.baselineMigration).toBe("20260824000000_postgresql_baseline")
    expect(readFileSync(baseline, "utf8")).toContain('CREATE TABLE "Investor"')
  })

  it("preserves archived migration bytes and keeps them outside active migrations", () => {
    for (const entry of manifest.legacyMigrations) {
      const archived = join(root, "docs/database/postgresql/legacy-migrations", entry.name, "migration.sql")
      expect(sha256(archived)).toBe(entry.sha256)
      expect(foldersUnderActive()).not.toContain(entry.name)
    }
  })

  it("locks the Prisma CLI and Client to the audited version", () => {
    expect(prismaPackage.version).toBe("5.22.0")
    expect(prismaClientPackage.version).toBe("5.22.0")
  })

  it("matches the generated baseline evidence checksum", () => {
    expect(sha256(baseline)).toBe("7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd")
  })

  it("contains PostgreSQL schema only, without data or destructive statements", () => {
    const sql = readFileSync(baseline, "utf8")
    expect(sql.match(/^CREATE TABLE/gm)?.length).toBe(12)
    expect(sql.match(/^CREATE UNIQUE INDEX/gm)?.length).toBe(9)
    expect(sql.match(/FOREIGN KEY/g)?.length).toBe(11)
    expect(sql).toContain("managedCapitalBalance")
    expect(sql).toContain("idempotencyKey")
    expect(sql).toContain("TransactionProof")
    expect(sql).not.toMatch(/\b(?:AUTOINCREMENT|PRAGMA|DATETIME)\b/i)
    expect(sql).not.toMatch(/^(?:DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b/im)
  })
})

function foldersUnderActive() {
  return readdirSync(active).filter((name) => statSync(join(active, name)).isDirectory())
}
