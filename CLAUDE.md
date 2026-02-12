# Tipbox Backend - Development Guide

## Project Overview

Tipbox is a social platform backend built with **Node.js, Express, and TypeScript**, following **Domain-Driven Design (DDD)** and **Modular Monolith** architecture principles. The platform supports content creation, gamification, events, messaging, payments, and Web3/NFT features.

## Technology Stack

### Core Technologies
- **Runtime:** Node.js >= 23.6.0
- **Language:** TypeScript 5.8.3 (ES2022 target)
- **Framework:** Express.js 4.21
- **Database:** PostgreSQL 15
- **ORM:** Prisma 6.19
- **Cache:** Redis 7
- **Queue:** BullMQ 5.62
- **Real-time:** Socket.IO 4.7 with Redis adapter
- **Object Storage:** MinIO (S3-compatible)

### Key Libraries
- **Validation:** Zod 4.2
- **Authentication:** Auth0, JWT, Google OAuth
- **AI:** Google Gemini API
- **Web3:** thirdweb 5.118
- **Logging:** Winston 3.17 (with daily rotate)
- **Metrics:** Prometheus client
- **Email:** Nodemailer 7.0
- **Security:** Helmet, bcryptjs

### Development Tools
- **ESLint:** Flat config with TypeScript support
- **Prettier:** Code formatting
- **Husky + lint-staged:** Pre-commit hooks
- **Nodemon:** Development auto-reload
- **Docker Compose:** Container orchestration

## Architecture

### Layered Architecture (DDD)

```
src/
├── domain/              # Domain models, enums, entities (business rules)
│   ├── admin/
│   ├── auth/
│   ├── content/
│   ├── crypto/
│   ├── event/
│   ├── gamification/
│   ├── messaging/
│   ├── payment/
│   └── ...
│
├── application/         # Business logic, use cases, services
│   ├── admin/
│   ├── auth/
│   ├── event/
│   ├── gamification/
│   ├── messaging/
│   ├── post/
│   ├── user/
│   └── ...
│
├── infrastructure/      # Technical implementations
│   ├── database/        # Database connections
│   ├── cache/           # Redis cache, cache invalidation
│   ├── repositories/    # Prisma repositories
│   ├── middleware/      # Express middleware
│   ├── logger/          # Winston logger
│   ├── auth/            # Auth0, JWT utilities
│   ├── s3/              # MinIO/S3 service
│   ├── queue/           # BullMQ setup
│   ├── workers/         # Background workers
│   ├── scheduler/       # Scheduled jobs
│   ├── realtime/        # Socket.IO
│   ├── ai/              # Gemini AI service
│   ├── errors/          # Error handling
│   ├── metrics/         # Prometheus metrics
│   ├── health/          # Health checks
│   ├── config/          # Configuration files
│   ├── ids/             # ID resolution utilities
│   └── utils/           # Shared utilities
│
├── interfaces/          # API layer (routers, DTOs, schemas)
│   ├── admin/           # Admin panel endpoints
│   │   ├── admin.router.ts
│   │   ├── admin.schemas.ts
│   │   └── admin.dto.ts
│   ├── auth/
│   ├── event/
│   ├── post/
│   ├── inbox/
│   └── server.ts        # Express server entry point
│
└── types/               # Global TypeScript types
```

### Key Architectural Principles

1. **Separation of Concerns:**
   - **Domain:** Pure business logic (no framework dependencies)
   - **Application:** Orchestrates domain logic, calls repositories
   - **Infrastructure:** Technical implementations (DB, cache, external APIs)
   - **Interfaces:** HTTP/WebSocket API endpoints

2. **Repository Pattern:**
   - All database access goes through Prisma repositories
   - Located in `infrastructure/repositories/`
   - Naming: `*-prisma.repository.ts`

3. **Service Layer:**
   - Business logic in `application/` services
   - Naming: `*.service.ts`
   - Services are instantiated in routers or other services

