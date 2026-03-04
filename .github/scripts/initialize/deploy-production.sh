#!/usr/bin/env bash
set -e

echo "🚀 Starting PRODUCTION deployment..."

# Proje dizinine git
cd /opt/tipbox-backend

# Git pull
echo "📥 Pulling latest changes from main branch..."
git fetch origin
git checkout main
git pull origin main

# Environment dosyasının varlığını kontrol et
if [ ! -f backend/.env.production ]; then
  echo "❌ backend/.env.production file not found! Please create it first."
  exit 1
fi

# Database backup (production için zorunlu)
echo "💾 Creating database backup..."
BACKUP_DIR="/opt/tipbox-backend/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U tipbox_user tipbox_prod > "$BACKUP_FILE" || {
  echo "⚠️  Backup failed, but continuing..."
}

# Docker Compose ile build ve deploy (BuildKit + layer cache)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "🔨 Building Docker images (with cache)..."
docker compose -f docker-compose.prod.yml build backend admin-panel

echo "🚀 Starting containers..."
docker compose -f docker-compose.prod.yml up -d

# Migration'ları çalıştır
echo "📊 Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy || {
  echo "❌ Migration failed! Consider rolling back."
  exit 1
}

# Health check
echo "🏥 Checking backend health..."
sleep 15
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T backend node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" 2>/dev/null; then
    echo "✅ Backend is healthy!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Health check failed after 30 attempts"
    docker compose -f docker-compose.prod.yml logs backend
    echo "⚠️  Consider rolling back to previous version!"
    exit 1
  fi
  echo "⏳ Waiting for backend to be ready... ($i/30)"
  sleep 2
done

# Eski image'ları temizle (production'da daha dikkatli)
echo "🧹 Cleaning up old Docker images (keeping last 24h)..."
docker image prune -f --filter "until=24h"

echo "✅ Production deployment completed successfully!"
echo "📝 Backup location: $BACKUP_FILE"

# Container durumunu göster
echo "📊 Container status:"
docker compose -f docker-compose.prod.yml ps
