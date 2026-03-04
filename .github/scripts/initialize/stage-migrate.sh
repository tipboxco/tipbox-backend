#!/usr/bin/env bash
set -e

echo "📊 Running database migrations..."
cd "$PROJECT_DIR" || exit 1

# Prisma generate + migrate tek container'da (2 container start yerine 1, 1 entrypoint döngüsü)
echo "🔧 Generating Prisma Client and deploying migrations..."
MIGRATE_OUTPUT=$(docker compose -f "$COMPOSE_FILE" run --rm backend \
  sh -c "npx prisma generate && npx prisma migrate deploy" 2>&1) || {
  echo "$MIGRATE_OUTPUT"
  # P3005: DB dolu ama migration history yok → baseline uygula
  if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
    echo "⚠️  Database not empty without migration history. Applying baseline..."
    MIGRATION_NAME=$(docker compose -f "$COMPOSE_FILE" run --rm backend \
      sh -c "ls prisma/migrations | grep -v migration_lock | head -1" 2>/dev/null | tr -d '\r' | xargs)
    if [ -n "$MIGRATION_NAME" ]; then
      docker compose -f "$COMPOSE_FILE" run --rm backend \
        npx prisma migrate resolve --applied "$MIGRATION_NAME" || {
          echo "❌ Baseline failed!"
          exit 1
        }
      echo "✅ Baseline applied: $MIGRATION_NAME"
      # Baseline sonrası tekrar deploy
      docker compose -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy || {
        echo "❌ Migration failed after baseline!"
        exit 1
      }
    else
      echo "❌ No migration found to baseline"
      exit 1
    fi
  else
    echo "$MIGRATE_OUTPUT"
    echo "❌ Migration failed! Check the logs above."
    exit 1
  fi
}
echo "$MIGRATE_OUTPUT"

echo "✅ Migrations completed"
