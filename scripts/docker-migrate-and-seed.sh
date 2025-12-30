#!/bin/bash

# Docker Compose Migration ve Seed Script
# Bu script migration ve seed işlemlerini doğru sırada çalıştırır

set -e  # Hata olursa dur

echo "🚀 Docker Compose Migration ve Seed İşlemi Başlatılıyor..."
echo ""

# Renkli output için
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Database bağlantısını kontrol et
echo -e "${YELLOW}1️⃣  Database bağlantısı kontrol ediliyor...${NC}"
if docker-compose exec backend npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database bağlantısı başarılı${NC}"
else
    echo -e "${RED}❌ Database bağlantısı başarısız. docker-compose up -d çalıştırın.${NC}"
    exit 1
fi
echo ""

# 2. Migration durumunu kontrol et
echo -e "${YELLOW}2️⃣  Migration durumu kontrol ediliyor...${NC}"
docker-compose exec backend npx prisma migrate status
echo ""

# 3. Migration'ları uygula
echo -e "${YELLOW}3️⃣  Migration'lar uygulanıyor...${NC}"
docker-compose exec backend npx prisma migrate deploy
echo -e "${GREEN}✅ Migration'lar uygulandı${NC}"
echo ""

# 4. Prisma Client'ı yeniden generate et
echo -e "${YELLOW}4️⃣  Prisma Client yeniden generate ediliyor...${NC}"
docker-compose exec backend npx prisma generate
echo -e "${GREEN}✅ Prisma Client güncellendi${NC}"
echo ""

# 5. Database schema'yı sync et (eksik kolonları ekle)
echo -e "${YELLOW}5️⃣  Database schema sync ediliyor...${NC}"
docker-compose exec backend npx prisma db push --accept-data-loss
echo -e "${GREEN}✅ Schema sync tamamlandı${NC}"
echo ""

# 6. Backend servisini restart et
echo -e "${YELLOW}6️⃣  Backend servisi yeniden başlatılıyor...${NC}"
docker-compose restart backend
echo -e "${GREEN}✅ Backend restart edildi${NC}"
echo ""

# 7. Servisin hazır olmasını bekle
echo -e "${YELLOW}7️⃣  Servis hazır olması bekleniyor...${NC}"
sleep 5
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servis hazır${NC}"
else
    echo -e "${RED}⚠️  Servis henüz hazır değil, biraz daha bekleyin...${NC}"
fi
echo ""

# 8. Seed işlemini çalıştır (opsiyonel)
if [ "$1" == "--with-seed" ]; then
    echo -e "${YELLOW}8️⃣  Seed işlemi başlatılıyor...${NC}"
    echo -e "${YELLOW}   Bu işlem birkaç dakika sürebilir...${NC}"
    npm run db:seed:all
    echo -e "${GREEN}✅ Seed işlemi tamamlandı${NC}"
else
    echo -e "${YELLOW}8️⃣  Seed işlemi atlandı (eklemek için --with-seed kullanın)${NC}"
fi
echo ""

echo -e "${GREEN}🎉 İşlem tamamlandı!${NC}"
echo ""
echo "📝 Özet:"
echo "   - Migration'lar: ✅ Uygulandı"
echo "   - Prisma Client: ✅ Güncellendi"
echo "   - Schema Sync: ✅ Tamamlandı"
echo "   - Backend: ✅ Yeniden başlatıldı"
if [ "$1" == "--with-seed" ]; then
    echo "   - Seed: ✅ Yüklendi"
else
    echo "   - Seed: ⏭️  Atlandı"
fi
echo ""
echo "🌐 API: http://localhost:3000"
echo "📚 Swagger: http://localhost:3000/api-docs"
echo ""

