# Redis & BullMQ Entegrasyonu

Bu dokümantasyon, Tipbox Backend projesine eklenen Redis cache ve BullMQ arka plan işlem kuyruğu entegrasyonunu açıklar.

## 🚀 Özellikler

### Redis Cache Katmanı
- **Cache-Aside Pattern** ile veritabanı okuma performansını artırır
- Kullanıcı profilleri için otomatik cache yönetimi
- TTL (Time To Live) desteği
- Cache invalidation (güncelleme sırasında otomatik temizlik)
- Hata toleransı (cache hatası durumunda doğrudan veritabanına fallback)

### BullMQ Arka Plan İşlem Kuyruğu
- **Asenkron bildirim sistemi** (Socket.IO ile entegre)
- **Retry mekanizması** (başarısız işler için otomatik yeniden deneme)
- **Job prioritization** (öncelikli işler için)
- **Queue monitoring** (kuyruk durumu takibi)
- **Graceful shutdown** (güvenli kapatma)

## 📁 Dosya Yapısı

```
src/
├── infrastructure/
│   ├── cache/
│   │   └── cache.service.ts          # Redis cache servisi
│   ├── queue/
│   │   └── queue.provider.ts         # BullMQ kuyruk yöneticisi
│   └── workers/
│       ├── notification.worker.ts    # Bildirim worker'ı
│       └── index.ts                  # Worker başlatıcı
├── application/
│   ├── user/
│   │   └── user.service.ts           # Cache entegrasyonlu user servisi
│   └── gamification/
│       └── gamification.service.ts   # Kuyruk entegrasyonlu gamification servisi
└── interfaces/
    └── server.ts                     # Ana server (cache & queue başlatma)
```

## 🛠️ Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Redis Servisini Başlat
```bash
# Docker Compose ile
docker-compose up redis -d

# Veya manuel Redis
redis-server
```

### 3. Ana API Sunucusunu Başlat
```bash
# Development
npm run dev

# Production
npm run start
```

### 4. Worker'ları Başlat (Ayrı Terminal)
```bash
npm run worker
```

## 🔧 Konfigürasyon

### Environment Variables
```env
# Redis bağlantısı
REDIS_URL=redis://localhost:6379

# Diğer mevcut değişkenler...
```

### Cache Ayarları
- **TTL**: Varsayılan 3600 saniye (1 saat)
- **Key Pattern**: `user:{userId}:profile`
- **Fallback**: Cache hatası durumunda doğrudan veritabanı

### Queue Ayarları
- **Concurrency**: 5 eşzamanlı iş
- **Retry**: 3 deneme
- **Backoff**: Exponential (2 saniye başlangıç)
- **Cleanup**: 100 tamamlanan, 50 başarısız iş tutulur

## 📖 Kullanım Örnekleri

### Cache Kullanımı

```typescript
import { CacheService } from '../infrastructure/cache/cache.service';

const cacheService = CacheService.getInstance();

// Veri cache'le
await cacheService.set('user:123:profile', userData, 3600);

// Cache'ten veri al
const cachedUser = await cacheService.get<User>('user:123:profile');

// Cache'i temizle
await cacheService.del('user:123:profile');
```

### Queue Kullanımı

```typescript
import { QueueProvider } from '../infrastructure/queue/queue.provider';

const queueProvider = QueueProvider.getInstance();

// Bildirim işi ekle
await queueProvider.addNotificationJob({
  type: 'NEW_BADGE',
  userId: 123,
  badgeName: 'İlk Post',
  badgeIcon: '🎯'
});

// Analitik işi ekle
await queueProvider.addAnalyticsJob({
  event: 'user_login',
  userId: 123,
  data: { timestamp: new Date() }
});
```

### User Service Cache Entegrasyonu

```typescript
import { UserService } from '../application/user/user.service';

const userService = new UserService();

// Cache'li profil getirme
const profile = await userService.getUserProfile(123);

// Profil güncelleme (cache otomatik temizlenir)
await userService.updateUserProfile(123, { email: 'new@email.com' });
```

### Gamification Service Queue Entegrasyonu

```typescript
import { GamificationService } from '../application/gamification/gamification.service';

const gamificationService = new GamificationService();

// Rozet ver (bildirim otomatik kuyruğa eklenir)
await gamificationService.grantBadgeToUser(123, 1);
```

## 🔍 Monitoring ve Debugging

### Queue Durumu Kontrolü
```typescript
const queueProvider = QueueProvider.getInstance();
const status = await queueProvider.getQueueStatus('notifications');
console.log(status);
// { waiting: 5, active: 2, completed: 100, failed: 3 }
```

### Cache Bağlantı Durumu
```typescript
const cacheService = CacheService.getInstance();
const isConnected = cacheService.isCacheConnected();
console.log('Cache connected:', isConnected);
```

### Log Takibi
Tüm cache ve queue işlemleri Winston logger ile loglanır:
- **Debug**: Cache hit/miss, job ekleme
- **Info**: Başarılı işlemler, worker başlatma
- **Error**: Hatalar, başarısız işler

## 🚨 Hata Yönetimi

### Cache Hataları
- Cache bağlantı hatası durumunda doğrudan veritabanına fallback
- JSON parse/stringify hataları loglanır ve null döndürülür
- TTL süresi dolmuş veriler otomatik temizlenir

### Queue Hataları
- Başarısız işler otomatik retry edilir (3 kez)
- Exponential backoff ile yeniden deneme
- Worker hatası durumunda graceful shutdown
- Socket.IO hatası durumunda job fail edilmez (geçici ağ sorunu olabilir)

## 🔄 Graceful Shutdown

Sistem SIGTERM veya SIGINT sinyali aldığında:
1. HTTP server kapatılır
2. Cache bağlantısı kapatılır
3. Tüm kuyruklar kapatılır
4. Redis bağlantıları kapatılır
5. Process güvenli şekilde sonlandırılır

## 📊 Performans İyileştirmeleri

### Cache Hit Rate
- Kullanıcı profilleri için %80+ cache hit rate beklenir
- Sık okunan veriler için cache kullanımı önerilir

### Queue Throughput
- 5 eşzamanlı worker ile saniyede 50+ bildirim işlenebilir
- Retry mekanizması ile %99+ başarı oranı

### Memory Usage
- Redis memory kullanımı cache TTL ile kontrol edilir
- Queue cleanup ile memory leak önlenir

## 🔮 Gelecek Geliştirmeler

- [ ] Cache warming (uygulama başlangıcında popüler verileri cache'le)
- [ ] Queue dashboard (Bull Board entegrasyonu)
- [ ] Cache metrics (hit/miss oranları)
- [ ] Push notification entegrasyonu
- [ ] Email notification worker'ı
- [ ] Analytics worker'ı
- [ ] Cache cluster desteği
- [ ] Queue scaling (horizontal scaling)

## 🐛 Troubleshooting

### Redis Bağlantı Hatası
```bash
# Redis servisini kontrol et
docker-compose ps redis

# Redis loglarını kontrol et
docker-compose logs redis
```

### Worker Başlatma Hatası
```bash
# Worker loglarını kontrol et
npm run worker

# Redis bağlantısını test et
redis-cli ping
```

### Cache Miss Oranı Yüksek
- TTL sürelerini artırın
- Cache key pattern'lerini optimize edin
- Sık güncellenen veriler için cache invalidation stratejisi gözden geçirin

### Queue Backlog
- Worker sayısını artırın (concurrency)
- Job priority'lerini ayarlayın
- Retry stratejisini optimize edin
