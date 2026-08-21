# Bagihasil PostgreSQL backup operations

## Current baseline

- Existing encrypted backup and separated recovery key are stored outside the repository under the private backup directory.
- A fresh Production dump was restore-verified before the payment idempotency migration.
- No backup, environment file, recovery key, or proof image belongs in Git.

## Automated backup

Use:

```bash
scripts/backup-production-postgres.sh
```

The script reads `DIRECT_URL` only from the private mode-0600 Vercel environment file. It:

1. creates a custom-format PostgreSQL dump;
2. encrypts it with GPG AES-256 using the separately stored recovery key;
3. writes a SHA-256 checksum for the encrypted artifact;
4. verifies the checksum;
5. decrypts to a temporary file and runs `pg_restore --list`;
6. removes plaintext temporary files;
7. writes a minimal non-sensitive manifest;
8. applies retention.

A successful message is emitted only after every step succeeds.

## Scheduling

Install a daily cron only after reviewing the private backup path and offsite replication target:

```cron
17 2 * * * /home/ubuntu/bagihasil/scripts/backup-production-postgres.sh >> /home/ubuntu/.secure-backups/bagihasil/backup.log 2>&1
```

The log directory and file must remain mode 0700/0600 and outside Git. Cron output should be monitored; a failed backup must alert rather than silently pass.

## Restore drill

`pg_restore --list` proves the encrypted artifact is decryptable and structurally readable. A scheduled restore drill should additionally restore the newest artifact to an isolated disposable PostgreSQL database and compare:

- core table row counts;
- payment count and amount total;
- transaction buy/sell totals;
- profit-sharing totals;
- foreign-key/integrity checks.

Never restore over Production.

## Retention and offsite

The local script defaults to 14 days. Keep encrypted copies offsite with a separate recovery-key custody path. Do not sync the plaintext dump or recovery key together.

## Failure policy

- Missing or insecure environment/key files: fail closed.
- Non-PostgreSQL URL: fail closed.
- Failed dump, encryption, checksum, decrypt, or restore-list: non-zero exit.
- Never print connection strings, secrets, raw rows, or recovery keys.
- Investigate before deleting artifacts or changing retention.

## What remains

This script does not itself configure an offsite provider or alert destination. Those should be added only after selecting the storage/alerting target and verifying its credentials through the official provider mechanism.

## Test evidence

The script passed a real backup run against Production and produced an encrypted artifact with successful checksum/decrypt/`pg_restore --list` verification. The test artifact is kept outside the repository and should be retained or removed according to the private backup policy.

## Safety gate

Do not deploy future schema changes without a recent backup, checksum, restore verification, and a documented rollback path.

━━━ **Update 2026-08-21** ━━━

The automated script is intentionally not installed into cron by this change. Scheduling is a separate operational action and should be enabled only after an alert channel and offsite destination are selected.

━━━ **End** ━━━

Do not copy this document into an executable system without reviewing the placeholders and private paths.

