#!/usr/bin/env bash
set -e

echo "🌱 Checking if database needs seeding..."
cd "$PROJECT_DIR" || exit 1

# Check if users table has data (smart seed check)
HAS_DATA=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE email LIKE '%@tipbox.%' LIMIT 1;" 2>/dev/null | xargs || echo "0")

if [ "$HAS_DATA" = "0" ] || [ -z "$HAS_DATA" ]; then
  echo "🌱 Running database seeds..."

  # docker compose exec: çalışan backend container içinde çalışır (entrypoint yok, yeni container yok)
  # node_modules, prisma client, env vars zaten mevcut
  docker compose -f "$COMPOSE_FILE" exec -T -e NODE_OPTIONS="--max-old-space-size=512" backend npx ts-node --transpile-only scripts/clear-and-seed.ts --all || {
    echo "⚠️  Full seed failed, trying minimal seed..."
    docker compose -f "$COMPOSE_FILE" exec -T -e NODE_OPTIONS="--max-old-space-size=512" backend npx ts-node --transpile-only scripts/clear-and-seed.ts || {
      echo "⚠️  Seed failed, continuing without seed data..."
    }
  }
  echo "✅ Seeds completed"
else
  echo "⏭️  Database already has seed data, skipping..."
  echo "✅ Seed check completed"
fi
