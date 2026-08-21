-- Reference SQL only. Do not execute this file directly in Production.
-- Production execution must use scripts/migrate-payment-idempotency-postgres.sh,
-- which validates the database name and host, backup approval, timeouts,
-- partial schema, duplicates, and final schema/index postconditions.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "PaymentHistory"
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
    ADD COLUMN IF NOT EXISTS "idempotencyFingerprint" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentHistory_idempotencyKey_key"
    ON "PaymentHistory" ("idempotencyKey");

COMMIT;
