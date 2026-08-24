# PostgreSQL baseline adoption plan

## Scope

This plan describes the repository baseline and the later Production metadata adoption. The baseline PR changes migration history layout only. It does not access Production, create `_prisma_migrations` in Production, or run a schema migration there.

## Canonical layout

- Active provider: PostgreSQL.
- Active migration source: `prisma/migrations/`.
- Active migrations: one current-state baseline, `20260824000000_postgresql_baseline`.
- Legacy SQLite/bridge-era migrations: documentation-only under `docs/database/postgresql/legacy-migrations/`.
- Do not replay or copy archived SQLite SQL into the active directory.

## Baseline contract

The baseline is generated from the exact current `schema.prisma` with locked Prisma `5.22.0` using `migrate diff --from-empty --to-schema-datamodel`. It must be PostgreSQL-only, deterministic, data-free, and preserve current types, nullability, defaults, indexes, foreign keys, and referential actions. Legacy financial `Float` fields are not converted as baseline cleanup.

The committed SQL checksum and lineage are recorded in `postgresql-baseline-manifest.md`. Semantic manual edits are prohibited.

## Disposable rehearsal before Production adoption

1. Restore the verified encrypted backup to a disposable PostgreSQL database.
2. Reconstruct the post-PR#63 schema only on disposable using the exact reviewed bridge SQL.
3. Verify schema ↔ Prisma diff is empty and capture private fingerprints.
4. From the exact baseline repository head, run only on disposable:

   ```text
   prisma migrate resolve --applied 20260824000000_postgresql_baseline
   prisma migrate status
   prisma migrate deploy
   ```

5. Require one successful expected metadata record, exact name/checksum, no failed/rolled-back record, clean status, and a strict no-op deploy.
6. On a second empty disposable database, run `prisma migrate deploy` twice and require one baseline record and no-op second deploy.
7. Confirm schema and data fingerprints are unchanged on the existing-schema clone.
8. Cleanup must leave zero disposable databases, roles, plaintext, and temporary SQL files.

No Production operation is authorized by this plan.

## Production adoption sequencing

Merge the baseline repository PR first. After the merged exact SHA is observed and runtime remains healthy, obtain separate explicit user approval. Only then perform the Production metadata adoption described in `production-baseline-adoption-runbook.md`.

Future schema work is blocked between baseline merge and successful Production metadata adoption. After adoption, ordinary schema changes must use PostgreSQL Prisma migrations and the guarded pre-merge executor.

## Non-negotiable rules

- Never replay legacy SQLite migration SQL.
- Never manually INSERT, UPDATE, or DELETE `_prisma_migrations`.
- Never use `db push` for Production.
- Never run Production migration from a Vercel build or Preview deployment.
- Never mark the baseline applied without an exact schema diff, checksum, backup/restore evidence, and explicit approval.
- Never drop application tables for recovery; use application rollback or a reviewed forward fix.

## Future pipeline direction

For the current small-team setup, use a guarded pre-merge Production migration executor with exact SHA/checksum, backup readiness, database identity guards, one-executor locking, Prisma advisory locking, bounded timeouts, postconditions, audit artifact, and Vercel deployment observation. Manual SQL bridges become emergency-only.
