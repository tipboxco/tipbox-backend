#!/usr/bin/env bash
set -e

echo "🧹 Cleaning up old Docker resources..."
cd "$PROJECT_DIR" || exit 1
# Dangling image'ları sil
docker image prune -f
# Build cache'i temizle (en çok yer kaplayan)
docker builder prune -f --keep-storage=5gb 2>/dev/null || docker builder prune -f --keep-storage=3gb 2>/dev/null || true
# NOT: docker container prune çalıştırılmıyor.
# Stopped container'ları silmek restart:always politikasını bozar —
# silinen container reboot sonrası Docker tarafından yeniden başlatılamaz.
echo "💾 Disk usage after cleanup:"
df -h / | tail -1
echo "🐳 Docker disk usage:"
docker system df
echo "📊 Container status:"
docker compose -f "$COMPOSE_FILE" ps
echo "✅ Test environment deployment completed successfully!"
