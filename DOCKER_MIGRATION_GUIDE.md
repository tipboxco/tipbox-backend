# Docker Migration ve Seed Rehberi

> Bu rehber, Docker Compose üzerinde çalışan Tipbox Backend için migration ve seed işlemlerini açıklar.

## 🎯 Hızlı Başlangıç

### Temel Migration + Schema Sync (Önerilen)

```bash
npm run db:setup
```

Bu komut şunları yapar:
1. ✅ Database bağlantısını kontrol eder
2. ✅ Migration durumunu gösterir
3. ✅ Migration'ları uygular (`migrate deploy`)
4. ✅ Prisma Client'ı yeniler (`generate`)
5. ✅ Schema sync yapar (`db push`)
6. ✅ Backend'i restart eder
7. ✅ Servis hazır olmasını bekler

### Migration + Seed (Tam Kurulum)

```bash
npm run db:setup:full
```

Yukarıdaki adımlara ek olarak:
8. ✅ Seed verilerini yükler

---

## 📚 Detaylı Komutlar

### 1. Migration İşlemleri

#### Migration Durumunu Görüntüle
```bash
npm run db:status
```

#### Migration'ları Uygula (Production)
```bash
npm run db:migrate:deploy
```

#### Migration Oluştur + Uygula (Development)
```bash
npm run db:migrate
# İsim girer: add_new_feature
```

### 2. Prisma Client İşlemleri

#### Client'ı Yenile
```bash
npm run db:generate
```

#### Schema'yı Database'e Push Et (Migration olmadan)
```bash
npm run db:push
```

> ⚠️ **Uyarı**: `db:push` production'da kullanılmamalı, sadece development için!

### 3. Seed İşlemleri

#### Minimal Seed (Kullanıcı verileri temizle + seed)
```bash
npm run db:seed
```

#### Tam Seed (Tüm verileri temizle + tam seed)
```bash
npm run db:seed:all
```

#### Sadece Kullanıcı Verilerini Temizle
```bash
npm run db:reset
```

#### Tüm Verileri Temizle (Tehlikeli!)
```bash
npm run db:reset:all
```

### 4. Backend İşlemleri

#### Backend'i Yeniden Başlat
```bash
docker-compose restart backend
```

#### Backend Loglarını İzle
```bash
docker-compose logs -f backend
```

---

## 🔧 Sorun Giderme

### Sorun 1: "Unknown argument 'likesCount'"

**Neden**: Prisma Client eski, yeni field'ları bilmiyor.

**Çözüm**:
```bash
npm run db:generate
docker-compose restart backend
```

### Sorun 2: "Engine is not yet connected"

**Neden**: Prisma Client database'e bağlanmadan önce sorgu çalışıyor.

**Çözüm**:
```bash
npm run db:generate
npm run db:push
docker-compose restart backend
```

### Sorun 3: "Column does not exist (eventId, sharesCount, etc.)"

**Neden**: Schema ile database sync değil.

**Çözüm**:
```bash
npm run db:push --accept-data-loss
docker-compose restart backend
```

### Sorun 4: Migration Başarısız

**Neden**: Migration dosyası bozuk veya database state uyumsuz.

**Çözüm**:
```bash
# 1. Migration durumunu kontrol et
npm run db:status

# 2. Schema'yı force push et
npm run db:push

# 3. Migration'ları resolve et
docker-compose exec backend npx prisma migrate resolve --applied <migration_name>
```

### Sorun 5: Seed Başarısız

**Neden**: Schema ile seed script'i uyumsuz.

**Çözüm**:
```bash
# 1. Schema'yı sync et
npm run db:push

# 2. Client'ı generate et
npm run db:generate

# 3. Backend'i restart et
docker-compose restart backend

# 4. Seed'i tekrar dene
npm run db:seed:all
```

---

## 🚀 Deployment Workflow

### Development Ortamı

```bash
# 1. Değişiklikleri çek
git pull origin feat/interactions

# 2. Migration + Schema sync
npm run db:setup

# 3. Seed yükle (isteğe bağlı)
npm run db:seed:all
```

### Test Ortamı

```bash
# 1. Schema'yı kontrol et
npm run db:status

# 2. Migration'ları uygula
npm run db:migrate:deploy

# 3. Client'ı generate et
npm run db:generate

# 4. Backend'i restart et
docker-compose restart backend

# 5. Health check
curl http://localhost:3000/health
```

### Production Ortamı