4. **Error Handling:**
   - Custom error classes in `infrastructure/errors/`
   - `asyncHandler` wrapper for all async routes
   - Structured logging with Winston

## Code Standards

### TypeScript Configuration

```typescript
// tsconfig.json highlights
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "experimentalDecorators": true
  }
}
```

### ESLint Rules

```javascript
// eslint.config.mjs
{
  rules: {
    "@typescript-eslint/no-explicit-any": "error" // any is FORBIDDEN
  }
}
```

**CRITICAL:** Never use `any` type. Use proper types, generics, or `unknown` + type guards.

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Services | `*.service.ts` | `post.service.ts` |
| Routers | `*.router.ts` | `post.router.ts` |
| DTOs | `*.dto.ts` | `post.dto.ts` |
| Schemas (Zod) | `*.schemas.ts` | `admin.schemas.ts` |
| Repositories | `*-prisma.repository.ts` | `content-post-prisma.repository.ts` |
| Enums | `*.enum.ts` | `content-post-type.enum.ts` |
| Middleware | `*.middleware.ts` | `auth.middleware.ts` |
| Interfaces | PascalCase | `CreatePostRequest` |
| Variables | camelCase | `userId`, `postService` |
| Constants | UPPER_SNAKE_CASE | `CACHE_TTL` |

### File Structure Pattern

For each module (e.g., `post`):

```
interfaces/post/
├── post.router.ts      # Express routes
├── post.dto.ts         # Data Transfer Objects
└── post.schemas.ts     # Zod validation schemas

application/post/
└── post.service.ts     # Business logic

infrastructure/repositories/
└── content-post-prisma.repository.ts

domain/content/
├── content-post-type.enum.ts
└── other-enums.ts
```

## Common Patterns

### 1. Creating a New Endpoint

```typescript
// interfaces/post/post.router.ts
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../infrastructure/middleware/validation.middleware';
import { PostService } from '../../application/post/post.service';
import { CreatePostSchema } from './post.schemas';
import { CreatePostRequest } from './post.dto';

const router = Router();
const postService = new PostService();

router.post(
  '/posts',
  authMiddleware,                      // Always use middleware for protected routes
  validateBody(CreatePostSchema),      // Zod validation
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const body = req.body as CreatePostRequest;
    const post = await postService.createPost(userId, body);

    return res.status(201).json({ success: true, data: post });
  })
);

export default router;
```

### 2. Zod Schema Pattern

```typescript
// interfaces/post/post.schemas.ts
import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  categoryId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
```

### 3. Service Pattern

```typescript
// application/post/post.service.ts
import { PostRepository } from '../../infrastructure/repositories/post-prisma.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import logger from '../../infrastructure/logger/logger';

export class PostService {
  private postRepo: PostRepository;
  private cache: CacheService;

  constructor() {
    this.postRepo = new PostRepository();
    this.cache = new CacheService();
  }

  async createPost(userId: string, data: CreatePostInput) {
    logger.info('Creating post', { userId, title: data.title });

    const post = await this.postRepo.create({
      userId,
      ...data,
    });

    // Invalidate cache
    await this.cache.invalidate(`user:${userId}:posts`);

    return post;
  }
}
```

### 4. Prisma Data Handling

**CRITICAL:** When passing data to Prisma, handle `undefined` vs `null` correctly:

```typescript
// ❌ WRONG - causes relation errors
const collection = await prisma.badgeCollection.create({
  data: {
    name: body.name,
    categoryId: body.categoryId ?? undefined, // ERROR!
  },
});

// ✅ CORRECT - use null for optional fields
const collection = await prisma.badgeCollection.create({
  data: {
    name: body.name,
    categoryId: body.categoryId ?? null,
  },
});

// ✅ CORRECT - conditionally spread
const collection = await prisma.badgeCollection.create({
  data: {
    name: body.name,
    ...(body.categoryId && { categoryId: body.categoryId }),
  },
});
```

**Rule:** Optional Prisma fields accept `null` but NOT `undefined`. Use nullish coalescing to `null` or conditional spreading.

