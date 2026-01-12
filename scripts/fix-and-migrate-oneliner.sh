#!/bin/bash

# =====================================================
# SUNUCUDA DİREK ÇALIŞTIR - TEK KOMUT ÇÖZÜM
# =====================================================
# Bu komutları sunucuda direk kopyala-yapıştır
# =====================================================

# Proje dizinine git ve başarısız migration'ı temizle
cd /opt/tipbox-backend && \
docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test << 'EOF'
-- Başarısız migration'ları göster
SELECT 
  migration_name,
  started_at,
  CASE 
    WHEN finished_at IS NULL THEN '❌ Başarısız'
    ELSE '✅ Başarılı'
  END as durum
FROM _prisma_migrations 
WHERE finished_at IS NULL;

-- Başarısız kayıtları temizle
DELETE FROM _prisma_migrations 
WHERE finished_at IS NULL;

-- Sonuç
SELECT 'Tüm başarısız migration kayıtları temizlendi!' as sonuc;
EOF
echo "" && \
echo "✅ Migration kayıtları temizlendi!" && \
echo "🔄 Şimdi migration tekrar çalıştırılıyor..." && \
echo "" && \
docker compose -f docker-compose.test.yml run --rm backend npx prisma generate && \
docker compose -f docker-compose.test.yml run --rm backend npx prisma migrate deploy && \
echo "" && \
echo "🎉 İşlem tamamlandı! Migration başarılı." && \
docker compose -f docker-compose.test.yml exec backend npx prisma migrate status

