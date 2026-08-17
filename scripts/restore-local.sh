#!/bin/bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/backup-folder"
  exit 1
fi

BACKUP_DIR="$1"
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

if [ ! -f "$BACKUP_DIR/database.dump" ]; then
  echo "Backup dump not found in $BACKUP_DIR"
  exit 1
fi

echo "Restoring PostgreSQL database $DB_NAME"
dropdb --if-exists -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$BACKUP_DIR/database.dump"

if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
  echo "Restoring uploaded files"
  mkdir -p "$(dirname "$UPLOAD_DIR")"
  rm -rf "$UPLOAD_DIR"
  tar -xzf "$BACKUP_DIR/uploads.tar.gz" -C "$(dirname "$UPLOAD_DIR")"
fi

echo "Restore complete from $BACKUP_DIR"
