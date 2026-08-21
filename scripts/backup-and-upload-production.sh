#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BAGIHASIL_BACKUP_DIR:-$HOME/.secure-backups/bagihasil/automated}"
export BAGIHASIL_BACKUP_DIR="$BACKUP_DIR"

backup_json="$("$ROOT/scripts/backup-production-postgres.sh" 2> >(sed 's/^/[backup] /' >&2))"
upload_json="$(python3 "$ROOT/scripts/upload-backup-to-google-drive.py")"

python3 - "$backup_json" "$upload_json" <<'PY'
import json, sys
backup = json.loads(sys.argv[1])
upload = json.loads(sys.argv[2])
print(json.dumps({
    "status": "ok",
    "backup": backup.get("backup"),
    "database": backup.get("database"),
    "encrypted": backup.get("encrypted"),
    "restore_list_verified": backup.get("restore_list_verified"),
    "drive_folder": upload.get("folder"),
    "uploaded_files": len(upload.get("files", [])),
}, separators=(",", ":")))
PY
