#!/bin/bash

# Hetzner Test Server Deployment Script
# Bu script sunucuda manuel olarak çalıştırılabilir veya GitHub Actions tarafından kullanılabilir

set -e

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Konfigürasyon
PROJECT_DIR="/opt/tipbox-backend"
COMPOSE_FILE="docker-compose.prod.yml"
BRANCH="${1:-test}"

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Proje dizinine git
cd "$PROJECT_DIR" || {
  echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
  exit 1
}

# Git pull
echo -e "${YELLOW}📥 Pulling latest changes from branch: $BRANCH${NC}"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Environment dosyasının varlığını kontrol et
if [ ! -f backend/.env ]; then
  echo -e "${RED}❌ backend/.env file not found! Please create it first.${NC}"
  exit 1
fi

# Docker Compose ile build
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker compose -f "$COMPOSE_FILE" build --no-cache backend

# Container'ları başlat
echo -e "${YELLOW}🚀 Starting containers...${NC}"
docker compose -f "$COMPOSE_FILE" up -d

# Migration'ları çalıştır
echo -e "${YELLOW}📊 Running database migrations...${NC}"
docker compose -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy || {
  echo -e "${YELLOW}⚠️  Migration failed or no new migrations${NC}"
}

# Health check
echo -e "${YELLOW}🏥 Checking backend health...${NC}"
sleep 10

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker compose -f "$COMPOSE_FILE" exec -T backend node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" 2>/dev/null; then
    echo -e "${GREEN}✅ Backend is healthy!${NC}"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Health check failed after $MAX_RETRIES attempts${NC}"
    echo -e "${YELLOW}📋 Backend logs:${NC}"
    docker compose -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
  fi
  
  echo -e "${YELLOW}⏳ Waiting for backend to be ready... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
  sleep 2
done

# Eski image'ları temizle
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f

# Container durumunu göster
echo -e "${GREEN}📊 Container status:${NC}"
docker compose -f "$COMPOSE_FILE" ps

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"

