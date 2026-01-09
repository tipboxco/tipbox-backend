# Tipbox Backend Dokümantasyonu

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Mimari](#mimari)
3. [Teknolojiler](#teknolojiler)
4. [Proje Yapısı](#proje-yapısı)
5. [Modül Örneği: Notification](#modül-örneği-notification)
6. [Diğer Modüller](#diğer-modüller)
7. [Docker ve Ortamlar](#docker-ve-ortamlar)
8. [API Endpoints](#api-endpoints)
9. [Veritabanı](#veritabanı)
10. [Cache ve Queue](#cache-ve-queue)
11. [Realtime İletişim](#realtime-iletişim)
12. [Deployment](#deployment)

---

## Genel Bakış

Tipbox Backend, **Domain-Driven Design (DDD)** ve **Modular Monolith** prensiplerine göre tasarlanmış, TypeScript ve Node.js ile geliştirilmiş bir backend API'sidir. Proje, içerik paylaşımı, sosyal etkileşim, mesajlaşma, gamification, NFT ve kripto para işlemleri gibi çoklu özellikleri destekler.

### Temel Özellikler

- ✅ **Modüler Mimari**: Her modül bağımsız domain, application ve infrastructure katmanlarına sahip
- ✅ **Type-Safe**: TypeScript ve Prisma ORM ile tam tip güvenliği
- ✅ **Asenkron İşlemler**: BullMQ ile queue tabanlı işlem yönetimi
- ✅ **Caching**: Redis ile performans optimizasyonu
- ✅ **Realtime**: Socket.IO ile anlık mesajlaşma ve bildirimler
- ✅ **Scalable**: Worker pattern ile yatay ölçeklenebilirlik
- ✅ **Monitoring**: Prometheus metrics ve Winston logging

---

## Mimari

### Katmanlı Mimari (Layered Architecture)

Proje, **Clean Architecture** prensiplerine uygun olarak 4 ana katmandan oluşur:

```
┌─────────────────────────────────────┐
│      Interfaces (API Layer)         │  ← HTTP/REST endpoints, Socket.IO handlers
├─────────────────────────────────────┤
│      Application (Use Cases)        │  ← Business logic, orchestration
├─────────────────────────────────────┤
│      Domain (Business Logic)        │  ← Entities, Value Objects, Domain Services
├─────────────────────────────────────┤
│   Infrastructure (Technical)        │  ← Database, Cache, Queue, External APIs
└─────────────────────────────────────┘
```

### Domain-Driven Design (DDD)

Her modül kendi **bounded context**'ine sahiptir:

- **Domain Layer**: İş mantığı ve entity'ler
- **Application Layer**: Use case'ler ve servisler
- **Infrastructure Layer**: Teknik implementasyonlar (Prisma, Redis, S3)
- **Interface Layer**: HTTP endpoints ve Socket.IO handlers

### Dependency Rule

Katmanlar arası bağımlılık yönü: **İçeriden dışarıya**

- Domain → Hiçbir katmana bağımlı değil
- Application → Sadece Domain'e bağımlı
- Infrastructure → Domain ve Application'a bağımlı
- Interfaces → Tüm katmanlara bağımlı

---

## Teknolojiler

### Core Stack

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **Node.js** | 23.6.0+ | Runtime environment |
| **TypeScript** | 5.8.3 | Type-safe JavaScript |
| **Express.js** | 4.21.2 | Web framework |
| **Prisma** | 6.19.0 | ORM ve database toolkit |

### Database & Storage

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **PostgreSQL** | 15 | Ana veritabanı |
| **Redis** | 7 | Cache ve pub/sub |
| **MinIO/S3** | Latest | Object storage (medya dosyaları) |

### Queue & Workers

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **BullMQ** | 5.62.0 | Job queue yönetimi |
| **Redis** | 7 | Queue backend |

### Realtime & Communication

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **Socket.IO** | 4.7.5 | WebSocket iletişimi |
| **@socket.io/redis-adapter** | 8.2.1 | Multi-instance Socket.IO desteği |

### Authentication & Security

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **JWT** | 9.0.2 | Token-based authentication |
| **Auth0** | - | OAuth2/OIDC provider |
| **bcryptjs** | 3.0.2 | Password hashing |
| **Helmet** | 8.1.0 | Security headers |

### Monitoring & Logging

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **Winston** | 3.17.0 | Logging |
| **Morgan** | 1.10.0 | HTTP request logging |
| **Prometheus** | 15.1.3 | Metrics collection |

### Development Tools

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **ESLint** | 9.30.1 | Code linting |
| **Prettier** | 3.6.2 | Code formatting |
| **Husky** | 9.1.7 | Git hooks |
| **Jest** | 30.2.0 | Testing framework |

### External Services

| Teknoloji | Kullanım Amacı |
|-----------|----------------|
| **Google Gemini AI** | AI-powered content generation |
| **Expo Push Notifications** | Mobile push notifications |
| **Nodemailer** | Email gönderimi (Google Workspace OAuth) |

---

## Proje Yapısı

```
tipbox-backend/
├── src/
│   ├── domain/              # Domain entities, enums, value objects
│   │   ├── notification/
│   │   ├── user/
│   │   ├── content/
│   │   ├── messaging/
│   │   └── ...
│   │
│   ├── application/        # Use cases, business logic
│   │   ├── notification/
│   │   ├── feed/
│   │   ├── messaging/
│   │   └── ...
│   │
│   ├── infrastructure/    # Technical implementations
│   │   ├── repositories/   # Prisma repositories
│   │   ├── cache/          # Redis cache service
│   │   ├── queue/          # BullMQ queue provider
│   │   ├── workers/        # Background workers
│   │   ├── realtime/       # Socket.IO handlers
│   │   ├── config/         # Configuration files
│   │   ├── logger/         # Winston logger
│   │   ├── s3/             # S3/MinIO client
│   │   └── ...
│   │
│   └── interfaces/         # API layer
│       ├── server.ts       # HTTP server setup
│       ├── app.ts          # Express app configuration
│       ├── notification/
│       │   ├── notification.router.ts
│       │   └── notification.dto.ts
│       └── ...
│
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Migration files
│   └── seed/               # Seed data scripts
│
├── docker-compose.yml       # Development environment
├── docker-compose.test.yml  # Test environment
├── docker-compose.prod.yml  # Production environment
├── Dockerfile              # Development Docker image
├── Dockerfile.prod         # Production Docker image
└── ...
```

---

## Modül Örneği: Notification

Notification modülü, sistemdeki tüm bildirimlerin yönetiminden sorumludur. Bu modül, diğer tüm modüllerin nasıl yapılandırıldığını gösteren iyi bir örnektir.

### 1. Domain Layer

#### Entity: `notification.entity.ts`

```typescript
// src/domain/notification/notification.entity.ts
export class Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  markAsRead(): void {
    if (!this.read) {
      this.read = true;
      this.readAt = new Date();
    }
  }

  isRecent(): boolean {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > oneDayAgo;
  }

  toJSON() {
    // Domain entity'yi API response formatına dönüştürür
    return { ... };
  }
}
```

**Özellikler:**
- Domain entity, sadece iş mantığı içerir
- Veritabanı veya framework bağımlılığı yoktur
- `toJSON()` metodu ile API katmanına dönüşüm yapılır

#### Enum: `notification-type.enum.ts`

```typescript
export enum NotificationType {
  POST_LIKED = 'POST_LIKED',
  POST_COMMENTED = 'POST_COMMENTED',
  NEW_MESSAGE = 'NEW_MESSAGE',
  NEW_TRUSTER = 'NEW_TRUSTER',
  // ... diğer tipler
}
```

### 2. Application Layer

#### Service: `notification.service.ts`

```typescript
// src/application/notification/notification.service.ts
export class NotificationService {
  private notificationRepo: NotificationPrismaRepository;
  private settingsRepo: UserSettingsPrismaRepository;
  private notificationFactory: NotificationFactory;
  private queueProvider: QueueProvider;

  constructor() {
    this.notificationRepo = new NotificationPrismaRepository();
    this.settingsRepo = new UserSettingsPrismaRepository();
    this.notificationFactory = new NotificationFactory();
    this.queueProvider = QueueProvider.getInstance();
  }

  async sendNotification(userId: string, type: NotificationType, data: any): Promise<void> {
    // 1. Kullanıcı ayarlarını kontrol et
    const settings = await this.settingsRepo.findByUserId(userId);
    
    // 2. Bildirim gönderim izinlerini kontrol et
    if (settings && settings.receiveNotifications === false) {
      return;
    }

    // 3. Factory ile notification oluştur
    const notification = this.notificationFactory.createNotification(type, data);

    // 4. Queue'ya ekle (async processing)
    await this.queueProvider.addNotificationJob({
      type,
      userId,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      sendEmail: settings?.notificationEmailEnabled ?? false,
      sendPush: settings?.notificationPushEnabled ?? true,
      sendInApp: settings?.notificationInAppEnabled ?? true,
    });
  }

  async getUserNotifications(userId: string, options?: PaginationOptions) {
    return await this.notificationRepo.findByUserId(userId, options);
  }
}
```

**Özellikler:**
- Business logic ve use case'leri içerir
- Repository'leri kullanır (infrastructure bağımlılığı)
- Queue provider ile asenkron işlemler yönetir
- Factory pattern ile notification oluşturur

#### Factory: `notification-factory.ts`

```typescript
export class NotificationFactory {
  createNotification(type: NotificationType, data: any): Notification {
    switch (type) {
      case NotificationType.POST_LIKED:
        return new Notification({
          title: 'Beğeni Aldınız',
          message: `${data.likerName} gönderinizi beğendi`,
          // ...
        });
      // ... diğer tipler
    }
  }
}
```

### 3. Infrastructure Layer

#### Repository: `notification-prisma.repository.ts`

```typescript
// src/infrastructure/repositories/notification-prisma.repository.ts
export class NotificationPrismaRepository {
  private prisma = getPrisma();

  async create(data: CreateNotificationData): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        id: generateIdForModel('Notification'),
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        read: false,
      },
    });
    
    return this.toDomain(notification);
  }

  async findByUserId(userId: string, options?: PaginationOptions) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });
    
    return notifications.map(n => this.toDomain(n));
  }

  private toDomain(prismaNotification: any): Notification {
    return new Notification({
      id: prismaNotification.id,
      userId: prismaNotification.userId,
      type: prismaNotification.type,
      // ... mapping
    });
  }
}
```

**Özellikler:**
- Prisma ile veritabanı işlemleri
- Domain entity'ye dönüşüm (`toDomain`)
- ID generation middleware kullanımı

#### Worker: `notification.worker.ts`

```typescript
// src/infrastructure/workers/notification.worker.ts
export class NotificationWorker {
  private worker: Worker;

  async start() {
    this.worker = new Worker('notification-queue', async (job) => {
      const { userId, type, title, message, data, sendEmail, sendPush, sendInApp } = job.data;
      
      // 1. Database'e kaydet
      await notificationRepo.create({ userId, type, title, message, data });
      
      // 2. Push notification gönder
      if (sendPush) {
        await pushService.sendPushNotification(userId, { title, message, data });
      }
      
      // 3. Email gönder
      if (sendEmail) {
        await emailService.sendEmail(userId, { title, message });
      }
      
      // 4. Socket.IO ile realtime bildirim
      if (sendInApp) {
        socketManager.emitToUser(userId, 'notification', { title, message, data });
      }
    });
  }
}
```

### 4. Interface Layer

#### Router: `notification.router.ts`

```typescript
// src/interfaces/notification/notification.router.ts
const router = Router();
const notificationService = new NotificationService();

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { limit, offset, unreadOnly } = req.query;
  
  const result = await notificationService.getUserNotifications(userId, {
    limit: parseQueryInt(limit, 20),
    offset: parseQueryInt(offset, 0),
    unreadOnly: parseQueryBoolean(unreadOnly),
  });
  
  return res.json({
    success: true,
    data: result.notifications.map(n => n.toJSON()),
    pagination: result.pagination,
  });
});

export default router;
```

**Özellikler:**
- Express router ile HTTP endpoint tanımları
- Swagger/OpenAPI dokümantasyonu
- Authentication middleware
- DTO validation
- Domain entity'den JSON'a dönüşüm

### Notification Modülü Akış Şeması

```
┌─────────────┐
│   API Call  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Router Layer   │  ← HTTP endpoint, auth, validation
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Service Layer   │  ← Business logic, orchestration
└──────┬──────────┘
       │
       ├──► Repository ──► Database (Prisma)
       │
       └──► Queue Provider ──► BullMQ ──► Worker
                                          │
                                          ├──► Push Notification
                                          ├──► Email
                                          └──► Socket.IO (Realtime)
```

---

## Diğer Modüller

### User Modülü
- **Domain**: User, Profile, UserSettings, UserRole entity'leri
- **Application**: Kullanıcı kayıt, profil yönetimi, ayarlar
- **Infrastructure**: UserPrismaRepository, Auth0 adapter
- **Interface**: `/users` endpoints

### Feed Modülü
- **Domain**: Feed, FeedItem entity'leri
- **Application**: Feed scoring, distribution, cleanup servisleri
- **Infrastructure**: FeedPrismaRepository, FeedDistributionWorker
- **Interface**: `/feed` endpoints

### Messaging Modülü
- **Domain**: DMThread, DMMessage, DMRequest entity'leri
- **Application**: Mesajlaşma, thread yönetimi, support request'ler
- **Infrastructure**: MessagingPrismaRepository, Socket.IO handlers
- **Interface**: `/messages` endpoints, Socket.IO events

### Post Modülü
- **Domain**: ContentPost, PostTip, PostTag, PostQuestion entity'leri
- **Application**: Post oluşturma, etkileşimler (like, comment, share)
- **Infrastructure**: ContentPostPrismaRepository
- **Interface**: `/posts` endpoints

### Wallet Modülü
- **Domain**: Wallet, TipsTokenTransfer, NFT entity'leri
- **Application**: Cüzdan yönetimi, TIPS transferleri, NFT işlemleri
- **Infrastructure**: WalletPrismaRepository, Crypto service
- **Interface**: `/wallets` endpoints

### Gamification Modülü
- **Domain**: UserBadge, UserAchievement, RewardClaim entity'leri
- **Application**: Badge/achievement kazanma, ödül sistemi
- **Infrastructure**: GamificationPrismaRepository
- **Interface**: `/interactions` endpoints (badge/achievement bilgileri)

### Expert Modülü
- **Domain**: ExpertRequest, ExpertAnswer entity'leri
- **Application**: Expert matching, request yönetimi, cevap sistemi
- **Infrastructure**: ExpertPrismaRepository
- **Interface**: `/expert` endpoints

### Marketplace Modülü
- **Domain**: Product, ProductGroup, MarketplaceBanner entity'leri
- **Application**: Ürün kataloğu, marketplace banner yönetimi
- **Infrastructure**: ProductPrismaRepository, MarketplaceBannerPrismaRepository
- **Interface**: `/marketplace`, `/products` endpoints

### Inventory Modülü
- **Domain**: Inventory, InventoryMedia, ProductExperience entity'leri
- **Application**: Kullanıcı envanteri, ürün deneyimleri
- **Infrastructure**: InventoryPrismaRepository
- **Interface**: `/inventory` endpoints

### Search Modülü
- **Domain**: - (Search domain entity yok, sadece query)
- **Application**: Arama servisi (post, user, product araması)
- **Infrastructure**: Prisma full-text search
- **Interface**: `/search` endpoints

### Catalog Modülü
- **Domain**: MainCategory, SubCategory entity'leri
- **Application**: Kategori yönetimi, hiyerarşik yapı
- **Infrastructure**: CategoryPrismaRepository
- **Interface**: `/catalog` endpoints

### Brand Modülü
- **Domain**: Brand, BrandSurvey, BridgePost entity'leri
- **Application**: Brand yönetimi, survey sistemi, bridge özellikleri
- **Infrastructure**: BrandPrismaRepository
- **Interface**: `/brands` endpoints

---

## Docker ve Ortamlar

### Development Ortamı

**Docker Compose**: `docker-compose.yml`

```yaml
services:
  postgres:      # PostgreSQL 15
  pgadmin:       # Database admin UI (port 5050)
  minio:         # S3-compatible storage (ports 9000, 9001)
  redis:         # Cache ve queue backend (port 6379)
  backend:        # Node.js backend (port 3000)
  nginx:          # Reverse proxy (ports 80, 443)
  prisma-studio:  # Database GUI (port 5555)
```

**Başlatma:**
```bash
docker-compose up -d
```

**Environment Variables**: `.env` dosyası

### Test Ortamı

**Docker Compose**: `docker-compose.test.yml`

- Production'a benzer yapılandırma
- Test veritabanı ve servisler
- Environment: `.env.test`

### Production Ortamı

**Docker Compose**: `docker-compose.prod.yml`

- Alpine-based images (küçük boyut)
- Health checks
- Volume persistence
- Network isolation
- Environment: `.env.production`

**Dockerfile**: `Dockerfile.prod`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --production
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### Ortam Değişkenleri

| Değişken | Açıklama | Örnek |
|----------|----------|-------|
| `NODE_ENV` | Ortam (development/test/production) | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `S3_ENDPOINT` | MinIO/S3 endpoint | `http://minio:9000` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `AUTH0_DOMAIN` | Auth0 domain | `your-domain.auth0.com` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000,https://app.tipbox.co` |

---

## API Endpoints

### Base URL

- **Development**: `http://localhost:3000`
- **Test**: `https://api-test.tipbox.co`
- **Production**: `https://api.tipbox.co`

### Authentication

Tüm protected endpoint'ler `Authorization: Bearer <token>` header'ı gerektirir.

### Ana Endpoint Grupları

| Endpoint | Açıklama | Auth |
|----------|----------|------|
| `/auth/*` | Authentication (login, register, refresh) | ❌ |
| `/users/*` | Kullanıcı yönetimi | ✅ |
| `/feed` | Feed içerikleri | ✅ |
| `/posts/*` | Post işlemleri | ✅ |
| `/messages/*` | Mesajlaşma | ✅ |
| `/notifications/*` | Bildirimler | ✅ |
| `/wallets/*` | Cüzdan işlemleri | ✅ |
| `/marketplace/*` | Marketplace | ✅ |
| `/expert/*` | Expert sistemi | ✅ |
| `/inventory/*` | Envanter | ✅ |
| `/search` | Arama | ✅ |
| `/catalog/*` | Katalog | ✅ |
| `/brands/*` | Brand yönetimi | ✅ |

### Swagger Documentation

API dokümantasyonu Swagger UI ile sağlanır:

- **URL**: `http://localhost:3000/api-docs`
- **JSON Spec**: `http://localhost:3000/api-docs/swagger.json`

### Health Checks

| Endpoint | Açıklama |
|----------|----------|
| `/health` | Sistem sağlık durumu (database, redis, s3) |
| `/ready` | Readiness probe (Kubernetes için) |
| `/live` | Liveness probe (Kubernetes için) |
| `/metrics` | Prometheus metrics |

---

## Veritabanı

### Prisma ORM

**Schema**: `prisma/schema.prisma`

- Type-safe database client
- Migration yönetimi
- Seed data desteği

### Ana Tablolar

| Tablo | Açıklama |
|-------|----------|
| `users` | Kullanıcılar |
| `profiles` | Kullanıcı profilleri |
| `content_posts` | İçerik gönderileri |
| `content_comments` | Yorumlar |
| `dm_threads` | Mesajlaşma thread'leri |
| `dm_messages` | Mesajlar |
| `notifications` | Bildirimler |
| `wallets` | Cüzdanlar |
| `nfts` | NFT'ler |
| `feeds` | Feed öğeleri |
| `inventories` | Envanterler |

### Migration

```bash
# Yeni migration oluştur
npm run db:migrate

# Migration'ları uygula (production)
npm run db:migrate:deploy

# Schema'yı push et (development)
npm run db:push
```

### Seed Data

```bash
# Seed data yükle
npm run db:seed

# Tüm seed data'yı yükle
npm run db:seed:all
```

### Prisma Studio

Database GUI:

```bash
# Docker içinde
docker-compose exec backend npx prisma studio --port 5555

# Lokal
npx prisma studio
```

**URL**: `http://localhost:5555`

---

## Cache ve Queue

### Redis Cache

**Service**: `CacheService` (`src/infrastructure/cache/cache.service.ts`)

**Kullanım:**
- Feed cache
- Marketplace banner cache
- User profile cache
- API response cache

**Örnek:**
```typescript
const cacheService = CacheService.getInstance();
await cacheService.set('user:123', userData, 3600); // 1 saat TTL
const cached = await cacheService.get('user:123');
```

### BullMQ Queue

**Provider**: `QueueProvider` (`src/infrastructure/queue/queue.provider.ts`)

**Queue'lar:**
- `notification-queue`: Bildirim işlemleri
- `feed-distribution-queue`: Feed dağıtımı
- `feed-cleanup-queue`: Feed temizleme
- `trust-backfill-queue`: Trust ilişkileri backfill

**Worker'lar:**
- `NotificationWorker`: Bildirim gönderimi
- `FeedDistributionWorker`: Feed dağıtımı
- `FeedCleanupWorker`: Feed temizleme
- `TrustBackfillWorker`: Trust backfill

**Örnek:**
```typescript
const queueProvider = QueueProvider.getInstance();
await queueProvider.addNotificationJob({
  userId: '123',
  type: NotificationType.POST_LIKED,
  title: 'Beğeni',
  message: 'Gönderiniz beğenildi',
});
```

---

## Realtime İletişim

### Socket.IO

**Manager**: `SocketManager` (`src/infrastructure/realtime/socket-manager.ts`)

**Özellikler:**
- Redis adapter ile multi-instance desteği
- Room-based messaging
- Typing indicators
- Online/offline status

**Events:**

| Event | Açıklama | Direction |
|-------|----------|-----------|
| `connect` | Bağlantı kuruldu | Client → Server |
| `disconnect` | Bağlantı kesildi | Client → Server |
| `join-room` | Odaya katıl | Client → Server |
| `leave-room` | Odadan ayrıl | Client → Server |
| `message` | Mesaj gönder | Client → Server |
| `message-received` | Mesaj alındı | Server → Client |
| `typing` | Yazıyor göstergesi | Client → Server |
| `notification` | Bildirim | Server → Client |

**Örnek:**
```typescript
// Server-side
socketManager.emitToUser(userId, 'notification', {
  title: 'Yeni Mesaj',
  message: 'Size bir mesaj geldi',
});

// Room-based
io.to(`thread:${threadId}`).emit('message', messageData);
```

**Client UI**: `http://localhost:3000/Socket` (test için)

---

## Deployment

### Development

```bash
# Docker ile
docker-compose up -d

# Lokal
npm run dev
```

### Production

**Docker Compose:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Environment:**
- `.env.production` dosyası gerekli
- SSL sertifikaları (`./ssl`)
- Nginx reverse proxy yapılandırması

### CI/CD

**GitHub Actions** (önerilen):
- Test çalıştırma
- Build
- Docker image oluşturma
- Deployment

### Monitoring

**Prometheus Metrics:**
- Endpoint: `/metrics`
- HTTP request metrics
- Database query metrics
- Queue job metrics

**Logging:**
- Winston ile structured logging
- Daily rotate file logs
- Log retention: 7 gün (dev), 90 gün (prod)

**Health Checks:**
- `/health`: Sistem sağlığı
- `/ready`: Readiness (Kubernetes)
- `/live`: Liveness (Kubernetes)

---

## Özet

Tipbox Backend, **modüler, ölçeklenebilir ve bakımı kolay** bir mimariye sahiptir. Her modül:

1. **Domain katmanında** iş mantığını içerir
2. **Application katmanında** use case'leri yönetir
3. **Infrastructure katmanında** teknik detayları saklar
4. **Interface katmanında** API endpoint'lerini sunar

Bu yapı sayesinde:
- ✅ Modüller bağımsız geliştirilebilir
- ✅ Test edilebilirlik yüksektir
- ✅ Yatay ölçeklenebilirlik sağlanır
- ✅ Kod tekrarı minimize edilir
- ✅ Type safety garantilidir

---

## İletişim ve Destek

- **Repository**: https://github.com/tipboxco/tipbox-backend
- **Issues**: https://github.com/tipboxco/tipbox-backend/issues
- **Documentation**: `/docs` klasörü

---

*Son güncelleme: 2025*

