# 🧪 Test Dokümantasyonu

## 📋 Dosyanın Amacı

Bu dokümantasyon, Tipbox Backend projesindeki E2E test komutlarını, test sonrası otomatik açılan rapor URL'lerini ve yeni endpoint/router ekleme süreçlerini açıklar.

---

## 🎯 Test Kategorileri

| Kategori | Test Dosyası | Config Dosyası | Rapor Dosyası |
|----------|--------------|----------------|---------------|
| **Auth** | `tests/e2e/auth.test.ts` | `tests/jest-config/jest.config.auth.ts` | `auth-report.html` |
| **User** | `tests/e2e/user.test.ts` | `tests/jest-config/jest.config.user.ts` | `user-report.html` |
| **User Settings** | `tests/e2e/user-settings.test.ts` | `tests/jest-config/jest.config.user-settings.ts` | `user-settings-report.html` |
| **Expert** | `tests/e2e/expert.test.ts` | `tests/jest-config/jest.config.expert.ts` | `expert-report.html` |
| **Feed** | `tests/e2e/feed.test.ts` | `tests/jest-config/jest.config.feed.ts` | `feed-report.html` |
| **Explore** | `tests/e2e/explore.test.ts` | `tests/jest-config/jest.config.explore.ts` | `explore-report.html` |
| **Inventory** | `tests/e2e/inventory.test.ts` | `tests/jest-config/jest.config.inventory.ts` | `inventory-report.html` |
| **Marketplace** | `tests/e2e/marketplace.test.ts` | `tests/jest-config/jest.config.marketplace.ts` | `marketplace-report.html` |

---

## 🚀 Test Komutları

### Tüm Testleri Çalıştırma

```bash
npm run test:all
```

**Otomatik Açılan URL:**
- `http://localhost:8080/detailed-test-report.html` (Navigation bar ile tüm kategoriler)

---

### İzole Testler (Kategori Bazlı)

#### Auth Testleri
```bash
npm run test:auth
```
- **URL:** `http://localhost:8080/auth-report.html`

#### User Testleri
```bash
npm run test:user
```
- **URL:** `http://localhost:8080/user-report.html`

#### User Settings Testleri
```bash
npm run test:user-settings
```
- **URL:** `http://localhost:8080/user-settings-report.html`

#### Expert Testleri
```bash
npm run test:expert
```
- **URL:** `http://localhost:8080/expert-report.html`

#### Feed Testleri
```bash
npm run test:feed
```
- **URL:** `http://localhost:8080/feed-report.html`

#### Explore Testleri
```bash
npm run test:explore
```
- **URL:** `http://localhost:8080/explore-report.html`

#### Inventory Testleri
```bash
npm run test:inventory
```
- **URL:** `http://localhost:8080/inventory-report.html`

#### Marketplace Testleri
```bash
npm run test:marketplace
```
- **URL:** `http://localhost:8080/marketplace-report.html`

---

## 📁 Test Raporları ve Dosya Yönetimi

### Test Raporları Klasörü

**Klasör:** `test-results/`

**Önemli Notlar:**
- `test-results/` klasörü silinebilir - testler tekrar çalıştırıldığında otomatik olarak yeniden oluşturulur
- Testler her çalıştırıldığında eski rapor dosyaları üzerine yazılır (güncel veriler kaydedilir)
- Her HTML raporunda test tarihi sağ üstte görüntülenir

**Rapor Dosyaları:**
- `detailed-test-report.html` - Tüm testler (Navigation bar ile)
- `auth-report.html` - Auth testleri
- `user-report.html` - User testleri
- `user-settings-report.html` - User Settings testleri
- `expert-report.html` - Expert testleri
- `feed-report.html` - Feed testleri
- `explore-report.html` - Explore testleri
- `inventory-report.html` - Inventory testleri
- `marketplace-report.html` - Marketplace testleri

### Ekran Görüntüleri

**Klasör:** `screenshots/`

- Eski testlere ait ekran görüntüleri bu klasörde saklanır
- Test çalıştırma sırasında oluşturulan screenshot'lar bu klasörde tutulur

---

## ➕ Yeni Endpoint Ekleme

### Endpoint Hangi Kategoriye Ait?

| Router Dosyası | Test Dosyası | Komut |
|----------------|--------------|-------|
| `src/interfaces/auth/auth.router.ts` | `tests/e2e/auth.test.ts` | `npm run test:auth` |
| `src/interfaces/user/user.router.ts` | `tests/e2e/user.test.ts` | `npm run test:user` |
| `src/interfaces/user/user.router.ts` (settings) | `tests/e2e/user-settings.test.ts` | `npm run test:user-settings` |
| `src/interfaces/expert/expert.router.ts` | `tests/e2e/expert.test.ts` | `npm run test:expert` |
| `src/interfaces/feed/feed.router.ts` | `tests/e2e/feed.test.ts` | `npm run test:feed` |
| `src/interfaces/explore/explore.router.ts` | `tests/e2e/explore.test.ts` | `npm run test:explore` |
| `src/interfaces/inventory/inventory.router.ts` | `tests/e2e/inventory.test.ts` | `npm run test:inventory` |
| `src/interfaces/marketplace/marketplace.router.ts` | `tests/e2e/marketplace.test.ts` | `npm run test:marketplace` |

