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

## Guarded runner contract

The repository-owned runner is implemented in `scripts/production-migration-runner.ts` with pure validation in `src/lib/production-migration-guards.ts`. It is fail-closed and ordinary migrations may execute only the fixed command `node ./node_modules/prisma/build/index.js migrate deploy`.

Before any database write it requires a clean exact reviewed PR head, open/approved/mergeable PR with passing checks, PostgreSQL and pinned Prisma versions, unchanged history, exactly one expected pending additive migration, verified backup/restore evidence, explicit approval bound to PR/head/migration/identity/backup/operation ID, direct non-local Production identity, clean previous metadata, and an acquired local lock. Pooled, Preview, development, test, localhost, and disposable targets are rejected for the Production path. Destructive, data/backfill, and custom SQL paths are rejected as ordinary migrations.

The executor serializes through `flock`, does not retry ambiguous failures, redacts command output, writes an owner-only immutable audit artifact outside the repository, verifies status/schema/metadata postconditions, and never merges or deploys the application. Vercel, Preview, postinstall, and GitHub Actions do not run Production migrations.

Migration classes:

- **Additive/expand:** guarded pre-merge executor, then separate merge approval.
- **Data backfill:** separate operation with fresh backup/restore, explicit approval, and Sol review.
- **Destructive/contract:** multi-release expand/compatibility/contract sequence with high-risk approval and Sol review.
- **Emergency bridge:** emergency-only, reviewed, and reconciled to Prisma history immediately.

If the PR head changes after migration, do not merge. Never blind-retry, manually edit `_prisma_migrations`, or use a migration runner to hide drift.

## Runner interface

From the exact reviewed repository head, prepare an owner-only evidence JSON outside the repository and run preflight without `--execute`:

```text
npx tsx scripts/production-migration-runner.ts --evidence /secure/path/evidence.json
```

Only after every guard passes and the evidence contains a fresh, uniquely bound approval may the operator use `--execute`. The evidence must bind the exact PR/head, migration name/checksum, backup identifier/checksum, redacted Production identity fingerprint, and operation ID. The runner rejects generic approvals, pooled/local/Preview/development/test/disposable targets, dirty or changed heads, unexpected metadata, non-additive/custom SQL, and audit paths inside the repository. It invokes only the fixed Prisma `migrate deploy` command under a local `flock`, writes an owner-only audit file outside the repository, redacts URLs/secrets, and stops on ambiguous failure. It never runs `resolve`, merges a PR, or deploys the application.

The disposable integration harness uses only a loopback PostgreSQL target and temporary migration/schema files outside the repository; it is not a Production execution mode and must not be repurposed with a Production URL.

- Never replay legacy SQLite migration SQL.
- Never manually INSERT, UPDATE, or DELETE `_prisma_migrations`.
- Never use `db push` for Production.
- Never run Production migration from a Vercel build or Preview deployment.
- Never mark the baseline applied without an exact schema diff, checksum, backup/restore evidence, and explicit approval.
- Never drop application tables for recovery; use application rollback or a reviewed forward fix.

## Future pipeline direction

For the current small-team setup, use a guarded pre-merge Production migration executor with exact SHA/checksum, backup readiness, database identity guards, one-executor locking, Prisma advisory locking, bounded timeouts, postconditions, audit artifact, and Vercel deployment observation. Manual SQL bridges become emergency-only.