### 5. Error Handling

```typescript
import { BadRequestError, NotFoundError } from '../../infrastructure/errors/';
import { getErrorMessage } from '../../infrastructure/errors/error-helper';

// Throw custom errors
if (!post) {
  throw new NotFoundError('Post not found');
}

if (invalidData) {
  throw new BadRequestError('Invalid input data');
}

// Logging errors
try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed', { error: getErrorMessage(error) });
  throw error;
}
```

### 6. Authentication Middleware

```typescript
// All protected routes MUST use authMiddleware
import { authMiddleware } from '../auth/auth.middleware';
import { requireAdmin } from '../auth/role.middleware';

router.post('/admin/users', authMiddleware, requireAdmin, asyncHandler(...));
```

User info is available on `req.user`:
```typescript
const userId = req.user?.id;
const userEmail = req.user?.email;
```

### 7. Caching Pattern

```typescript
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';

const cache = new CacheService();

// Read with cache
const cacheKey = `posts:${postId}`;
const cached = await cache.get(cacheKey);
if (cached) return JSON.parse(cached);

// Write to cache
await cache.set(cacheKey, JSON.stringify(data), CACHE_TTL.MEDIUM);

// Invalidate cache
await cache.invalidate(`posts:${postId}`);
```

### 8. File Uploads (MinIO/S3)

```typescript
import { S3Service } from '../../infrastructure/s3/s3.service';
import multer from 'multer';

const s3Service = new S3Service();

// Multer setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Upload endpoint
router.post('/upload', authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new BadRequestError('No file uploaded');

  const url = await s3Service.uploadFile(file.buffer, 'bucket-name', `path/${file.originalname}`);
  return res.json({ success: true, url });
}));
```

### 9. Socket.IO Events

```typescript
// infrastructure/realtime/services/socket-handler.ts
import { Server, Socket } from 'socket.io';
import logger from '../../logger/logger';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected', { socketId: socket.id });

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      logger.info('User joined room', { socketId: socket.id, roomId });
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id });
    });
  });
}
```

### 10. Background Jobs (BullMQ)

```typescript
// infrastructure/workers/example-worker.ts
import { Worker, Queue } from 'bullmq';
import { redisConnection } from '../queue/redis-connection';
import logger from '../logger/logger';

const queue = new Queue('example-queue', { connection: redisConnection });

const worker = new Worker('example-queue', async (job) => {
  logger.info('Processing job', { jobId: job.id, data: job.data });

  // Process job
  await someAsyncTask(job.data);

  return { success: true };
}, { connection: redisConnection });

// Add job to queue
await queue.add('task-name', { userId: '123', action: 'send-email' });
```

## Database Schema (Prisma)

### Key Models
- **User:** Core user model with Auth0 integration
- **Profile:** User profile information
- **ContentPost:** Posts (tips, questions, experiences, updates)
- **Badge, BadgeCollection:** Gamification system
- **Event, EventReward:** Event system
- **DMThread, DMMessage:** Direct messaging
- **Wallet, TipsTokenTransfer:** Crypto/payment system
- **NFT, NFTTransaction:** Web3/NFT features

### Prisma Best Practices

1. **Always use transactions for multi-table operations:**
   ```typescript
   await prisma.$transaction(async (tx) => {
     const user = await tx.user.create({ data: { ... } });
     await tx.profile.create({ data: { userId: user.id, ... } });
   });
   ```

2. **Use `include` and `select` wisely:**
   ```typescript
   // Good: Only fetch what you need
   const post = await prisma.contentPost.findUnique({
     where: { id },
     select: {
       id: true,
       title: true,
       author: { select: { id: true, profile: { select: { username: true } } } },
     },
   });
   ```

3. **Map snake_case database fields to camelCase:**
   ```prisma
   model BadgeCollection {
     shortDescription String? @map("short_description")
     createdAt        DateTime @default(now()) @map("created_at")
   }
   ```

## Docker & Development