```bash
# ⚠️ PRODUCTION'DA BACKUP ALIN! ⚠️

# 1. Database backup
docker-compose exec postgres pg_dump -U <user> -d <db> > backup_$(date +%Y%m%d).sql

# 2. Migration'ları uygala
npm run db:migrate:deploy

# 3. Client'ı generate et
npm run db:generate

# 4. Backend'i restart et (zero downtime için load balancer kullanın)
docker-compose restart backend

# 5. Rollback planı hazır olsun!
```

---

## 📋 Migration Checklist

### Yeni Migration Eklerken

- [ ] Schema değişikliğini yap (`prisma/schema.prisma`)
- [ ] Migration oluştur (`npm run db:migrate`)
- [ ] Migration SQL'ini gözden geçir
- [ ] Seed script'ini güncelle (gerekirse)
- [ ] Domain entity'leri güncelle
- [ ] Repository'leri güncelle
- [ ] Test et (local)
- [ ] Dokümante et
- [ ] Commit + Push
- [ ] Test ortamında dene
- [ ] Production'a deploy

### Migration'dan Sonra

- [ ] `db:status` ile migration durumunu kontrol et
- [ ] `db:generate` ile client'ı yenile
- [ ] Backend'i restart et
- [ ] Health check yap
- [ ] API endpoint'leri test et
- [ ] Log'ları kontrol et

---

## 🎓 Best Practices

### 1. Migration Stratejisi

✅ **Yapılması Gerekenler**:
- Her feature için ayrı migration oluştur
- Migration isimlerini açıklayıcı yap
- Breaking change'lerde backward compatibility sağla
- Migration'ları test ortamında test et

❌ **Yapılmaması Gerekenler**:
- Production'da `db:push` kullanma
- Migration'ları manuel düzenleme
- Çalışan migration'ları silme
- Schema'yı migration olmadan değiştirme

### 2. Seed Stratejisi

✅ **Yapılması Gerekenler**:
- Seed'i idempotent yap (tekrar çalıştırılabilir)
- Metadata kontrolü yap (seed verileri vs production verileri)
- Kategorize edilmiş temizleme fonksiyonları kullan
- Progress bar göster

❌ **Yapılmaması Gerekenler**:
- Production'da `db:reset:all` çalıştırma
- Taxonomy verilerini silme (categories, brands, etc.)
- Backup almadan temizlik yapma

### 3. Docker Best Practices

✅ **Yapılması Gerekenler**:
- Container içinde işlem yap (`docker-compose exec`)
- Volume'ları kullan (data persistence)
- Health check'leri tanımla
- Log'ları izle

❌ **Yapılmaması Gerekenler**:
- Container dışından Prisma çalıştırma
- Database connection string'i expose etme
- Development ve production aynı database kullanma

---

## 🔍 Debug Komutları

### Database Bağlantısını Test Et
```bash
docker-compose exec backend npx prisma db execute --stdin <<< "SELECT 1;"
```

### Tablo Yapısını Göster
```bash
docker-compose exec postgres psql -U <user> -d <db> -c "\d content_posts"
```

### Migration History
```bash
docker-compose exec backend npx prisma migrate status
```

### Prisma Studio (Database UI)
```bash
# Zaten çalışıyor: http://localhost:5555
docker-compose logs prisma-studio
```

---

## 📞 Destek

### Hata Alırsanız

1. Bu dosyayı kontrol edin (yukarıdaki sorun giderme)
2. Log'ları kontrol edin:
   ```bash
   docker-compose logs backend --tail=100
   ```
3. Migration durumunu kontrol edin:
   ```bash
   npm run db:status
   ```
4. Schema sync yapın:
   ```bash
   npm run db:push
   docker-compose restart backend
   ```

### İlgili Dosyalar

- 📄 `INTERACTION_SYSTEM_DEPLOYMENT.md` - Interaction feature deployment
- 📄 `INTERACTION_SYSTEM_SUMMARY.md` - Feature özeti
- 📄 `scripts/docker-migrate-and-seed.sh` - Otomatik migration script
- 📄 `package.json` - Tüm npm komutları

---

## ✨ Özet

**En Sık Kullanılan Komutlar**:

```bash
# Hızlı setup (migration + sync)
npm run db:setup

# Tam setup (migration + sync + seed)
npm run db:setup:full

# Sadece migration uygula
npm run db:migrate:deploy

# Backend restart
docker-compose restart backend

# Health check
curl http://localhost:3000/health
```

**Hatırlatma**: Her migration'dan sonra:
1. Generate (`npm run db:generate`)
2. Restart (`docker-compose restart backend`)
3. Test (API endpoint'leri dene)

---

**Son Güncelleme**: 30 Aralık 2024  
**Versiyon**: 1.0.0  
**Branch**: `feat/interactions`

