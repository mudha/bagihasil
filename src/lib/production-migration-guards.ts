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
  // merged-main specific
  prMerged?: boolean
  prMergeCommit?: string
  mergeLineageAncestor?: boolean
  migrationBlobSha256?: string
  currentMainSha?: string
}

const generic = (message: string) => message.toLowerCase().includes("approval") ? "approval binding invalid" : message

function isOpenPrMode(input: MigrationGuardInput): boolean {
  return input.mode === "open-pr"
}

function isMergedMainMode(input: MigrationGuardInput): boolean {
  return input.mode === "merged-main"
}

export function evaluateMigrationGuards(input: MigrationGuardInput): string[] {
  const failures: string[] = []
  const fail = (message: string) => failures.push(generic(message))

  // Mode validation
  if (!input.mode || (input.mode !== "open-pr" && input.mode !== "merged-main")) {
    fail("execution mode must be open-pr or merged-main")
    return failures // Cannot proceed without valid mode
  }

  // Ambiguity: mode=open-pr but prMerged=true, or mode=merged-main but prOpen=true
  if (isOpenPrMode(input) && input.prMerged === true) {
    fail("ambiguous: open-pr mode but prMerged is true")
    return failures
  }
  if (isMergedMainMode(input) && input.prOpen === true) {
    fail("ambiguous: merged-main mode but prOpen is true")
    return failures
  }

  // === Shared guards (both modes) ===
  if (!input.workingTreeClean) fail("working tree is dirty")
  if (!input.localHead || input.localHead !== input.expectedHead) fail("local head mismatch")
  if (input.provider !== "postgresql") fail("provider is not PostgreSQL")
  if (input.prismaVersion !== "5.22.0" || input.clientVersion !== "5.22.0") fail("Prisma version is not pinned")
  if (!input.historyUnchanged) fail("historical migration checksum changed")
  if (!input.backup || !input.backup.identifier || !input.backup.checksum || !input.backup.restoreVerified) fail("backup evidence invalid")
  if (!input.productionFlag) fail("explicit Production flag missing")
  const a = input.approval
  if (!a || a.operationId.length < 8 || a.operationId === "yes" || a.migrationName !== input.expectedMigration.name || a.migrationChecksum !== input.expectedMigration.checksum || a.identityFingerprint !== input.target.identityFingerprint || a.backupIdentifier !== input.backup?.identifier || a.backupChecksum !== input.backup?.checksum || Number.isNaN(Date.parse(a.issuedAt))) fail("approval binding invalid")
  const t = input.target
  if (t.scheme !== "postgresql" || !t.isDirect || !t.isProduction || t.isDisposable || t.isLocal || t.isPreview || t.isDevelopment || t.isTest) fail("database target is not an approved direct Production target")
  if (a && a.identityFingerprint !== t.identityFingerprint) fail("Production identity mismatch")
  if (input.metadata.failed || input.metadata.rolledBack || input.metadata.unexpected) fail("migration metadata contains failed, rolled-back, or unexpected records")
  if (input.metadata.previousMigration !== "20260824000000_postgresql_baseline") fail("previous migration state mismatch")
  if (!input.lockAvailable) fail("runner lock unavailable")
  if (input.sqlKind !== "additive") fail("ordinary path rejects data or destructive migration")
  if (input.customSql) fail("ordinary path rejects custom SQL")
  if (!input.auditPathOwnerOnly) fail("audit artifact permissions are not owner-only")

  // === Mode-specific guards ===
  if (isOpenPrMode(input)) {
    // Existing open-pr guards (unchanged)
    if (!input.remoteHead || input.remoteHead !== input.expectedHead) fail("remote PR head mismatch")
    if (!input.prOpen) fail("PR is not open")
    if (!input.prApproved) fail("PR is not approved")
    if (!input.mergeable) fail("PR is not mergeable")
    if (!input.checksPass) fail("required checks are not pass")
    if (a && a.pr !== input.expectedPr) fail("approval binding invalid")
    if (a && a.head !== input.expectedHead) fail("approval binding invalid")
  }

  if (isMergedMainMode(input)) {
    // merged-main guards
    if (input.prMerged !== true) fail("introducing PR is not merged")
    if (input.mergeLineageAncestor !== true) fail("merge commit is not ancestor of current main")
    if (!input.migrationBlobSha256 || input.migrationBlobSha256 !== input.expectedMigration.checksum) fail("migration file changed since merge")
    if (!input.currentMainSha || input.currentMainSha !== input.localHead) fail("current main SHA does not match local HEAD")
    if (!input.currentMainSha || input.currentMainSha !== input.expectedHead) fail("current main SHA does not match expected head")
    if (input.expectedPr !== 92) fail("introducing PR number mismatch")
    if (a && a.pr !== 92) fail("approval binding invalid")
    if (a && a.head !== input.currentMainSha) fail("approval binding invalid")
    // Approval expiry
    if (a && a.expiresAt && !Number.isNaN(Date.parse(a.expiresAt))) {
      if (new Date(a.expiresAt).getTime() <= Date.now()) fail("approval has expired")
    }
    // Offsite backup
    if (!input.backup?.offsiteVerified) fail("offsite backup copy not verified")
  }

  return failures
}