### Container Services
- **backend:** Main Express app (port 3000)
- **postgres:** PostgreSQL database (port 5432)
- **redis:** Cache & queue (port 6379)
- **minio:** Object storage (ports 9000, 9001)
- **prisma-studio:** Database UI (port 5555)
- **admin-panel:** Admin frontend (port 5174)
- **catalog-service:** Product catalog (port 5173)
- **pgadmin:** PostgreSQL UI (port 5050)
- **nginx:** Reverse proxy (ports 80, 443)

### Common Commands

```bash
# Start all services
docker-compose up -d

# Restart backend only
docker-compose restart backend

# View backend logs
docker-compose logs -f backend

# Execute commands in backend container
docker-compose exec backend npx prisma db push
docker-compose exec backend npm run db:seed

# Reset database
docker-compose exec backend npm run db:reset

# Run migrations
docker-compose exec backend npm run db:migrate

# Prisma Studio
docker-compose exec backend npx prisma studio --port 5555
```

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- post.test.ts
```

### Test Utilities
- Scripts for testing messaging: `npm run test:messaging`
- Socket.IO testing: `npm run test:socket-chat`
- Transaction testing: `npm run test:transactions`

## Environment Variables

Key `.env` variables:
```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/tipbox_dev
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key
AUTH0_DOMAIN=your-auth0-domain
AUTH0_AUDIENCE=your-audience

# MinIO (S3)
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123

# AI
GEMINI_API_KEY=your-gemini-key

# Web3
THIRDWEB_SECRET_KEY=your-thirdweb-key
```

## Admin Panel Integration

The admin panel is a separate React application (`admin-panel/`) that interacts with backend admin routes (`/api/admin/*`).

### Admin Routes Pattern

```typescript
// interfaces/admin/admin.router.ts
router.post(
  '/admin/collections',
  authMiddleware,
  requireAdmin,                         // Admin role check
  validateBody(AdminCreateCollectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;

    // Create resource
    const collection = await prisma.badgeCollection.create({ ... });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_CREATE',
        description: `collectionId: ${collection.id}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });

    return res.status(201).json({ success: true, data: collection });
  })
);
```

**Always log admin actions** using `AdminLog` model for audit trail.

## Debugging Tips

1. **Use Winston logger everywhere:**
   ```typescript
   import logger from '../../infrastructure/logger/logger';
   logger.info('User created', { userId: user.id });
   logger.error('Failed to process', { error: getErrorMessage(err) });
   ```

2. **Check Docker logs:**
   ```bash
   docker-compose logs -f backend
   ```

3. **Use Prisma Studio for database inspection:**
   ```bash
   docker-compose exec backend npx prisma studio --port 5555
   # Visit: http://localhost:5555
   ```

4. **Redis CLI for cache debugging:**
   ```bash
   docker-compose exec redis redis-cli
   > KEYS *
   > GET "key-name"
   ```

## Common Gotchas

1. **Prisma undefined vs null:** Optional fields need `null`, not `undefined`
2. **TypeScript any:** Never use `any` - ESLint will fail
3. **Missing middleware:** Always use `authMiddleware` for protected routes
4. **Error handling:** Wrap all async routes with `asyncHandler`
5. **Cache invalidation:** Remember to invalidate cache after mutations
6. **Transactions:** Use `$transaction` for multi-step database operations
7. **File uploads:** Use `multer.memoryStorage()` for S3 uploads (not disk storage)
8. **Socket.IO rooms:** Remember to join rooms before emitting to them

## Git Workflow

- **Main branch:** `main`
- **Development branch:** `developer`
- **Feature branches:** `feat/feature-name`
- **Fix branches:** `fix/bug-name`

**Always create PRs against `developer` branch, not `main`.**

## Additional Resources

- [Setup Guide](docs/SETUP_GUIDE.md)
- Prisma Studio: http://localhost:5555
- Admin Panel: http://localhost:5174
- Backend API: http://localhost:3000
- MinIO Console: http://localhost:9001

---

**Last Updated:** 2026-02-10
