#!/usr/bin/env bash
set -e

echo "🚀 Starting infrastructure services..."
cd "$PROJECT_DIR" || exit 1
docker compose -f "$COMPOSE_FILE" up -d postgres redis minio
echo "✅ Infrastructure services started"
