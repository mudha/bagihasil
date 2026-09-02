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
    expect(packageJson.scripts?.["prisma:generate:runtime"]).toContain("--schema prisma/schema.runtime-legacy.prisma")
    expect(packageJson.scripts?.postinstall).toContain("prisma:generate:runtime")
    expect(packageJson.scripts?.build).toContain("prisma:generate:runtime")
    expect(packageJson.scripts?.pretest).toContain("prisma:generate:runtime")
    expect(packageJson.scripts?.pretypecheck).toContain("prisma:generate:runtime")
    expect(packageJson.scripts?.["pretest:e2e"]).toContain("prisma:generate:runtime")
  })
})
