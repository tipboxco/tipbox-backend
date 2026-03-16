#!/usr/bin/env bash
set -e

cd "$PROJECT_DIR" || exit 1

SERVICES=$(echo "$CHANGED_SERVICES" | xargs)

if [ "$INFRA_CHANGED" = "true" ] || [ -z "$SERVICES" ]; then
  # ── Infra değişti veya tüm servisler → full stop ──
  echo "🛑 Stopping all containers (infrastructure change)..."
  docker compose -f "$COMPOSE_FILE" down || {
    echo "⚠️  Some containers were not running, continuing..."
  }
  echo "✅ All services stopped"
else
  # ── Sadece belirli servisler değişti → selective stop ──
  echo "🛑 Stopping only changed services: $SERVICES"
  echo "   (postgres, redis, minio and other services stay running)"
  docker compose -f "$COMPOSE_FILE" stop $SERVICES || true
  docker compose -f "$COMPOSE_FILE" rm -f $SERVICES || true
  echo "✅ Changed services stopped"
  echo ""
  echo "📊 Running containers:"
  docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || \
    docker compose -f "$COMPOSE_FILE" ps
fi
