export type MigrationGuardInput = {
  workingTreeClean: boolean
  localHead: string
  expectedHead: string
  remoteHead: string
  prOpen: boolean
  expectedPr: number
  prApproved: boolean
  mergeable: boolean
  checksPass: boolean
  provider: string
  prismaVersion: string
  clientVersion: string
  historyUnchanged: boolean
  pendingMigrations: Array<{ name: string; checksum: string }>
  expectedMigration: { name: string; checksum: string }
  backup?: { identifier: string; checksum: string; restoreVerified: boolean }
  productionFlag: boolean
  approval?: { operationId: string; pr: number; head: string; migrationName: string; migrationChecksum: string; identityFingerprint: string; backupIdentifier: string; backupChecksum: string; issuedAt: string }
  target: { scheme: string; isDirect: boolean; isProduction: boolean; isDisposable: boolean; isLocal: boolean; isPreview: boolean; isDevelopment: boolean; isTest: boolean; identityFingerprint: string }
  metadata: { failed: number; rolledBack: number; unexpected: number; previousMigration: string }
  lockAvailable: boolean
  sqlKind: "additive" | "data" | "destructive"
  customSql: boolean
  auditPathOwnerOnly: boolean
}

const generic = (message: string) => message.toLowerCase().includes("approval") ? "approval binding invalid" : message

export function evaluateMigrationGuards(input: MigrationGuardInput): string[] {
  const failures: string[] = []
  const fail = (message: string) => failures.push(generic(message))
  if (!input.workingTreeClean) fail("working tree is dirty")
  if (!input.localHead || input.localHead !== input.expectedHead) fail("local head mismatch")
  if (!input.remoteHead || input.remoteHead !== input.expectedHead) fail("remote PR head mismatch")
  if (!input.prOpen) fail("PR is not open")
  if (!input.prApproved) fail("PR is not approved")
  if (!input.mergeable) fail("PR is not mergeable")
  if (!input.checksPass) fail("required checks are not pass")
  if (input.provider !== "postgresql") fail("provider is not PostgreSQL")
  if (input.prismaVersion !== "5.22.0" || input.clientVersion !== "5.22.0") fail("Prisma version is not pinned")
  if (!input.historyUnchanged) fail("historical migration checksum changed")
  if (input.pendingMigrations.length !== 1 || input.pendingMigrations[0]?.name !== input.expectedMigration.name || input.pendingMigrations[0]?.checksum !== input.expectedMigration.checksum) fail("pending migration list mismatch")
  if (!input.backup || !input.backup.identifier || !input.backup.checksum || !input.backup.restoreVerified) fail("backup evidence invalid")
  if (!input.productionFlag) fail("explicit Production flag missing")
  const a = input.approval
  if (!a || a.operationId.length < 8 || a.operationId === "yes" || a.pr !== input.expectedPr || a.head !== input.expectedHead || a.migrationName !== input.expectedMigration.name || a.migrationChecksum !== input.expectedMigration.checksum || a.identityFingerprint !== input.target.identityFingerprint || a.backupIdentifier !== input.backup?.identifier || a.backupChecksum !== input.backup?.checksum || Number.isNaN(Date.parse(a.issuedAt))) fail("approval binding invalid")
  const t = input.target
  if (t.scheme !== "postgresql" || !t.isDirect || !t.isProduction || t.isDisposable || t.isLocal || t.isPreview || t.isDevelopment || t.isTest) fail("database target is not an approved direct Production target")
  if (a && a.identityFingerprint !== t.identityFingerprint) fail("Production identity mismatch")
  if (input.metadata.failed || input.metadata.rolledBack || input.metadata.unexpected) fail("migration metadata contains failed, rolled-back, or unexpected records")
  if (input.metadata.previousMigration !== "20260824000000_postgresql_baseline") fail("previous migration state mismatch")
  if (!input.lockAvailable) fail("runner lock unavailable")
  if (input.sqlKind !== "additive") fail("ordinary path rejects data or destructive migration")
  if (input.customSql) fail("ordinary path rejects custom SQL")
  if (!input.auditPathOwnerOnly) fail("audit artifact permissions are not owner-only")
  return failures
}
