#!/usr/bin/env bash
set -e

echo "🛑 Stopping and removing all containers..."
cd "$PROJECT_DIR" || exit 1
docker compose -f "$COMPOSE_FILE" down || {
  echo "⚠️  Some containers were not running, continuing..."
}
echo "✅ Services stopped"
