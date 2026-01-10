#!/bin/bash

# Başarısız migration'ı düzelt
# Kullanım: ./scripts/fix-failed-migration.sh [migration_name] [database_name] [compose_file]
# Örnek: ./scripts/fix-failed-migration.sh 20260109132600_add_notification_settings tipbox_test docker-compose.test.yml

MIGRATION_NAME="${1:-20260109132600_add_notification_settings}"
DB_NAME="${2:-tipbox_test}"
COMPOSE_FILE="${3:-docker-compose.yml}"

# Docker Compose komutunu belirle (v1 veya v2)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose -f $COMPOSE_FILE"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose -f $COMPOSE_FILE"
else
    echo "❌ docker-compose veya docker compose bulunamadı!"
    exit 1
fi

echo "🔧 Başarısız migration düzeltiliyor..."
echo "Migration: $MIGRATION_NAME"
echo "Database: $DB_NAME"
echo "Compose File: $COMPOSE_FILE"
echo "Docker Compose: $DOCKER_COMPOSE"
echo ""

# Migration'ı rolled back olarak işaretle ve sil
$DOCKER_COMPOSE exec -T postgres psql -U tipbox_user -d "$DB_NAME" << EOF
-- Başarısız migration'ı kontrol et
SELECT 
    migration_name, 
    started_at,
    finished_at, 
    rolled_back_at,
    CASE 
        WHEN finished_at IS NULL THEN '❌ Başarısız (tamamlanmadı)'
        WHEN rolled_back_at IS NOT NULL THEN '🔄 Geri alındı'
        ELSE '✅ Başarılı'
    END as durum
FROM _prisma_migrations 
WHERE migration_name = '$MIGRATION_NAME';

-- Başarısız migration kaydını sil (bu sayede tekrar çalışabilir)
DELETE FROM _prisma_migrations 
WHERE migration_name = '$MIGRATION_NAME' 
  AND finished_at IS NULL;

-- Sonuç
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Migration kaydı silindi, tekrar çalıştırılabilir'
        ELSE '⚠️  Migration hala mevcut'
    END as sonuc
FROM _prisma_migrations 
WHERE migration_name = '$MIGRATION_NAME';
EOF

echo ""
echo "✅ İşlem tamamlandı"
echo ""
echo "🔄 Şimdi tekrar migration deploy edilebilir:"
echo "$DOCKER_COMPOSE exec backend npx prisma migrate deploy"

