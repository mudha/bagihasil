# PostgreSQL baseline adoption plan

## Why this is separate

The application datasource is PostgreSQL, but the repository's historical Prisma migration metadata declares SQLite and contains only an old SQLite migration. `prisma migrate deploy` must not be used against Production until that history is reconciled.

The payment idempotency change was therefore applied through a guarded PostgreSQL SQL runner. This document describes the next safe step; it is not an instruction to alter Production now.

## Current evidence

- Production schema was introspected read-only after the idempotency migration.
- Production contains 13 application models.
- `PaymentHistory.idempotencyKey` and `PaymentHistory.idempotencyFingerprint` are present.
- The repository still contains `prisma/migrations/migration_lock.toml` with `provider = "sqlite"`.
- No historical SQLite migration may be replayed against PostgreSQL.

## Required future procedure

1. Take a fresh encrypted Production backup and verify checksum.
2. Restore the backup into a disposable PostgreSQL database.
3. Generate a PostgreSQL schema snapshot from the disposable restore.
4. Compare the snapshot against `prisma/schema.prisma` and resolve every difference.
5. On a branch, create an official PostgreSQL baseline migration from the approved snapshot. Do not create it by replaying the SQLite migration.
6. Mark the baseline as applied only in a disposable clone first, using the exact Prisma version used by the application.
7. Run `prisma migrate status` and `prisma generate` against the disposable clone.
8. Test a second disposable database created from the baseline plus a no-op follow-up migration.
9. Obtain owner/DBA approval for the baseline SQL, migration table strategy, rollback/forward-fix policy, and deployment window.
10. Only then apply the approved metadata adoption procedure to Production. This may require Prisma's baseline-resolution workflow and must be performed by an operator who can verify the resulting `_prisma_migrations` state.

## Non-negotiable guards

- Never run `prisma migrate deploy`, `prisma db push`, seed, cleanup, or browser E2E write against Production during baseline work.
- Never change `migration_lock.toml` alone and claim the history is repaired.
- Never mark a migration applied without verifying the actual schema and checksum.
- Never delete or rewrite existing Production data to make a migration fit.
- Keep the current guarded SQL runner as the rollback/forward-fix path until the official baseline is proven.

## Definition of done

The baseline task is complete only when:

- the repository declares PostgreSQL consistently;
- migration history is PostgreSQL and has an approved baseline;
- a disposable clone passes `prisma migrate status` with no drift;
- a new disposable database can be built from baseline plus follow-up migration;
- Production backup, restore, rollback/forward-fix, owner approval, and monitoring are documented;
- a read-only Production verification confirms the expected `_prisma_migrations` state and unchanged financial totals.

Until then, PostgreSQL schema changes remain explicit reviewed SQL changes, not automatic Prisma deployments.
