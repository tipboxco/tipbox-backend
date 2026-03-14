#!/usr/bin/env bash
set -e

echo "🔨 Building Docker images..."
cd "$PROJECT_DIR" || exit 1

# Disk %75'in üzerindeyse build öncesi temizlik yap
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
echo "💾 Current disk usage: ${DISK_USAGE}%"
if [ "$DISK_USAGE" -gt 75 ]; then
  echo "⚠️  Disk usage above 75%, cleaning up before build..."
  docker builder prune -af
  docker image prune -af
  echo "💾 Disk usage after cleanup: $(df / | tail -1 | awk '{print $5}')"
fi

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Trim whitespace from CHANGED_SERVICES
SERVICES=$(echo "$CHANGED_SERVICES" | xargs)
if [ "$FORCE_REBUILD" = "true" ]; then
  echo "🔄 Force rebuild requested - building without cache"
  docker compose -f "$COMPOSE_FILE" build --no-cache $SERVICES
elif [ -z "$SERVICES" ]; then
  echo "⚡ Building all services with cache (BuildKit)..."
  docker compose -f "$COMPOSE_FILE" build
else
  echo "⚡ Building only changed services with cache (BuildKit): $SERVICES"
  docker compose -f "$COMPOSE_FILE" build $SERVICES
fi
echo "✅ Images built successfully"
