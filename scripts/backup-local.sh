#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_ENV="$ROOT_DIR/server/.env"

if [ -f "$SERVER_ENV" ]; then
  set -a
  . "$SERVER_ENV"
  set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sclab}"
DB_USER="${DB_USER:-$USER}"
UPLOAD_DIR="${UPLOAD_DIR:-$ROOT_DIR/server/uploads}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
TARGET_DIR="$BACKUP_ROOT/$TIMESTAMP"

mkdir -p "$TARGET_DIR"

echo "Creating PostgreSQL dump in $TARGET_DIR"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -f "$TARGET_DIR/database.dump" "$DB_NAME"

if [ -d "$UPLOAD_DIR" ]; then
  echo "Archiving uploaded files"
  tar -czf "$TARGET_DIR/uploads.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
fi

cat > "$TARGET_DIR/manifest.txt" <<EOF
created_at=$TIMESTAMP
db_host=$DB_HOST
db_port=$DB_PORT
db_name=$DB_NAME
db_user=$DB_USER
upload_dir=$UPLOAD_DIR
EOF

echo "Backup complete: $TARGET_DIR"
