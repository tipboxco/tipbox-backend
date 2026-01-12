#!/bin/bash

# =====================================================
# REMOTE SUNUCUDA BAŞARISIZ MİGRATION TEMİZLEME
# =====================================================
# Bu script SSH ile remote sunucuya bağlanıp başarısız
# migration kayıtlarını temizler.
#
# Kullanım:
#   ./scripts/fix-failed-migration-remote.sh
#
# veya belirli bir migration için:
#   ./scripts/fix-failed-migration-remote.sh 20260109132600_add_notification_settings
# =====================================================

set -e

MIGRATION_NAME="${1:-}"
COMPOSE_FILE="${2:-docker-compose.test.yml}"

# Remote SSH bilgileri (GitHub Actions'dan)
SSH_HOST="${SSH_HOST:-hetzner-deploy}"

echo "=================================================="
echo "🔧 Remote Sunucuda Başarısız Migration Temizleme"
echo "=================================================="
echo "SSH Host: $SSH_HOST"
echo "Compose File: $COMPOSE_FILE"
if [ -n "$MIGRATION_NAME" ]; then
  echo "Migration: $MIGRATION_NAME"
else
  echo "Migration: TÜM BAŞARISIZ KAYITLAR"
fi
echo "=================================================="
echo ""

# Database credentials - compose file'a göre belirle
if [[ "$COMPOSE_FILE" == *"test"* ]]; then
  DB_USER="tipbox_user"
  DB_NAME="tipbox_test"
elif [[ "$COMPOSE_FILE" == *"prod"* ]]; then
  DB_USER="tipbox_user"
  DB_NAME="tipbox_prod"
else
  DB_USER="tipbox_user"
  DB_NAME="tipbox_dev"
fi

echo "📊 Database: $DB_NAME"
echo ""

# Remote sunucuda çalıştırılacak komutlar
if [ -n "$MIGRATION_NAME" ]; then
  # Belirli bir migration temizle
  REMOTE_COMMANDS="cd /opt/tipbox-backend

echo \"🔍 Migration durumu kontrol ediliyor...\"
docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER -d $DB_NAME << 'EOF'
SELECT 
  migration_name,
  started_at,
  finished_at,
  logs,
  CASE 
    WHEN finished_at IS NULL THEN '❌ Başarısız'
    WHEN rolled_back_at IS NOT NULL THEN '🔄 Geri alındı'
    ELSE '✅ Başarılı'
  END as durum
FROM _prisma_migrations 
WHERE migration_name = '$MIGRATION_NAME';
EOF

echo \"\"
echo \"🔧 Migration kaydı temizleniyor...\"
docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER -d $DB_NAME << 'EOF'
DELETE FROM _prisma_migrations 
WHERE migration_name = '$MIGRATION_NAME' 
  AND finished_at IS NULL;
  
SELECT 'Migration kaydı temizlendi: $MIGRATION_NAME' as sonuc;
EOF

echo \"\"
echo \"✅ İşlem tamamlandı!\"
"
  
else
  # Tüm başarısız migration'ları temizle
  REMOTE_COMMANDS="cd /opt/tipbox-backend

echo \"🔍 Başarısız migration'lar kontrol ediliyor...\"
docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER -d $DB_NAME -t << 'EOF'
SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL;
EOF

FAILED_MIGRATIONS=\$(docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c \"SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL;\" | grep -v \"^\$\" | xargs)

if [ -z \"\$FAILED_MIGRATIONS\" ]; then
  echo \"✅ Başarısız migration bulunamadı\"
  exit 0
fi

echo \"⚠️  Başarısız migration'lar bulundu:\"
echo \"\$FAILED_MIGRATIONS\"
echo \"\"

for MIGRATION in \$FAILED_MIGRATIONS; do
  echo \"🔧 Temizleniyor: \$MIGRATION\"
  
  docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER -d $DB_NAME << EOF2
SELECT 
  migration_name,
  started_at,
  logs
FROM _prisma_migrations 
WHERE migration_name = '\$MIGRATION';

DELETE FROM _prisma_migrations 
WHERE migration_name = '\$MIGRATION' 
  AND finished_at IS NULL;
  
SELECT 'Temizlendi: \$MIGRATION' as sonuc;
EOF2
  
  echo \"✅ \$MIGRATION temizlendi\"
  echo \"\"
done

echo \"✅ Tüm başarısız migration kayıtları temizlendi!\"
"
fi

# SSH ile remote sunucuda çalıştır
echo "🚀 Remote sunucuda işlem başlatılıyor..."
echo ""

ssh "$SSH_HOST" "$REMOTE_COMMANDS"

echo ""
echo "=================================================="
echo "✅ İşlem tamamlandı!"
echo "=================================================="
echo ""
echo "🔄 Şimdi migration'ı tekrar çalıştırabilirsiniz:"
echo "   ssh $SSH_HOST 'cd /opt/tipbox-backend && docker compose -f $COMPOSE_FILE run --rm backend npx prisma migrate deploy'"
echo ""

