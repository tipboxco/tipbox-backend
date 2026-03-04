#!/usr/bin/env bash
set -e

echo "🚀 Starting all services..."
cd "$PROJECT_DIR" || exit 1
docker compose -f "$COMPOSE_FILE" up -d
echo "✅ All services started"
