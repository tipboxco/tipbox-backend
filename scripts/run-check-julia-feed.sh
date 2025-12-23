#!/bin/bash
# Julia feed kontrolü script'ini Docker container içinde çalıştır

# Docker compose komutunu belirle
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Docker Compose bulunamadı!"
    exit 1
fi

# Backend container'ında script'i çalıştır
echo "🔍 Julia feed kontrolü başlatılıyor..."
$DOCKER_COMPOSE exec backend npx ts-node scripts/check-and-fix-julia-feed.ts



