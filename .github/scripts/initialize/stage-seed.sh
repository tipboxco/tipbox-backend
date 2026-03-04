#!/usr/bin/env bash
set -e

echo "🌱 Checking if database needs seeding..."
cd "$PROJECT_DIR" || exit 1

# Check if users table has data (smart seed check)
HAS_DATA=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE email LIKE '%@tipbox.%' LIMIT 1;" 2>/dev/null | xargs || echo "0")

if [ "$HAS_DATA" = "0" ] || [ -z "$HAS_DATA" ]; then
  echo "🌱 Running database seeds..."

  # Not: migrate aşamasında prisma generate çalıştırıldı, named volume persist ediyor → regenerate gereksiz
  # Seed'i çalıştır
  docker compose -f "$COMPOSE_FILE" run --rm backend npx ts-node scripts/clear-and-seed.ts --all || {
    echo "⚠️  Full seed failed, trying minimal seed..."
    docker compose -f "$COMPOSE_FILE" run --rm backend npx ts-node scripts/clear-and-seed.ts || {
      echo "⚠️  Seed failed, continuing without seed data..."
    }
  }
  echo "✅ Seeds completed"
else
  echo "⏭️  Database already has seed data, skipping..."
  echo "✅ Seed check completed"
fi
