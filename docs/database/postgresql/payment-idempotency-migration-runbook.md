# Payment idempotency PostgreSQL migration

## Status and execution path

This is an explicit PostgreSQL migration because the repository's historical Prisma migration metadata is SQLite-based and Production has no `_prisma_migrations` table.

**Do not use `prisma migrate deploy`, `prisma db push`, or execute the reference SQL directly.** Production execution must use:

```bash
scripts/migrate-payment-idempotency-postgres.sh
```

The guarded runner validates database host and name, explicit approvals, schema state, duplicates, timeouts, and final postconditions.

## Required ordering

1. Verify repository branch and intended release commit.
2. Create a fresh custom-format Production backup outside the repository.
3. Verify checksum and `pg_restore --list`.
4. Restore the dump to an isolated database and compare row-count and financial fingerprints.
5. Dry-run the guarded runner against that restored database.
6. Run the guarded migration against Production.
7. Verify Production schema and unchanged payment counts/totals.
8. Only then deploy application code generated from the new Prisma schema.
9. Run read-only Production smoke tests and monitor errors.

Never deploy the new application schema before the database migration passes.

## Production invocation requirements

Load the Production direct PostgreSQL URL privately. Do not print it. Set:

- `EXPECTED_DATABASE_NAME` to the verified Production database name;
- `EXPECTED_DATABASE_HOST` to the exact verified Production hostname;
- `ALLOW_PRODUCTION_MIGRATION=YES_I_HAVE_VERIFIED_BACKUP`;
- `BACKUP_VERIFIED=YES`.

The runner uses a transaction, `lock_timeout=5s`, `statement_timeout=60s`, and `ON_ERROR_STOP=1`. Any failed guard or postcondition rolls back and blocks deployment.

## Change

The migration adds nullable text columns:

- `PaymentHistory.idempotencyKey`;
- `PaymentHistory.idempotencyFingerprint`.

It creates a unique btree index on `idempotencyKey`. Existing rows remain valid because PostgreSQL permits multiple NULL values in a unique index.

## Acceptance checks

After migration, verify:

- both columns exist, are nullable, and have type `text`;
- the named index is unique and indexes only `idempotencyKey`;
- existing `PaymentHistory` row count and amount total are unchanged;
- application tests, typecheck, lint, and build pass;
- same-key/same-payload retry creates one payment;
- same-key/different-payload returns `409`;
- replay does not emit a duplicate notification.

## Rollback

The immediate safe rollback is:

1. roll back application deployment to the previous commit;
2. leave the two nullable columns and index in place;
3. verify previous application login and read-only payment views;
4. investigate before any destructive database rollback.

Do not drop the columns automatically. If destructive rollback is approved later, preserve non-NULL idempotency data first and use the verified backup artifact recorded for the operation.

## Recovery checkpoint

Before execution, record privately:

- backup absolute path;
- SHA-256 checksum;
- source database host/name and server version;
- restore-verification result;
- baseline `PaymentHistory` count and amount total;
- responsible operator and deployment commit.

## Monitoring

After deployment, monitor payment API errors, duplicate-key conflicts, payment totals, and notification volume. Any unexpected increase is a stop-and-investigate signal.
