#!/bin/bash

# Test veritabanındaki başarısız migration'ı düzelt
echo "🔧 Başarısız migration düzeltiliyor..."

# Migration'ı rolled back olarak işaretle
docker-compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test -c "
UPDATE _prisma_migrations 
SET finished_at = NOW(), 
    rolled_back_at = NOW() 
WHERE migration_name = '20260109132600_add_notification_settings' 
AND finished_at IS NULL;
"

echo "✅ Migration rolled back olarak işaretlendi"
echo ""
echo "📊 Migration durumu:"

# Migration durumunu göster
docker-compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test -c "
SELECT migration_name, finished_at, rolled_back_at 
FROM _prisma_migrations 
WHERE migration_name = '20260109132600_add_notification_settings';
"

echo ""
echo "🔄 Şimdi tekrar migration deploy edilebilir:"
echo "docker-compose -f docker-compose.test.yml exec backend npx prisma migrate deploy"

