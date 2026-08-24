# Production PostgreSQL baseline metadata adoption runbook

**Status: plan only. This runbook is not authorized by the baseline PR.**

The operation below writes Prisma migration metadata to Production. It must stop until the user gives explicit approval immediately before the `migrate resolve` command.

## Preconditions

- Baseline PR is merged and exact `main` SHA is recorded.
- Baseline name is exactly `20260824000000_postgresql_baseline`.
- Baseline SQL checksum matches the committed manifest.
- Prisma CLI is exactly `5.22.0`.
- A fresh encrypted backup taken after PR #63 is checksum-verified.
- Backup decrypt/`pg_restore --list` and isolated restore verification pass.
- Production identity is privately verified by exact database name and host fingerprint.
- Direct PostgreSQL URL is loaded only from a mode-0600 private environment source; it is never printed.
- Production schema ↔ `schema.prisma` diff is empty.
- `_prisma_migrations` is confirmed absent.
- No failed or unexpected migration state exists.
- No concurrent deploy/migration operation is active.

## Explicit approval boundary

Stop and ask the user for approval immediately before this command:

```bash
node ./node_modules/prisma/build/index.js migrate resolve \
  --applied 20260824000000_postgresql_baseline
```

Approval must explicitly cover:

- creation/write of `_prisma_migrations` metadata;
- post-resolve metadata inspection;
- `prisma migrate status`;
- one expected no-op `prisma migrate deploy`;
- read-only schema and aggregate fingerprint verification.

No approval is implied by review of this document or by merging the baseline PR.

## Guarded execution sequence

1. Verify clean worktree, exact merged SHA, baseline name, and baseline checksum.
2. Verify private Production database name/host identity. Refuse any mismatch.
3. Verify fresh encrypted backup checksum and isolated restore evidence.
4. Capture private pre-operation schema fingerprint, table/column/index/FK metadata, and aggregate financial fingerprints. Do not log rows, PII, URLs, credentials, or individual amounts.
5. Re-run the schema ↔ Prisma empty diff against the exact Production direct connection. Abort if non-empty.
6. Confirm `_prisma_migrations` is absent and no unexpected migration state exists.
7. Obtain explicit user approval at the boundary above.
8. Run `migrate resolve --applied` from the exact merged repository head.
9. Inspect `_prisma_migrations` read-only. Require exactly one expected successful baseline record with:
   - exact migration name;
   - checksum equal to committed baseline SHA-256;
   - non-null finished timestamp;
   - null rollback timestamp;
   - no failed/unknown records.
10. Run `prisma migrate status`; require database up to date.
11. Run exactly one `prisma migrate deploy`; require strict no-op/no pending migrations.
12. Recompute schema and aggregate fingerprints. Require unchanged application schema and data.
13. Record a redacted audit artifact outside the repository containing UTC/WIB timestamps, exact SHA, baseline checksum, backup identifier/checksum, Prisma version, redacted identity fingerprint, metadata summary, status/deploy result, and smoke result.

## Recovery and stop conditions

Stop immediately if:

- identity, checksum, or schema diff is unexpected;
- `_prisma_migrations` contains unexpected data;
- resolve reports an already-applied but mismatched migration;
- status is not clean;
- deploy proposes any migration;
- schema/data fingerprints change;
- database becomes unavailable;
- any command exposes a secret or raw data.

Do not manually INSERT/UPDATE/DELETE `_prisma_migrations`. Do not drop tables. Do not replay SQLite migrations. Preserve evidence and use a reviewed forward recovery plan.

If application deployment fails after metadata adoption, rollback application code only when needed; do not remove the baseline metadata or drop additive schema. Future migrations remain blocked until investigation.

If the operator repeats the operation, the guard must stop before mutation when the expected baseline record already exists. A failed/partial state requires fresh review, not blind retry.

## Completion

Completion requires all preconditions, expected metadata, clean status, no-op deploy, unchanged schema/data fingerprints, redacted audit artifact, and explicit record that no manual deployment/redeploy or destructive database action occurred.
