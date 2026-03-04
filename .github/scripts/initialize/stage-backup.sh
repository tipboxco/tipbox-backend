#!/usr/bin/env bash
set -e

echo "💾 Creating database backup..."
cd "$PROJECT_DIR" || exit 1
BACKUP_DIR="${PROJECT_DIR}/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).sql"
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null || {
  echo "⚠️  Backup failed or database not accessible, continuing..."
}
echo "✅ Backup completed (if accessible)"
