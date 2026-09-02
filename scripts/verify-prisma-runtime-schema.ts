import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Prisma } from "@prisma/client"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const runtimeSchemaPath = join(root, "prisma/schema.runtime-legacy.prisma")
const canonicalSchemaPath = join(root, "prisma/schema.prisma")
const pendingMigrationPath = join(root, "prisma/migrations/20260830222005_loss_capital_ledger_foundation/migration.sql")
const generatedSchemaPath = join(root, "node_modules/.prisma/client/schema.prisma")

const expected = {
  runtimeSchemaSha: "bbc1f5c5f6e352a63af78a4589ad51f01546454dca292ce56b4f0c0c8df5a8bf",
  canonicalSchemaSha: "99234e7df15a31ffdcf5bb9b18488a81fd54accf81eded83d683992f7bc255a1",
  migrationSha: "2de7d2e9ca11d799447f3e5a822655cbb6072316e88226ae7b81ff07858a3ad4",
}

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
] as const

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex")
const fail = (message: string): never => { throw new Error(`BLOCKED: ${message}`) }
const requireFile = (path: string) => { if (!existsSync(path)) fail(`missing file ${path}`) }

function verifySourceDoesNotUsePendingGeneratedSymbols() {
  const forbidden = [
    /Prisma\.(TransactionLoss|CapitalMovement|LossResponsibility|LedgerTreatment|CapitalMovementType|CapitalMovementDirection|CapitalMovementSource)/,
    /(?:prisma|tx)\.(transactionLoss|capitalMovement)/,
  ]
  const violations: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
        const source = readFileSync(path, "utf8")
        if (forbidden.some((pattern) => pattern.test(source))) violations.push(path)
      }
    }
  }
  visit(join(root, "src"))
  if (violations.length) fail(`runtime source references pending Prisma symbols: ${violations.join(", ")}`)
}

function verifyGeneratedSchemaProvenance(runtimeSchema: string) {
  const temp = mkdtempSync(join(root, ".tmp-runtime-schema-"))
  const formattedPath = join(temp, "schema.prisma")
  try {
    writeFileSync(formattedPath, runtimeSchema)
    execFileSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "format", "--schema", formattedPath], {
      cwd: root,
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "true" },
      stdio: "ignore",
    })
    if (readFileSync(formattedPath, "utf8") !== readFileSync(generatedSchemaPath, "utf8")) {
      fail("generated client schema does not structurally match runtime schema")
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

function verifyDmmf() {
  const modelNames = new Set(Prisma.dmmf.datamodel.models.map((model) => model.name))
  const enumNames = new Set(Prisma.dmmf.datamodel.enums.map((enumType) => enumType.name))
  const transaction = Prisma.dmmf.datamodel.models.find((model) => model.name === "Transaction")
  const investor = Prisma.dmmf.datamodel.models.find((model) => model.name === "Investor")
  if (modelNames.has("TransactionLoss") || modelNames.has("CapitalMovement")) fail("generated DMMF contains pending ledger models")
  for (const name of ["LossResponsibility", "LedgerTreatment", "CapitalMovementType", "CapitalMovementDirection", "CapitalMovementSource"]) {
    if (enumNames.has(name)) fail(`generated DMMF contains pending enum ${name}`)
  }
  if (transaction?.fields.some((field) => field.name === "finalizationVersion")) fail("generated DMMF contains finalizationVersion")
  if (investor?.fields.some((field) => field.name === "capitalLedgerOpenedAt")) fail("generated DMMF contains capitalLedgerOpenedAt")
}

function main() {
  requireFile(runtimeSchemaPath)
  requireFile(canonicalSchemaPath)
  requireFile(pendingMigrationPath)
  requireFile(generatedSchemaPath)

  if (sha256(runtimeSchemaPath) !== expected.runtimeSchemaSha) fail("runtime schema is not the exact pre-ledger schema")
  if (sha256(canonicalSchemaPath) !== expected.canonicalSchemaSha) fail("canonical schema changed from audited state")
  if (sha256(pendingMigrationPath) !== expected.migrationSha) fail("pending migration checksum changed")

  const runtimeSchema = readFileSync(runtimeSchemaPath, "utf8")
  const canonicalSchema = readFileSync(canonicalSchemaPath, "utf8")
  for (const symbol of pendingSymbols) {
    if (runtimeSchema.includes(symbol)) fail(`runtime schema contains pending symbol ${symbol}`)
    if (!canonicalSchema.includes(symbol)) fail(`canonical schema lost pending symbol ${symbol}`)
  }

  verifyGeneratedSchemaProvenance(runtimeSchema)
  verifyDmmf()
  verifySourceDoesNotUsePendingGeneratedSymbols()
  console.log("runtime_prisma_guard=PASS schema=pre-ledger client=single-global dmmf=pending-symbols-absent migration=unchanged")
}

main()
