#!/usr/bin/env bash
set -euo pipefail

: "${DIRECT_URL:=${DATABASE_URL:-}}"
: "${EXPECTED_DATABASE_NAME:?EXPECTED_DATABASE_NAME is required}"
: "${EXPECTED_DATABASE_HOST:?EXPECTED_DATABASE_HOST is required}"

if [[ -z "${DIRECT_URL}" || "${DIRECT_URL}" != postgres* ]]; then
  echo "Refusing missing or non-PostgreSQL URL" >&2
  exit 1
fi

URL_HOST="$(python3 -c 'import sys; from urllib.parse import urlparse, parse_qs; u=urlparse(sys.argv[1]); print(u.hostname or parse_qs(u.query).get("host", [""])[0])' "${DIRECT_URL}")"
[[ "${URL_HOST}" == "${EXPECTED_DATABASE_HOST}" ]] || {
  echo "Refusing unexpected database host" >&2
  exit 1
}

DB_NAME="$(psql "${DIRECT_URL}" -Atqc 'select current_database()')"
[[ "${DB_NAME}" == "${EXPECTED_DATABASE_NAME}" ]] || {
  echo "Refusing unexpected database: ${DB_NAME}" >&2
  exit 1
}

if [[ "${DB_NAME}" != "bagihasil_e2e" && "${ALLOW_PRODUCTION_MIGRATION:-}" != "YES_I_HAVE_VERIFIED_BACKUP" ]]; then
  echo "Refusing non-E2E database without explicit migration approval" >&2
  exit 1
fi
if [[ "${DB_NAME}" != "bagihasil_e2e" && "${BACKUP_VERIFIED:-}" != "YES" ]]; then
  echo "Refusing non-E2E database without BACKUP_VERIFIED=YES" >&2
  exit 1
fi

psql "${DIRECT_URL}" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  column_count integer;
BEGIN
  SELECT count(*) INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'PaymentHistory'
    AND column_name IN ('idempotencyKey', 'idempotencyFingerprint');

  IF column_count = 1 THEN
    RAISE EXCEPTION 'Partial idempotency schema detected; reconcile manually';
  END IF;
END $$;

ALTER TABLE "PaymentHistory"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyFingerprint" TEXT;

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT "idempotencyKey"
    FROM "PaymentHistory"
    WHERE "idempotencyKey" IS NOT NULL
    GROUP BY "idempotencyKey"
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate non-NULL idempotency keys exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentHistory_idempotencyKey_key"
  ON "PaymentHistory" ("idempotencyKey");

DO $$
DECLARE
  valid_columns integer;
  valid_index integer;
BEGIN
  SELECT count(*) INTO valid_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'PaymentHistory'
    AND column_name IN ('idempotencyKey', 'idempotencyFingerprint')
    AND data_type = 'text'
    AND is_nullable = 'YES';

  SELECT count(*) INTO valid_index
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'PaymentHistory'
    AND indexname = 'PaymentHistory_idempotencyKey_key'
    AND indexdef = 'CREATE UNIQUE INDEX "PaymentHistory_idempotencyKey_key" ON public."PaymentHistory" USING btree ("idempotencyKey")';

  IF valid_columns <> 2 THEN
    RAISE EXCEPTION 'Idempotency column postcondition failed';
  END IF;
  IF valid_index <> 1 THEN
    RAISE EXCEPTION 'Idempotency unique-index postcondition failed';
  END IF;
END $$;

COMMIT;
SQL

printf '{"status":"applied_or_already_applied","database":"%s","host_verified":true}\n' "${DB_NAME}"
