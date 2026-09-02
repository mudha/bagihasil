import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const runtimeSchemaPath = "prisma/schema.runtime-legacy.prisma"
const canonicalSchemaPath = "prisma/schema.prisma"
const pendingMigrationPath = "prisma/migrations/20260830222005_loss_capital_ledger_foundation/migration.sql"
const expectedRuntimeSchemaSha = "bbc1f5c5f6e352a63af78a4589ad51f01546454dca292ce56b4f0c0c8df5a8bf"
const expectedPendingMigrationSha = "2de7d2e9ca11d799447f3e5a822655cbb6072316e88226ae7b81ff07858a3ad4"
const pendingSymbols = [
  "capitalLedgerOpenedAt",
  "finalizationVersion",
  "determinedLosses",
  "transactionLosses",
  "capitalMovements",
  "LossResponsibility",
  "LedgerTreatment",
  "CapitalMovementType",
  "CapitalMovementDirection",
  "CapitalMovementSource",
  "TransactionLoss",
  "CapitalMovement",
]

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex")

describe("legacy Prisma runtime schema guard", () => {
  it("requires a deterministic pre-ledger runtime schema", () => {
    expect(existsSync(runtimeSchemaPath)).toBe(true)
    expect(sha256(runtimeSchemaPath)).toBe(expectedRuntimeSchemaSha)
    const runtime = readFileSync(runtimeSchemaPath, "utf8")
    for (const symbol of pendingSymbols) expect(runtime).not.toContain(symbol)
  })

  it("keeps canonical schema and pending migration intact", () => {
    expect(existsSync(canonicalSchemaPath)).toBe(true)
    expect(readFileSync(canonicalSchemaPath, "utf8")).toContain("finalizationVersion")
    expect(sha256(pendingMigrationPath)).toBe(expectedPendingMigrationSha)
  })

  it("routes application generation through the legacy schema", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>
    }
    expect(packageJson.scripts?.["prisma:generate:runtime"]).toBe("prisma generate --schema prisma/schema.runtime-legacy.prisma")
    expect(packageJson.scripts?.postinstall).toBe("npm run prisma:generate:runtime")
    expect(packageJson.scripts?.build).toBe("npm run prisma:generate:runtime && npm run prisma:verify:runtime && next build")
    expect(packageJson.scripts?.predev).toBe("npm run prisma:generate:runtime && npm run prisma:verify:runtime")
    expect(packageJson.scripts?.prestart).toBe("npm run prisma:generate:runtime && npm run prisma:verify:runtime")
    expect(packageJson.scripts?.pretest).toBe("npm run prisma:generate:runtime")
    expect(packageJson.scripts?.pretypecheck).toBe("npm run prisma:generate:runtime")
    for (const name of ["test:e2e", "test:e2e:auth", "test:e2e:unit", "test:e2e:transaction", "test:e2e:finalize", "test:e2e:payment"]) {
      expect(packageJson.scripts?.[`pre${name}`]).toBe("npm run prisma:generate:runtime")
    }
  })
})
