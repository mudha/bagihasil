#!/usr/bin/env bash
set -euo pipefail
umask 077

ENV_FILE="${BAGIHASIL_PRODUCTION_ENV:-$HOME/.secure-backups/bagihasil/.env.production}"
KEY_FILE="${BAGIHASIL_BACKUP_KEY_FILE:-$HOME/.secure-backups/bagihasil/backup-recovery-key.txt}"
BACKUP_DIR="${BAGIHASIL_BACKUP_DIR:-$HOME/.secure-backups/bagihasil/automated}"
RETENTION_DAYS="${BAGIHASIL_BACKUP_RETENTION_DAYS:-14}"

[[ -f "$ENV_FILE" && "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || {
  echo "Refusing insecure or missing Production env file" >&2
  exit 1
}
[[ -f "$KEY_FILE" && "$(stat -c '%a' "$KEY_FILE")" == "600" ]] || {
  echo "Refusing insecure or missing backup key file" >&2
  exit 1
}
command -v pg_dump >/dev/null || { echo "pg_dump is required" >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "pg_restore is required" >&2; exit 1; }
command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
command -v gpg >/dev/null || { echo "gpg is required" >&2; exit 1; }

DIRECT_URL="$(python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import sys
for line in Path(sys.argv[1]).read_text().splitlines():
    if line.startswith('DIRECT_URL='):
        value = line.split('=', 1)[1].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if not value.startswith('postgres'):
            raise SystemExit('DIRECT_URL is not PostgreSQL')
        print(value)
        break
else:
    raise SystemExit('DIRECT_URL not found')
PY
)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PREFIX="$BACKUP_DIR/bagihasil-production-$STAMP"
PLAINTEXT="${PREFIX}.dump"
ENCRYPTED="${PREFIX}.dump.gpg"
CHECKSUM="${ENCRYPTED}.sha256"
MANIFEST="${ENCRYPTED}.manifest"
RESTORE_CHECK="${ENCRYPTED}.restore-list"

cleanup() {
  rm -f "$PLAINTEXT" "${PREFIX}.restore-check.dump"
  unset DIRECT_URL
}
trap cleanup EXIT

pg_dump --format=custom --no-owner --no-acl --dbname "$DIRECT_URL" --file "$PLAINTEXT"
test -s "$PLAINTEXT"

gpg --batch --yes --pinentry-mode loopback --passphrase-file "$KEY_FILE" \
  --symmetric --cipher-algo AES256 --output "$ENCRYPTED" "$PLAINTEXT"
chmod 600 "$ENCRYPTED"
test -s "$ENCRYPTED"
sha256sum "$ENCRYPTED" > "$CHECKSUM"
chmod 600 "$CHECKSUM"
sha256sum --check "$CHECKSUM" >/dev/null

# Prove the encrypted artifact can be decrypted and inspected by pg_restore.
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$KEY_FILE" \
  --decrypt "$ENCRYPTED" > "${PREFIX}.restore-check.dump"
pg_restore --list "${PREFIX}.restore-check.dump" > "$RESTORE_CHECK"
test -s "$RESTORE_CHECK"
chmod 600 "$RESTORE_CHECK"

DATABASE_ID="$(psql "$DIRECT_URL" -Atqc 'select current_database()')"
SERVER_VERSION="$(psql "$DIRECT_URL" -Atqc "select current_setting('server_version')")"
cat > "$MANIFEST" <<EOF
created_at_utc=$STAMP
database=$DATABASE_ID
server_version=$SERVER_VERSION
encrypted_artifact=$(basename "$ENCRYPTED")
sha256_file=$(basename "$CHECKSUM")
restore_list=$(basename "$RESTORE_CHECK")
EOF
chmod 600 "$MANIFEST"

rm -f "$PLAINTEXT" "${PREFIX}.restore-check.dump"

find "$BACKUP_DIR" -type f -name 'bagihasil-production-*.dump.gpg' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f \( -name 'bagihasil-production-*.dump.gpg.sha256' -o -name 'bagihasil-production-*.dump.gpg.manifest' -o -name 'bagihasil-production-*.dump.gpg.restore-list' \) -mtime "+$RETENTION_DAYS" -delete

printf '{"backup":"%s","database":"%s","encrypted":true,"restore_list_verified":true}\n' \
  "$(basename "$ENCRYPTED")" "$DATABASE_ID"
