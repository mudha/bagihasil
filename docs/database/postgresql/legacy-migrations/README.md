# Legacy migration archive

This directory is a **non-executable archive** of the former migration history. It must never be configured as Prisma's active migration directory or copied back into `prisma/migrations`.

- Former provider: SQLite
- Active provider: PostgreSQL
- Executable source of truth: `prisma/migrations/20260824000000_postgresql_baseline`
- Git history remains the audit trail for the archived files.

Archived migrations:

- `20251206065421_add_proof_models`: SQLite-oriented SQL (`DATETIME`, SQLite semantics); it must never be replayed against PostgreSQL.
- `20260823000000_add_investor_managed_capital`: PostgreSQL-compatible bridge-era SQL already applied through the guarded SQL procedure and incorporated into the current-state baseline.

Future migration tooling must scan only the active `prisma/migrations` directory. Any legacy SQLite token or provider in that directory is a merge blocker.

The archive contains no credentials, database URLs, PII, or financial row data.

Production metadata adoption is not performed by the baseline PR. It requires a separate approved operation using the production runbook.

## Lineage

The current-state baseline is generated from the exact `prisma/schema.prisma` with Prisma `5.22.0`. The baseline includes the managed-capital schema introduced by PR #63. It is not created by replaying either archived migration.

Before future schema PRs, verify that this archive remains outside the active migration directory and that its bytes/checksums are unchanged.
