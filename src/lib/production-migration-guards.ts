export type ExecutionMode = "open-pr" | "merged-main"

export type BackupEvidence = {
  identifier: string
  checksum: string
  restoreVerified: boolean
  offsiteVerified: boolean
}

export type ApprovalBinding = {
  operationId: string
  pr: number
  head: string
  migrationName: string
  migrationChecksum: string
  identityFingerprint: string
  backupIdentifier: string
  backupChecksum: string
  mergeCommit?: string
  issuedAt: string
  expiresAt: string
}

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
  backup?: BackupEvidence
  productionFlag: boolean
  approval?: ApprovalBinding
  target: { scheme: string; isDirect: boolean; isProduction: boolean; isDisposable: boolean; isLocal: boolean; isPreview: boolean; isDevelopment: boolean; isTest: boolean; identityFingerprint: string }
  metadata: { failed: number; rolledBack: number; unexpected: number; previousMigration: string }
  lockAvailable: boolean
  sqlKind: "additive" | "data" | "destructive"
  customSql: boolean
  auditPathOwnerOnly: boolean
  mode: ExecutionMode
  prMerged?: boolean
  prMergeCommit?: string
  mergeLineageAncestor?: boolean
  migrationBlobSha256?: string
  migrationBlobSha256AtMerge?: string
  currentMainSha?: string
  remoteMainSha?: string
}

const generic = (message: string) => message.toLowerCase().includes("approval") ? "approval binding invalid" : message

export function evaluateMigrationGuards(input: MigrationGuardInput): string[] {
  const failures: string[] = []
  const fail = (message: string) => failures.push(generic(message))
  if (input.mode !== "open-pr" && input.mode !== "merged-main") return ["execution mode must be open-pr or merged-main"]
  if (input.mode === "open-pr" && input.prMerged === true) return ["ambiguous: open-pr mode but prMerged is true"]
  if (input.mode === "merged-main" && input.prOpen === true) return ["ambiguous: merged-main mode but prOpen is true"]

  if (!input.workingTreeClean) fail("working tree is dirty")
  if (!input.localHead || input.localHead !== input.expectedHead) fail("local head mismatch")
  if (input.provider !== "postgresql") fail("provider is not PostgreSQL")
  if (input.prismaVersion !== "5.22.0" || input.clientVersion !== "5.22.0") fail("Prisma version is not pinned")
  if (!input.historyUnchanged) fail("historical migration checksum changed")
  if (input.pendingMigrations.length !== 1 || input.pendingMigrations[0]?.name !== input.expectedMigration.name || input.pendingMigrations[0]?.checksum !== input.expectedMigration.checksum) fail("pending migration list mismatch")
  if (!input.backup || !input.backup.identifier || !input.backup.checksum || !input.backup.restoreVerified) fail("backup evidence invalid")
  if (!input.productionFlag) fail("explicit Production flag missing")

  const approval = input.approval
  const issuedAt = approval ? Date.parse(approval.issuedAt) : Number.NaN
  const expiresAt = approval ? Date.parse(approval.expiresAt) : Number.NaN
  if (!approval || approval.operationId.length < 8 || approval.operationId === "yes" || approval.migrationName !== input.expectedMigration.name || approval.migrationChecksum !== input.expectedMigration.checksum || approval.identityFingerprint !== input.target.identityFingerprint || approval.backupIdentifier !== input.backup?.identifier || approval.backupChecksum !== input.backup?.checksum || Number.isNaN(issuedAt) || Number.isNaN(expiresAt) || issuedAt > Date.now() || expiresAt <= issuedAt || expiresAt <= Date.now()) fail("approval binding invalid")

  const target = input.target
  if (target.scheme !== "postgresql" || !target.isDirect || !target.isProduction || target.isDisposable || target.isLocal || target.isPreview || target.isDevelopment || target.isTest) fail("database target is not an approved direct Production target")
  if (approval && approval.identityFingerprint !== target.identityFingerprint) fail("Production identity mismatch")
  if (input.metadata.failed || input.metadata.rolledBack || input.metadata.unexpected) fail("migration metadata contains failed, rolled-back, or unexpected records")
  if (input.metadata.previousMigration !== "20260824000000_postgresql_baseline") fail("previous migration state mismatch")
  if (!input.lockAvailable) fail("runner lock unavailable")
  if (input.sqlKind !== "additive") fail("ordinary path rejects data or destructive migration")
  if (input.customSql) fail("ordinary path rejects custom SQL")
  if (!input.auditPathOwnerOnly) fail("audit artifact permissions are not owner-only")

  if (input.mode === "open-pr") {
    if (!input.remoteHead || input.remoteHead !== input.expectedHead) fail("remote PR head mismatch")
    if (!input.prOpen) fail("PR is not open")
    if (!input.prApproved) fail("PR is not approved")
    if (!input.mergeable) fail("PR is not mergeable")
    if (!input.checksPass) fail("required checks are not pass")
    if (approval && (approval.pr !== input.expectedPr || approval.head !== input.expectedHead)) fail("approval binding invalid")
  } else {
    if (input.prMerged !== true) fail("introducing PR is not merged")
    if (!input.prMergeCommit || !/^[0-9a-f]{40}$/.test(input.prMergeCommit)) fail("introducing PR merge commit is invalid")
    if (input.mergeLineageAncestor !== true) fail("merge commit is not ancestor of current main")
    if (input.migrationBlobSha256 !== input.expectedMigration.checksum) fail("migration file changed since merge")
    if (input.migrationBlobSha256AtMerge !== input.expectedMigration.checksum) fail("migration file at introducing merge does not match expected checksum")
    if (!input.currentMainSha || input.currentMainSha !== input.localHead) fail("current main SHA does not match local HEAD")
    if (!input.currentMainSha || input.currentMainSha !== input.expectedHead) fail("current main SHA does not match approval-bound expected head")
    if (!input.remoteMainSha || input.remoteMainSha !== input.currentMainSha) fail("fetched origin/main does not match current main")
    if (input.expectedPr !== 92) fail("introducing PR number mismatch")
    if (approval && (approval.pr !== 92 || approval.head !== input.currentMainSha || approval.mergeCommit !== input.prMergeCommit)) fail("approval binding invalid")
    if (!input.backup?.offsiteVerified) fail("offsite backup copy not verified")
  }
  return failures
}
