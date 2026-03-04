#!/usr/bin/env bash
set -e

echo "🧹 Cleaning up old Docker resources..."
cd "$PROJECT_DIR" || exit 1
# Dangling image'ları sil
docker image prune -f
# Build cache'i temizle (en çok yer kaplayan)
docker builder prune -f --keep-storage=2gb 2>/dev/null || docker builder prune -f
# Kullanılmayan container'ları sil
docker container prune -f
echo "💾 Disk usage after cleanup:"
df -h / | tail -1
echo "🐳 Docker disk usage:"
docker system df
echo "📊 Container status:"
docker compose -f "$COMPOSE_FILE" ps
echo "✅ Test environment deployment completed successfully!"
