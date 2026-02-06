# Tipbox Backend - Kapsamlı Teknik Knowledge Base

## 📋 İçindekiler
1. [Proje Genel Bakış](#proje-genel-bakış)
2. [Mimari Yaklaşım](#mimari-yaklaşım)
3. [Teknoloji Stack](#teknoloji-stack)
4. [Domain-Driven Design (DDD) Yapısı](#domain-driven-design-ddd-yapısı)
5. [Database Schema ve Prisma](#database-schema-ve-prisma)
6. [API Endpoint Yapısı](#api-endpoint-yapısı)
7. [Infrastructure Katmanı](#infrastructure-katmanı)
8. [Güvenlik ve Authentication](#güvenlik-ve-authentication)
9. [Real-time Özellikler](#real-time-özellikler)
10. [Queue ve Background Jobs](#queue-ve-background-jobs)
11. [Caching Stratejisi](#caching-stratejisi)
12. [Logging ve Monitoring](#logging-ve-monitoring)
13. [Development Workflow](#development-workflow)
14. [Deployment ve DevOps](#deployment-ve-devops)
15. [Best Practices](#best-practices)

---

## 🎯 Proje Genel Bakış

**Tipbox Backend**, kullanıcıların ürün deneyimlerini paylaştığı, gamification özellikleri olan ve blockchain entegrasyonu bulunan sosyal bir platformun backend servisidir.

### Ana Özellikler:
- **Kullanıcı Yönetimi**: Profil, ayarlar, KYC entegrasyonu
- **İçerik Sistemi**: Post, soru, karşılaştırma, ipuçları
- **Gamification**: Rozet, başarı, puan sistemi
- **Blockchain**: Wallet entegrasyonu, NFT sistemi, token transferleri
- **Real-time**: Socket.IO ile anlık mesajlaşma
- **Brand Bridge**: Marka-kullanıcı etkileşim platformu
- **Event**: Etkinlik sistemi (önceki Wishbox kavramının yerini aldı)

---

## 🏗️ Mimari Yaklaşım

### Clean Architecture + Domain-Driven Design (DDD)

Proje, **Clean Architecture** prensiplerine uygun olarak **4 katmanlı** bir yapıda organize edilmiştir:

```
src/
├── domain/           # Business Logic & Entities
├── application/      # Use Cases & Services  
├── infrastructure/   # External Concerns
└── interfaces/       # API Layer
```

### Katman Sorumlulukları:

#### 1. Domain Layer (`src/domain/`)
- **Business entities** ve **value objects**
- **Domain services** ve **interfaces**
- **Business rules** ve **validation logic**
- **Enums** ve **types**

#### 2. Application Layer (`src/application/`)
- **Use case implementations**
- **Application services**
- **DTOs** ve **mappers**
- **Business workflow orchestration**

#### 3. Infrastructure Layer (`src/infrastructure/`)
- **Database repositories** (Prisma)
- **External service integrations**
- **Caching** (Redis)
- **Queue management** (BullMQ)
- **Logging** (Winston)
- **File storage** (S3/MinIO)

#### 4. Interface Layer (`src/interfaces/`)
- **REST API endpoints**
- **Request/Response handling**
- **Authentication middleware**
- **API documentation** (Swagger)

---

## 🛠️ Teknoloji Stack

### Core Technologies
- **Node.js** (v18+)
- **TypeScript** (v5.8+)
- **Express.js** (v4.21+)
- **Prisma ORM** (v6.12+)
- **PostgreSQL** (v15+)

### Real-time & Caching
- **Socket.IO** (v4.7+) - Real-time communication
- **Redis** (v4.6+) - Caching & session storage
- **BullMQ** (v5.15+) - Background job processing

### Authentication & Security
- **JWT** (jsonwebtoken v9.0+)
- **Auth0** integration (planned)
- **bcryptjs** (v3.0+) - Password hashing
- **Helmet** (v8.1+) - Security headers

### File Storage & Cloud
- **AWS S3** (@aws-sdk/client-s3 v3.658+)
- **MinIO** (local development)

### Development Tools
- **ESLint** (v9.30+) - Code linting
- **Prettier** (v3.6+) - Code formatting
- **Husky** (v9.1+) - Git hooks
- **lint-staged** (v16.1+) - Pre-commit linting
- **Nodemon** (v3.1+) - Development server

### Documentation
- **Swagger/OpenAPI** (swagger-jsdoc v6.2+)
- **Winston** (v3.17+) - Logging
- **Morgan** (v1.10+) - HTTP request logging

---

## 🎯 Domain-Driven Design (DDD) Yapısı

### Domain Entities

#### User Domain
```typescript
// Core user entities
- User (ana kullanıcı entity)
- Profile (kullanıcı profili)
- UserSettings (kullanıcı ayarları)
- UserRole (rol yönetimi)
- UserTrustScore (güven skoru)
- UserKycRecord (KYC kayıtları)
```

#### Content Domain
```typescript
// İçerik yönetimi
- ContentPost (ana içerik)
- PostQuestion (soru postları)
- PostComparison (karşılaştırma)
- PostTip (ipucu postları)
- ContentComment (yorumlar)
- ContentLike (beğeniler)
- ContentFavorite (favoriler)
```

#### Gamification Domain
```typescript
// Oyunlaştırma sistemi
- Badge (rozetler)
- UserBadge (kullanıcı rozetleri)
- AchievementGoal (başarı hedefleri)
- UserAchievement (kullanıcı başarıları)
- RewardClaim (ödül talepleri)
```

#### Crypto Domain
```typescript
// Blockchain entegrasyonu
- Wallet (cüzdan yönetimi)
- NFT (NFT varlıkları)
- TipsTokenTransfer (token transferleri)
- Lootbox (lootbox sistemi)
```

#### Brand Domain
```typescript
// Marka-kullanıcı köprüsü
- Brand (marka yönetimi)
- BridgePost (marka postları)
- BrandSurvey (marka anketleri)
- BridgeFollower (marka takipçileri)
- BridgeLeaderboard (liderlik tablosu)
```

### Business Logic Patterns

#### Entity Business Methods
Her domain entity, kendi business logic'ini içerir:

```typescript
// Örnek: User entity
export class User {
  // Business methods
  hasActiveWallet(): boolean
  canReceiveTips(): boolean
  getTrustLevel(): 'LOW' | 'MEDIUM' | 'HIGH'
  isVerified(): boolean
}

// Örnek: ContentPost entity  
export class ContentPost {
  // Business methods
  isQuestion(): boolean
  isBoostedPost(): boolean
  requiresInventory(): boolean
  belongsToUser(userId: number): boolean
}
```

---

## 🗄️ Database Schema ve Prisma

### Prisma Schema Yapısı

**1672 satırlık** kapsamlı Prisma schema ile **50+ model** tanımlanmıştır:

#### Ana Model Kategorileri:

1. **User Related Models** (15 model)
   - User, Profile, UserSettings, UserRole, UserTrustScore, vb.

2. **Content System Models** (12 model)
   - ContentPost, ContentComment, ContentLike, ContentFavorite, vb.

3. **Gamification Models** (8 model)
   - Badge, UserBadge, AchievementGoal, UserAchievement, vb.

4. **Crypto & NFT Models** (10 model)
   - Wallet, NFT, TipsTokenTransfer, Lootbox, vb.

5. **Brand & Bridge Models** (7 model)
   - Brand, BridgePost, BrandSurvey, BridgeFollower, vb.

6. **Messaging Models** (6 model)
   - DMThread, DMMessage, DMRequest, DMSupportSession, vb.

7. **Admin & Moderation Models** (4 model)
   - AdminLog, ModerationAction, ManualReviewFlag, vb.

### Repository Pattern Implementation

Her domain entity için **Prisma Repository** implementasyonu:

```typescript
// Örnek: UserPrismaRepository
export class UserPrismaRepository {
  private prisma = new PrismaClient();
  
  async findById(id: number): Promise<User | null>
  async create(email: string, displayName?: string): Promise<User>
  async findByEmail(email: string): Promise<User | null>
  async update(id: number, data: Partial<User>): Promise<User | null>
  async delete(id: number): Promise<boolean>
  
  // Domain mapping
  private toDomain(prismaUser: any): User
}
```

### Database Relationships

- **One-to-One**: User ↔ Profile, User ↔ UserSettings
- **One-to-Many**: User → ContentPost, User → Wallet
- **Many-to-Many**: User ↔ Badge (UserBadge), User ↔ Brand (BridgeFollower)

---

## 🌐 API Endpoint Yapısı

### REST API Organization

#### Router Structure:
```
src/interfaces/
├── app.ts              # Ana Express app
├── server.ts           # HTTP server + Socket.IO
├── auth/
│   ├── auth.router.ts  # Authentication endpoints
│   └── auth.middleware.ts # JWT middleware
├── user/
│   ├── user.router.ts  # User management
│   └── user.dto.ts     # Data transfer objects
└── wallet/
    ├── wallet.router.ts # Wallet management
    └── wallet.dto.ts    # Wallet DTOs
```

#### API Endpoints:

##### Authentication (`/auth`)
- `POST /auth/login` - Kullanıcı girişi
- `POST /auth/register` - Kullanıcı kaydı
- `POST /auth/refresh` - Token yenileme

##### Users (`/users`)
- `POST /users` - Kullanıcı oluşturma
- `GET /users/:id` - Kullanıcı detayı
- `PUT /users/:id` - Kullanıcı güncelleme
- `DELETE /users/:id` - Kullanıcı silme

##### Wallets (`/wallets`)
- `GET /wallets` - Kullanıcı cüzdanları
- `GET /wallets/active` - Aktif cüzdan
- `POST /wallets/connect` - Cüzdan bağlama
- `PUT /wallets/:id/disconnect` - Cüzdan bağlantısını kesme

### Swagger Documentation

**OpenAPI 3.0** standardında API dokümantasyonu:

```typescript
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tipbox API',
      version: '1.0.0',
      description: 'Tipbox servisleri için API dokümantasyonu'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local' },
      { url: 'https://api.tipbox.co', description: 'Production' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  }
};
```

### CORS Configuration

```typescript
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://app.tipbox.co'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin']
};
```

---

## 🔧 Infrastructure Katmanı

### Configuration Management

#### Environment Configuration
```typescript
// src/infrastructure/config/index.ts
type Config = {
  databaseUrl: string;
  port: number;
  nodeEnv: string;
};

// Ortama göre .env dosyası yükleme
const envFile = `.env${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}`;
```

#### Redis Configuration
```typescript
// src/infrastructure/config/redis.config.ts
export class RedisConfigManager {
  async initialize(): Promise<RedisConfig> {
    const pubClient = createClient({ url: redisUrl });
    const subClient = createClient({ url: redisUrl });
    // Error handling ve connection management
  }
}
```

#### Socket.IO Configuration
```typescript
// src/infrastructure/config/socket.config.ts
export class SocketConfigManager {
  initialize(): SocketConfig {
    return {
      cors: { origin: origins, methods, credentials: true },
      transports: ['websocket', 'polling'],
      allowEIO3: false
    };
  }
}
```

### Caching Strategy

#### Redis Cache Service
```typescript
// src/infrastructure/cache/cache.service.ts
export class CacheService {
  async get<T>(key: string): Promise<T | null>
  async set(key: string, value: any, ttl?: number): Promise<void>
  async delete(key: string): Promise<void>
  async clear(): Promise<void>
  async getKeys(pattern: string): Promise<string[]>
}
```

#### Cache Patterns:
- **User Data Caching**: Kullanıcı profilleri ve ayarları
- **Content Caching**: Popüler postlar ve kategoriler
- **Session Storage**: JWT token'ları ve session bilgileri
- **Real-time Data**: Socket.IO room bilgileri

### Queue Management

#### BullMQ Integration
```typescript
// src/infrastructure/queue/queue.provider.ts
export class QueueProvider {
  async addNotificationJob(data: NotificationJobData): Promise<Job>
  async addAnalyticsJob(data: AnalyticsJobData): Promise<Job>
  async getQueueStatus(queueName: string): Promise<QueueStatus>
}
```

#### Queue Types:
- **Notifications**: Kullanıcı bildirimleri
- **Analytics**: Kullanıcı davranış analizi
- **Email**: E-posta gönderimi
- **File Processing**: Medya dosya işleme

### File Storage

#### S3/MinIO Service
```typescript
// src/infrastructure/s3/s3.service.ts
export class S3Service {
  async generatePresignedUrl(fileName: string, fileType: string): Promise<string>
  async uploadFile(file: Buffer, key: string): Promise<void>
  async deleteFile(key: string): Promise<void>
  async getFileUrl(key: string): Promise<string>
}
```

---

## 🔐 Güvenlik ve Authentication

### JWT Authentication

#### Token Management
```typescript
// src/infrastructure/auth/jwt.helper.ts
export function signJwt(payload: any): string
export function verifyJwt(token: string): any
export function generateRefreshToken(userId: number): string
```

#### Auth Middleware
```typescript
// src/interfaces/auth/auth.middleware.ts
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await authService.validateToken(token);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  req.user = user;
  next();
}
```

### Security Headers

```typescript
// Helmet.js ile güvenlik başlıkları
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

### Password Security

```typescript
// bcryptjs ile şifre hashleme
const passwordHash = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, hashedPassword);
```

---

## ⚡ Real-time Özellikler

### Socket.IO Implementation

#### Socket Manager
```typescript
// src/infrastructure/realtime/socket-manager.ts
export class SocketManager {
  initialize(io: Server): void {
    io.on('connection', (socket) => {
      // Connection handling
      socket.on('join_room', (roomId) => this.handleJoinRoom(socket, roomId));
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }
}
```

#### Real-time Features:
- **Direct Messaging**: Kullanıcılar arası anlık mesajlaşma
- **Live Notifications**: Rozet, başarı bildirimleri
- **Content Updates**: Post beğeni, yorum bildirimleri
- **Presence System**: Kullanıcı online/offline durumu

### Redis Adapter

```typescript
// Socket.IO Redis adapter ile horizontal scaling
io.adapter(createAdapter(redisConfig.pubClient, redisConfig.subClient));
```

---

## 📊 Queue ve Background Jobs

### Job Types

#### Notification Jobs
```typescript
interface NotificationJobData {
  type: 'NEW_BADGE' | 'ACHIEVEMENT_UNLOCKED' | 'TIP_RECEIVED';
  userId: number;
  [key: string]: any;
}
```

#### Analytics Jobs
```typescript
interface AnalyticsJobData {
  event: 'POST_CREATED' | 'USER_LOGIN' | 'WALLET_CONNECTED';
  userId?: number;
  data: any;
}
```

### Job Processing

```typescript
// Job options
const jobOptions = {
  removeOnComplete: 100,    // Tamamlanan işleri 100 adet tut
  removeOnFail: 50,         // Başarısız işleri 50 adet tut
  attempts: 3,               // 3 kez dene
  backoff: {
    type: 'exponential',
    delay: 2000              // 2 saniye ile başla
  }
};
```

---

## 📝 Logging ve Monitoring

### Winston Logger Configuration

```typescript
// src/infrastructure/logger/logger.ts
const logger = createLogger({
  level: env === 'development' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: 'logs/%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'logs/%DATE%-error.log',
      level: 'error',
      maxFiles: '30d'
    })
  ]
});
```

### Request Logging

```typescript
// Morgan ile HTTP request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));
```

### Error Handling

```typescript
// Global error handler
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

---

## 🚀 Development Workflow

### Code Quality Tools

#### ESLint Configuration
```javascript
// eslint.config.mjs
export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended
]);
```

#### Prettier Integration
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80
}
```

#### Git Hooks (Husky)
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### Development Scripts

```json
{
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/interfaces/server.js",
    "start:prod": "NODE_ENV=production node dist/interfaces/server.js",
    "worker": "ts-node src/infrastructure/workers/index.ts",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

### Docker Development Environment

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: tipbox_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ['5432:5432']
    
  redis:
    image: redis:latest
    ports: ['6379:6379']
    
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ['9000:9000', '9001:9001']
```

---

## 🚀 Deployment ve DevOps

### Environment Configuration

#### Environment Files
```bash
# .env.development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tipbox_dev
REDIS_URL=redis://localhost:6379
NODE_ENV=development

# .env.production  
DATABASE_URL=postgresql://user:pass@rds.amazonaws.com:5432/tipbox_prod
REDIS_URL=redis://redis-cluster.amazonaws.com:6379
NODE_ENV=production
```

#### AWS Services Integration
- **RDS PostgreSQL**: Production database
- **ElastiCache Redis**: Caching layer
- **S3**: File storage
- **Elastic Beanstalk**: Application hosting

### Build and Deployment

```bash
# Production build
npm run build

# Start production server
npm run start:prod

# Background worker
npm run worker
```

---

## 🎯 Best Practices

### Code Organization

#### 1. Domain-Driven Design
- **Entities**: Business logic içeren domain objects
- **Value Objects**: Immutable data structures
- **Services**: Complex business operations
- **Repositories**: Data access abstraction

#### 2. Clean Architecture
- **Dependency Inversion**: High-level modules don't depend on low-level modules
- **Interface Segregation**: Small, focused interfaces
- **Single Responsibility**: Each class has one reason to change

#### 3. TypeScript Best Practices
- **Strict Type Checking**: `strict: true` in tsconfig
- **Interface Definitions**: Clear contracts between layers
- **Generic Types**: Reusable type definitions
- **Enum Usage**: Type-safe constants

### Error Handling

#### 1. Custom Error Classes
```typescript
export class EmailAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Email ${email} already exists`);
    this.name = 'EmailAlreadyExistsError';
  }
}
```

#### 2. Async Error Handling
```typescript
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

#### 3. Global Error Handling
```typescript
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
```

### Performance Optimization

#### 1. Database Optimization
- **Indexing**: Proper database indexes
- **Query Optimization**: Efficient Prisma queries
- **Connection Pooling**: Database connection management
- **Caching**: Redis for frequently accessed data

#### 2. Memory Management
- **Connection Cleanup**: Proper resource disposal
- **Queue Management**: Job queue optimization
- **Cache TTL**: Appropriate cache expiration

#### 3. Monitoring
- **Logging**: Comprehensive application logging
- **Metrics**: Performance monitoring
- **Health Checks**: Service health monitoring

---

## 📚 Sonuç

**Tipbox Backend**, modern web development best practices'lerini kullanarak geliştirilmiş, ölçeklenebilir ve maintainable bir backend servisidir. 

### Güçlü Yönler:
- ✅ **Clean Architecture** ile organize edilmiş kod yapısı
- ✅ **Domain-Driven Design** ile business logic odaklı geliştirme
- ✅ **TypeScript** ile type-safe development
- ✅ **Prisma ORM** ile güvenli database operations
- ✅ **Redis** ile performant caching
- ✅ **Socket.IO** ile real-time features
- ✅ **BullMQ** ile background job processing
- ✅ **Comprehensive logging** ile monitoring
- ✅ **Docker** ile development environment
- ✅ **Swagger** ile API documentation

### Geliştirme Önerileri:
- 🔄 **Unit Testing** eklenmesi (Jest)
- 🔄 **Integration Testing** implementasyonu
- 🔄 **API Rate Limiting** eklenmesi
- 🔄 **Database Migration** stratejisi
- 🔄 **Monitoring Dashboard** (Grafana)
- 🔄 **CI/CD Pipeline** kurulumu

---

*Son güncelleme: 2025-01-30*
*Versiyon: 1.0.0*
