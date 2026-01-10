# =====================================================
# TEST SUNUCUSUNDA BAŞARISIZ MİGRATION DÜZELTME KILAVUZU
# =====================================================

## 🚨 ACIL ÇÖZÜM - Şu An Test Sunucusunda Çalıştır

### 1. SSH ile Test Sunucusuna Bağlan
```bash
ssh hetzner-deploy
```

### 2. Proje Dizinine Git
```bash
cd /opt/tipbox-backend
```

### 3. Başarısız Migration'ı Kontrol Et
```bash
docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test << 'EOF'
SELECT 
  migration_name,
  started_at,
  finished_at,
  logs,
  CASE 
    WHEN finished_at IS NULL THEN '❌ Başarısız'
    ELSE '✅ Başarılı'
  END as durum
FROM _prisma_migrations 
WHERE finished_at IS NULL;
EOF
```

### 4. Başarısız Migration Kaydını Temizle
```bash
docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test << 'EOF'
-- Başarısız migration kaydını sil
DELETE FROM _prisma_migrations 
WHERE migration_name = '20260109132600_add_notification_settings' 
  AND finished_at IS NULL;

-- Kontrol et
SELECT 'Migration kaydı temizlendi!' as sonuc;
EOF
```

### 5. Migration'ı Tekrar Çalıştır
```bash
docker compose -f docker-compose.test.yml run --rm backend npx prisma generate
docker compose -f docker-compose.test.yml run --rm backend npx prisma migrate deploy
```

### 6. Sonucu Kontrol Et
```bash
docker compose -f docker-compose.test.yml exec backend npx prisma migrate status
```

---

## 📋 YEREL BİLGİSAYARINDAN ÇALIŞTIR (SSH ile)

### Yöntem 1: NPM Script Kullan (Önerilen)
```bash
npm run db:fix-failed-migration-remote
```

veya belirli bir migration için:
```bash
npm run db:fix-failed-migration-remote 20260109132600_add_notification_settings
```

### Yöntem 2: Script'i Doğrudan Çalıştır
```bash
./scripts/fix-failed-migration-remote.sh
```

veya belirli bir migration için:
```bash
./scripts/fix-failed-migration-remote.sh 20260109132600_add_notification_settings
```

### Yöntem 3: Tek Komut SSH (En Hızlı)
```bash
ssh hetzner-deploy "cd /opt/tipbox-backend && docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test -c \"DELETE FROM _prisma_migrations WHERE migration_name = '20260109132600_add_notification_settings' AND finished_at IS NULL;\" && docker compose -f docker-compose.test.yml run --rm backend npx prisma migrate deploy"
```

---

## 🔧 GitHub Actions - Artık Otomatik

Düzelttiğim `.github/actions/run-migrations/action.yml` dosyası artık:

1. ✅ Her deploy'dan ÖNCE başarısız migration kayıtlarını otomatik temizliyor
2. ✅ Database'e doğrudan erişerek kontrol ediyor (backend servisi gerekmez)
3. ✅ Test, Dev ve Prod ortamlarını otomatik algılıyor
4. ✅ Prisma Client'ı migration'dan önce generate ediyor

### Nasıl Çalışır?
```yaml
1. Check for failed migrations (YENİ - Otomatik temizleme)
   - Database'den doğrudan başarısız kayıtları bulur
   - Her birini detaylı loglar
   - Temizler ve migration'a hazır hale getirir

2. Run migrations
   - Prisma Client generate
   - Migration deploy
   - Hata durumunda detaylı log
```

---

## 🛡️ GELECEKTE BU SORUNLA KARŞILAŞMAMAK İÇİN

### 1. Migration Test Etme (Lokal)
```bash
# Lokalde test et
docker-compose exec backend npx prisma migrate dev

# Test ortamına benzer ortamda test et
docker-compose -f docker-compose.test.yml run --rm backend npx prisma migrate dev
```

### 2. Migration İdempotent Yaz
Migration dosyalarında her zaman `IF NOT EXISTS` kontrolleri kullan:
```sql
-- Tablo oluştur
CREATE TABLE IF NOT EXISTS "my_table" (...);

-- Kolon ekle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='my_table' AND column_name='my_column') THEN
    ALTER TABLE "my_table" ADD COLUMN "my_column" TEXT;
  END IF;
END $$;
```

### 3. Failed Migration Temizleme Script'i Her Zaman Hazır
```bash
# Lokal temizleme
npm run db:fix-failed-migration

# Remote temizleme
npm run db:fix-failed-migration-remote
```

---

## 🔍 SORUN TANIMASI

### Neden Oluştu?
1. Migration çalıştırıldı
2. Bir sebepten dolayı yarıda kesildi (timeout, network, vb.)
3. `_prisma_migrations` tablosunda `finished_at` NULL kaldı
4. Prisma bu durumu "failed migration" olarak algıladı
5. Yeni migration denemelerini engelledi

### Çözüm Mantığı
1. `_prisma_migrations` tablosundan başarısız kaydı sil
2. Migration'ı tekrar çalıştır
3. Migration idempotent olduğu için (IF NOT EXISTS) güvenle çalışır

### Neden Lokalde Sorun Yok?
- Lokal database temiz ve sık sık reset ediliyor
- Test sunucusunda database persist ediyor
- Başarısız migration kayıtları birikebiliyor

---

## 📊 MIGRATION DURUMUNU KONTROL ETME

### Tüm Migration'ları Listele
```bash
docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test << 'EOF'
SELECT 
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  CASE 
    WHEN finished_at IS NULL THEN '❌ Başarısız'
    WHEN rolled_back_at IS NOT NULL THEN '🔄 Geri Alındı'
    ELSE '✅ Başarılı'
  END as durum
FROM _prisma_migrations 
ORDER BY started_at DESC 
LIMIT 10;
EOF
```

### Sadece Başarısız Migration'ları Göster
```bash
docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test -c "SELECT migration_name, started_at, logs FROM _prisma_migrations WHERE finished_at IS NULL;"
```

### Prisma Migration Status
```bash
docker compose -f docker-compose.test.yml exec backend npx prisma migrate status
```

---

## ⚡ HIZLI REFERANS

| Durum | Komut |
|-------|-------|
| Sunucuda başarısız migration temizle | `ssh hetzner-deploy "cd /opt/tipbox-backend && docker compose -f docker-compose.test.yml exec -T postgres psql -U tipbox_user -d tipbox_test -c \"DELETE FROM _prisma_migrations WHERE finished_at IS NULL;\""` |
| Migration tekrar çalıştır | `ssh hetzner-deploy "cd /opt/tipbox-backend && docker compose -f docker-compose.test.yml run --rm backend npx prisma migrate deploy"` |
| Migration durumunu kontrol et | `ssh hetzner-deploy "cd /opt/tipbox-backend && docker compose -f docker-compose.test.yml exec backend npx prisma migrate status"` |
| Yerel script'ten temizle | `npm run db:fix-failed-migration-remote` |

---

## 🎯 ŞU AN YAPMALISIN

1. **Acil çözüm için yukarıdaki "ACIL ÇÖZÜM" komutlarını SSH ile çalıştır**
2. **Veya yerel bilgisayarından:** `npm run db:fix-failed-migration-remote`
3. **Deploy'u tekrar başlat** (GitHub Actions otomatik devam eder)

Artık bu sorun gelecekte **otomatik** olarak çözülecek! 🎉

