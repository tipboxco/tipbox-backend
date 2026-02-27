#!/bin/bash

# Tipbox Backend Development Reset Script
# Bu script projeyi tamamen sıfırlar ve yeniden başlatır

set -e  # Hata durumunda durdur

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Mesaj fonksiyonları
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Docker compose komutunu belirle
get_docker_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    elif docker compose version &> /dev/null; then
        echo "docker compose"
    else
        error "Docker Compose bulunamadı! Lütfen Docker Compose'u yükleyin."
        exit 1
    fi
}

DOCKER_COMPOSE_CMD=$(get_docker_compose_cmd)

info "🚀 Tipbox Backend Development Reset başlatılıyor..."
echo ""

# 1. Docker container'ları durdur ve sil
info "1️⃣  Docker container'ları durduruluyor ve siliniyor..."
$DOCKER_COMPOSE_CMD down -v 2>/dev/null || true
success "Docker container'ları durduruldu ve silindi"
echo ""

# 2. Cache ve build dosyalarını temizle
info "2️⃣  Cache ve build dosyaları temizleniyor..."

# dist klasörünü temizle
if [ -d "dist" ]; then
    rm -rf dist
    success "dist/ klasörü temizlendi"
fi

# logs klasörünü temizle
if [ -d "logs" ]; then
    rm -rf logs/*
    success "logs/ klasörü temizlendi"
fi

# node_modules/.cache temizle
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    success "node_modules/.cache temizlendi"
fi

# .next cache (eğer varsa)
if [ -d ".next" ]; then
    rm -rf .next
    success ".next/ klasörü temizlendi"
fi

# Prisma generated client temizle
if [ -d "node_modules/.prisma" ]; then
    rm -rf node_modules/.prisma
    success "Prisma generated client temizlendi"
fi

success "Cache ve build dosyaları temizlendi"
echo ""

# 3. Prisma generate
info "3️⃣  Prisma client generate ediliyor..."
npx prisma generate
success "Prisma client generate edildi"
echo ""

# 4. Docker container'ları yeniden başlat
info "4️⃣  Docker container'ları yeniden başlatılıyor..."
$DOCKER_COMPOSE_CMD up -d
success "Docker container'ları başlatıldı"
echo ""

# 5. PostgreSQL'in hazır olmasını bekle
info "5️⃣  PostgreSQL'in hazır olması bekleniyor..."
MAX_WAIT=60
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker exec tipbox_postgres pg_isready -U postgres &> /dev/null; then
        success "PostgreSQL hazır"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $((WAIT_COUNT % 5)) -eq 0 ]; then
        info "PostgreSQL bekleniyor... ($WAIT_COUNT/$MAX_WAIT saniye)"
    fi
    sleep 1
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    error "PostgreSQL hazır olmadı! Lütfen manuel olarak kontrol edin."
    exit 1
fi
echo ""

# 6. Database migration'ları uygula
info "6️⃣  Database migration'ları uygulanıyor..."
set +e  # Migration hatalarını yakalamak için geçici olarak kapat
MIGRATION_RESULT=$(npx prisma migrate reset --force --skip-seed 2>&1)
MIGRATION_EXIT_CODE=$?
set -e  # Tekrar aktif et

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    success "Database migration'ları uygulandı"
else
    warning "Migration reset başarısız oldu, alternatif yöntem deneniyor..."
    echo ""
    info "Database'i manuel olarak drop edip schema'yı push ediliyor..."
    
    # Aktif bağlantıları kapat ve database'i drop et
    set +e
    docker exec tipbox_postgres psql -U postgres -c "
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'tipbox_dev' AND pid <> pg_backend_pid();
    " 2>/dev/null || true
    
    docker exec tipbox_postgres psql -U postgres -c "DROP DATABASE IF EXISTS tipbox_dev;" 2>/dev/null || true
    docker exec tipbox_postgres psql -U postgres -c "CREATE DATABASE tipbox_dev;" 2>/dev/null || true
    set -e
    
    # Kısa bir bekleme
    sleep 2
    
    # Schema'yı push et (migration dosyalarını kullanmadan)
    set +e
    info "Prisma schema push ediliyor..."
    PUSH_RESULT=$(npx prisma db push --accept-data-loss 2>&1)
    PUSH_EXIT_CODE=$?
    set -e
    
    if [ $PUSH_EXIT_CODE -eq 0 ]; then
        success "Database schema başarıyla uygulandı (db push)"
        # Prisma client'ı tekrar generate et
        info "Prisma client generate ediliyor..."
        npx prisma generate
        success "Prisma client generate edildi"
    else
        error "Schema push da başarısız oldu!"
        echo ""
        echo "Hata detayları:"
        echo "$PUSH_RESULT" | tail -30
        echo ""
        error "Lütfen migration dosyalarını kontrol edin."
        error "Sorunlu migration: 20251101114522_tipbox_migration1"
        error "Bu migration marketplace_banners tablosunu ALTER etmeye çalışıyor ama tablo henüz oluşturulmamış."
        exit 1
    fi
fi
echo ""

# 7. Seed data import
info "7️⃣  Seed data import ediliyor..."
pnpm run db:seed:all || pnpm run db:seed
success "Seed data import edildi"
echo ""

# 8. Redis cache temizle (eğer Redis hazırsa)
info "8️⃣  Redis cache temizleniyor..."
if docker exec tipbox_redis redis-cli ping &> /dev/null; then
    docker exec tipbox_redis redis-cli FLUSHALL &> /dev/null || true
    success "Redis cache temizlendi"
else
    warning "Redis henüz hazır değil, cache temizlenemedi"
fi
echo ""

# 9. Backend'in hazır olmasını bekle
info "9️⃣  Backend'in hazır olması bekleniyor..."
MAX_WAIT=120
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3000 &> /dev/null; then
        success "Backend hazır!"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
        info "Backend bekleniyor... ($WAIT_COUNT/$MAX_WAIT saniye)"
    fi
    sleep 1
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    warning "Backend henüz hazır olmadı. Logları kontrol edin: pnpm run docker:logs"
else
    success "Backend başarıyla başlatıldı!"
fi
echo ""

# Özet
echo "═══════════════════════════════════════════════════════════════════════════════"
success "🎉 Reset işlemi tamamlandı!"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
info "📋 Özet:"
echo "   • Docker container'ları sıfırlandı"
echo "   • Cache ve build dosyaları temizlendi"
echo "   • Prisma client generate edildi"
echo "   • Database migration'ları uygulandı"
echo "   • Seed data import edildi"
echo "   • Redis cache temizlendi"
echo ""
info "🔗 Servisler:"
echo "   • Backend: http://localhost:3000"
echo "   • Prisma Studio: http://localhost:5555"
echo "   • PgAdmin: http://localhost:5050"
echo "   • MinIO Console: http://localhost:9001"
echo ""
info "📝 Yararlı komutlar:"
echo "   • Logları görmek: pnpm run docker:logs"
echo "   • Container durumunu görmek: $DOCKER_COMPOSE_CMD ps"
echo "   • Prisma Studio: pnpm run db:studio"
echo ""
