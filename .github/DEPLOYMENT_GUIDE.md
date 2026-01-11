# 🚀 Test Sunucusu Deployment Kılavuzu

Bu kılavuz, test sunucusuna deployment yaparken kullanabileceğiniz seçenekleri açıklar.

## 📋 Deployment Seçenekleri

### 1. **Run seed data?** (Seed Verisini Çalıştır)
- **Varsayılan**: ❌ Hayır (false)
- **Ne zaman kullanılır**: Veritabanını sıfırdan doldurmak istediğinizde
- **Dikkat**: Bu seçenek veritabanını temizler ve test verileriyle doldurur!

```
✅ İşaretle: Veritabanını sıfırla ve seed data ekle
❌ Boş bırak: Mevcut datayı koru (sadece migration çalışır)
```

### 2. **Force rebuild without cache?** (Cache Olmadan Yeniden Build)
- **Varsayılan**: ❌ Hayır (false)
- **Ne zaman kullanılır**: 
  - Docker image sorunları yaşadığınızda
  - Bağımlılıkları (dependencies) güncellediğinizde
  - Build cache'i temizlemek istediğinizde

```
✅ İşaretle: Tüm image'ı sıfırdan build et (yavaş ama güvenli)
❌ Boş bırak: Cache kullan (hızlı deployment)
```

### 3. **Skip database backup?** (Database Backup'ını Atla)
- **Varsayılan**: ❌ Hayır (false)
- **Ne zaman kullanılır**:
  - Hızlı deployment için
  - Sadece kod değişiklikleri yaptığınızda
  - Database'i etkilemeyen değişiklikler için

```
✅ İşaretle: Backup alma (hızlı)
❌ Boş bırak: Backup al (güvenli)
```

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Normal Backend Değişiklikleri
**Durum**: API endpoint'lerinde veya business logic'te değişiklik yaptınız.

```
✅ Otomatik: git push yap
   • Seed: ❌ Çalışmaz
   • Build: ⚡ Cache ile
   • Backup: ✅ Alınır
```

**veya Manuel:**
```
Actions → Run workflow
   • Branch: test
   • Run seed data: ❌ (boş)
   • Force rebuild: ❌ (boş)
   • Skip backup: ✅ (işaretli) - Hızlı deployment için
```

---

### Senaryo 2: Database Schema Değişiklikleri
**Durum**: Prisma schema'da değişiklik yaptınız ve migration oluşturdunuz.

```
Actions → Run workflow
   • Branch: test
   • Run seed data: ❌ (boş) - Mevcut datayı koru
   • Force rebuild: ❌ (boş)
   • Skip backup: ❌ (boş) - BACKUP AL!
```

---

### Senaryo 3: Database'i Sıfırdan Doldurma
**Durum**: Test verisini yenilemek veya seed data'yı güncellemek istiyorsunuz.

```
Actions → Run workflow
   • Branch: test
   • Run seed data: ✅ (işaretli)
   • Force rebuild: ❌ (boş)
   • Skip backup: ❌ (boş) - BACKUP AL!
```

---

### Senaryo 4: Dependencies Güncelleme
**Durum**: package.json'da yeni paket eklediniz veya sürüm güncellemesi yaptınız.

```
Actions → Run workflow
   • Branch: test
   • Run seed data: ❌ (boş)
   • Force rebuild: ✅ (işaretli) - Cache'i temizle
   • Skip backup: ✅ (işaretli)
```

---

### Senaryo 5: Docker veya Build Sorunları
**Durum**: Deployment başarısız oluyor veya garip hatalar alıyorsunuz.

```
Actions → Run workflow
   • Branch: test
   • Run seed data: ❌ (boş)
   • Force rebuild: ✅ (işaretli) - Sıfırdan build
   • Skip backup: ✅ (işaretli)
```

---

### Senaryo 6: Tam Sıfırlama (Fresh Start)
**Durum**: Her şeyi sıfırdan kurmak istiyorsunuz.

```
Actions → Run workflow
   • Branch: test
   • Run seed data: ✅ (işaretli)
   • Force rebuild: ✅ (işaretli)
   • Skip backup: ❌ (boş) - BACKUP AL!
```

---

## ⚡ Hız Optimizasyonu

### En Hızlı Deployment (Kod değişiklikleri için)
```bash
git push  # Otomatik deployment
```
Veya manuel:
```
• Run seed data: ❌
• Force rebuild: ❌
• Skip backup: ✅
```
**Süre**: ~2-3 dakika

### Normal Deployment (Güvenli)
```
• Run seed data: ❌
• Force rebuild: ❌
• Skip backup: ❌
```
**Süre**: ~3-4 dakika

### Tam Deployment (Her şey dahil)
```
• Run seed data: ✅
• Force rebuild: ✅
• Skip backup: ❌
```
**Süre**: ~8-10 dakika

---

## 🛡️ Güvenlik Kontrol Listesi

Deployment yapmadan önce:

- [ ] Migration'lar test edildi mi?
- [ ] Kritik değişiklik varsa backup alınacak mı?
- [ ] Seed data çalıştırılacaksa, production data'yı etkilemeyeceğinden emin misiniz?
- [ ] Force rebuild gerekli mi yoksa gereksiz mi?

---

## 📊 Deployment Aşamaları

Her deployment şu aşamalardan geçer:

1. ✅ **Prepare** - Git pull, branch checkout
2. 💾 **Backup** - Database backup (opsiyonel)
3. 🛑 **Stop** - Servisleri durdur
4. 🔨 **Build** - Docker image'ları build et
5. 🔧 **Prisma** - Prisma Client generate et
6. 🚀 **Infrastructure** - Postgres, Redis, Minio başlat
7. ⏳ **Wait** - Database'in hazır olmasını bekle
8. 📊 **Migrate** - Migration'ları çalıştır
9. 🌱 **Seed** - Seed data ekle (opsiyonel)
10. 🚀 **Start** - Tüm servisleri başlat
11. 🏥 **Health** - Sağlık kontrolü
12. 🧹 **Cleanup** - Eski image'ları temizle

---

## 🆘 Sorun Giderme

### Deployment Başarısız Olursa

1. **Migration hatası**:
   - Backup'tan geri dön
   - Migration'ı düzelt
   - Tekrar dene

2. **Build hatası**:
   - Force rebuild kullan
   - Dependencies'i kontrol et

3. **Health check başarısız**:
   - Logs'ları kontrol et: `docker compose -f docker-compose.test.yml logs backend`
   - Port çakışması var mı kontrol et

---

## 📞 İletişim

Deployment ile ilgili sorunlar için:
- GitHub Issues açın
- DevOps ekibine ulaşın

---

## 🔄 Otomatik vs Manuel Deployment

### Otomatik (git push)
```yaml
Trigger: test veya staging branch'ine push
Seed: ❌ Çalışmaz
Build: ⚡ Cache ile
Backup: ✅ Alınır
```

### Manuel (Run workflow)
```yaml
Trigger: GitHub Actions UI'dan
Seed: 🎛️ Seçiminize bağlı
Build: 🎛️ Seçiminize bağlı
Backup: 🎛️ Seçiminize bağlı
```

---

**Best Practice**: 
- Günlük development için → Otomatik deployment (git push)
- Özel durumlar için → Manuel deployment (Run workflow)