### Adımlar

1. **Endpoint'i Router'a Ekle**
   - İlgili router dosyasına endpoint'i ekleyin
   - Swagger dokümantasyonu ekleyin (`@openapi` JSDoc)

2. **Test Dosyasına Test Ekle**
   - Yukarıdaki tabloya göre ilgili test dosyasını bulun
   - Test dosyasına yeni test ekleyin

3. **Test Et**
   ```bash
   # İzole test
   npm run test:[kategori]
   
   # Tüm testler
   npm run test:all
   ```

**Örnek:**
- Yeni bir User endpoint'i eklediyseniz → `tests/e2e/user.test.ts` dosyasına test ekleyin
- Yeni bir Feed endpoint'i eklediyseniz → `tests/e2e/feed.test.ts` dosyasına test ekleyin

---

## 🆕 Yeni Router/Kategori Ekleme

### Adım 1: Router Oluştur

```typescript
// src/interfaces/notifications/notifications.router.ts
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: Kullanıcının bildirimlerini getir
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bildirim listesi
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    // ... endpoint logic
  })
);

export default router;
```

### Adım 2: App.ts'e Router'ı Ekle

```typescript
// src/interfaces/app.ts
import notificationsRouter from './notifications/notifications.router';

app.use('/notifications', notificationsRouter);
```

### Adım 3: Test Dosyası Oluştur

```typescript
// tests/e2e/notifications.test.ts
import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Notifications API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Auth setup
    const email = 'omer@tipbox.co';
    const password = 'password123';
    let loginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email, password });
    
    if (!(loginRes.status === 200 && loginRes.body.token)) {
      const uniqueEmail = `e2e_${Date.now()}@tipbox.co`;
      const registerRes = await request(BASE_URL)
        .post('/auth/register')
        .send({ email: uniqueEmail, password, name: 'E2E User' });
      
      if (registerRes.status !== 201 && !registerRes.body.token) {
        throw new Error('Failed to register test user');
      }
      
      loginRes = await request(BASE_URL)
        .post('/auth/login')
        .send({ email: uniqueEmail, password });
    }
    
    authToken = loginRes.body.token;
  });

  describe('GET /notifications', () => {
    it('should return notifications', async () => {
      const res = await request(BASE_URL)
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect([200, 204]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('should return 401 without token', async () => {
      const res = await request(BASE_URL)
        .get('/notifications');
      
      expect(res.status).toBe(401);
    });
  });
});
```

### Adım 4: Jest Config Dosyası Oluştur

```typescript
// tests/jest-config/jest.config.notifications.ts
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: '../..',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/e2e/notifications.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  maxWorkers: 1,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  transform: {
    '^.+\\.(ts)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
        diagnostics: false,
      },
    ],
  },
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'notifications-report.html',
        openReport: false,
        inlineSource: true,
        expand: true,
        pageTitle: 'Tipbox API Notifications Test Results',
      },
    ],
    ['<rootDir>/scripts/custom-jest-reporter.js', {}],
  ],
  testTimeout: 30000,
};

export default config;
```

### Adım 5: Package.json'a Script Ekle

```json
{
  "scripts": {
    "test:notifications": "jest --config tests/jest-config/jest.config.notifications.ts && node scripts/open-test-report.js notifications-report.html"
  }
}
```

### Adım 6: Test Et

```bash
# İzole test
npm run test:notifications

# Tüm testler
npm run test:all
```

**Otomatik Açılan URL:**
- `http://localhost:8080/notifications-report.html`

---

## ✅ Checklist

### Yeni Endpoint Ekleme
- [ ] Endpoint'i ilgili router dosyasına ekle
- [ ] Swagger dokümantasyonu ekle (`@openapi` JSDoc)
- [ ] İlgili test dosyasına test ekle (yukarıdaki tabloya göre)
- [ ] İzole testi çalıştır: `npm run test:[kategori]`
- [ ] Tüm testleri çalıştır: `npm run test:all`

### Yeni Router/Kategori Ekleme
- [ ] Router dosyası oluştur
- [ ] `app.ts`'e router'ı ekle
- [ ] Test dosyası oluştur
- [ ] Jest config dosyası oluştur
- [ ] `package.json`'a script ekle
- [ ] Test et: `npm run test:[kategori]` ve `npm run test:all`
