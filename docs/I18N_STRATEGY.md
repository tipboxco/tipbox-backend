# i18n (Internationalization) Backend Strategy

## Problem Statement

Mobile app'te i18n JSON dil paketleri kullanılıyor. Hedefler:

1. App açılışta dil paketini backend'den **1 kez** alacak ve cache'leyecek
2. Backend'de değişiklik **yoksa** app request atmayacak
3. Admin panel'den çeviriler CRUD ile yönetilecek
4. Yeni key eklendiğinde, value güncellendiğinde sorunsuz çalışacak

---

## Büyük Şirketlerin Kullandığı Stratejiler

### 1. Content Hash + HTTP Conditional Requests (Önerilen)

**Kullanan:** Netflix, Spotify, Airbnb

Bu strateji iki mekanizmayı birleştirir:

#### a) Content Hash (ETag)

Backend, her dil paketi JSON'ının SHA-256 hash'ini hesaplar. Bu hash **ETag** header'ı olarak döner.

```
GET /api/i18n/tr
Response Headers:
  ETag: "a1b2c3d4e5f6..."
  Cache-Control: private, max-age=86400
```

#### b) Conditional Request (If-None-Match)

App sonraki isteklerde son bildiği ETag'i gönderir:

```
GET /api/i18n/tr
Request Headers:
  If-None-Match: "a1b2c3d4e5f6..."

→ Değişiklik yoksa: 304 Not Modified (boş body, sıfır bandwidth)
→ Değişiklik varsa:  200 OK + yeni JSON + yeni ETag
```

**Avantaj:** HTTP standardı, her HTTP client destekler. Body boş döndüğü için bandwidth tasarrufu.

---

### 2. Version Number Strategy

**Kullanan:** Slack, Discord, Telegram

Her dil paketinin bir `version` numarası var. Admin panel'den herhangi bir değişiklik yapılınca version artar.

```
GET /api/i18n/version?locale=tr
Response: { "locale": "tr", "version": 42 }
```

App açılışta sadece version kontrolü yapar (çok hafif request). Eğer local version farklıysa full bundle'ı çeker:

```
GET /api/i18n/bundle?locale=tr&currentVersion=41
→ Version farklıysa: 200 + full bundle + newVersion: 42
→ Version aynıysa:   304 Not Modified
```

**Avantaj:** Version check endpoint'i çok hafif (~50 byte response). Hash hesaplama yükü yok.

---

### 3. Delta (Incremental) Updates

**Kullanan:** Google (Play Store), Facebook, Microsoft

Sadece **değişen key'leri** gönderir, full bundle yerine diff/patch:

```
GET /api/i18n/delta?locale=tr&since=1710000000
Response: {
  "updated": { "home.title": "Ana Sayfa", "profile.bio": "Biyografi" },
  "deleted": ["old.removed.key"],
  "version": 43,
  "timestamp": 1710500000
}
```

**Avantaj:** Binlerce key olduğunda sadece 2-3 değişen key transfer edilir.
**Dezavantaj:** Complexity yüksek, client-side merge logic gerekir. İlk seferde yine full bundle lazım.

---

### 4. CDN + Static File Strategy

**Kullanan:** AWS, Cloudflare, büyük e-commerce siteleri

Admin panel değişiklik yapınca → JSON dosyası generate edilir → CDN'e push edilir → App CDN'den çeker.

```
https://cdn.tipbox.com/i18n/tr/v42.json
https://cdn.tipbox.com/i18n/en/v42.json
```

**Avantaj:** Backend'e hiç yük binmez, CDN edge'den serve edilir, ultra hızlı.
**Dezavantaj:** CDN invalidation gecikmesi, daha fazla infra gereksinimi.

---

## Önerilen Hibrit Mimari (Tipbox İçin)

Tipbox ölçeğinde **Strategy 1 + 2 kombinasyonu** en uygun:

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Mobile App │────▶│   Backend API    │────▶│  PostgreSQL  │
│             │     │                  │     │  (i18n tablo)│
│  Local      │     │  Redis Cache     │     └──────────────┘
│  Storage    │     │  (hash + bundle) │
└─────────────┘     └──────────────────┘
                           ▲
                    ┌──────┴───────┐
                    │ Admin Panel  │
                    │ (CRUD i18n)  │
                    └──────────────┘
```

### Flow

```
1. App açılır → Local storage'da bundle var mı?
   ├─ Yoksa  → GET /api/i18n/bundle?locale=tr → 200 + full bundle + version
   └─ Varsa  → GET /api/i18n/bundle?locale=tr (If-None-Match: "hash...")
                ├─ 304 → Local bundle kullan (0 bandwidth)
                └─ 200 → Yeni bundle'ı kaydet

2. Admin panel'den key eklenir/güncellenir/silinir
   → DB güncellenir
   → Redis cache invalidate edilir
   → Sonraki app request'i yeni bundle alır
```

---

## Database Tasarımı

### Tablo Yapısı

```sql
-- Desteklenen diller
CREATE TABLE i18n_locale (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(10) NOT NULL UNIQUE,   -- "tr", "en", "de"
  name        VARCHAR(100) NOT NULL,          -- "Türkçe", "English"
  is_default  BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Çeviri key'leri (namespace ile gruplu)
CREATE TABLE i18n_translation (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale_code VARCHAR(10) NOT NULL REFERENCES i18n_locale(code),
  namespace   VARCHAR(100) NOT NULL DEFAULT 'common',  -- "common", "home", "profile", "auth"
  key         VARCHAR(500) NOT NULL,                    -- "home.title", "auth.login_button"
  value       TEXT NOT NULL,                             -- "Giriş Yap"
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE(locale_code, namespace, key)
);

-- Bundle versiyonları (her locale için)
CREATE TABLE i18n_bundle_version (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale_code VARCHAR(10) NOT NULL REFERENCES i18n_locale(code) UNIQUE,
  version     INTEGER NOT NULL DEFAULT 1,
  hash        VARCHAR(64) NOT NULL,            -- SHA-256 of compiled JSON
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Index'ler
CREATE INDEX idx_i18n_translation_locale ON i18n_translation(locale_code);
CREATE INDEX idx_i18n_translation_namespace ON i18n_translation(locale_code, namespace);
CREATE INDEX idx_i18n_translation_updated ON i18n_translation(updated_at);
```

### Prisma Schema

```prisma
model I18nLocale {
  id        String   @id @default(uuid())
  code      String   @unique @db.VarChar(10)       // "tr", "en"
  name      String   @db.VarChar(100)               // "Türkçe"
  isDefault Boolean  @default(false) @map("is_default")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  translations  I18nTranslation[]
  bundleVersion I18nBundleVersion?

  @@map("i18n_locale")
}

model I18nTranslation {
  id         String   @id @default(uuid())
  localeCode String   @map("locale_code") @db.VarChar(10)
  namespace  String   @default("common") @db.VarChar(100)
  key        String   @db.VarChar(500)
  value      String   @db.Text
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  locale I18nLocale @relation(fields: [localeCode], references: [code])

  @@unique([localeCode, namespace, key])
  @@index([localeCode])
  @@index([localeCode, namespace])
  @@index([updatedAt])
  @@map("i18n_translation")
}

model I18nBundleVersion {
  id         String   @id @default(uuid())
  localeCode String   @unique @map("locale_code") @db.VarChar(10)
  version    Int      @default(1)
  hash       String   @db.VarChar(64)
  updatedAt  DateTime @updatedAt @map("updated_at")

  locale I18nLocale @relation(fields: [localeCode], references: [code])

  @@map("i18n_bundle_version")
}
```

---

## API Endpoints

### Public (App)

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/i18n/locales` | Desteklenen dillerin listesi |
| `GET` | `/api/i18n/bundle/:locale` | Dil paketini al (ETag destekli) |

### Admin

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/admin/i18n/locales` | Tüm diller (aktif/pasif) |
| `POST` | `/api/admin/i18n/locales` | Yeni dil ekle |
| `PATCH` | `/api/admin/i18n/locales/:code` | Dil güncelle (aktif/pasif) |
| `DELETE` | `/api/admin/i18n/locales/:code` | Dil sil |
| `GET` | `/api/admin/i18n/translations` | Çevirileri listele (filtreli) |
| `POST` | `/api/admin/i18n/translations` | Tekil çeviri ekle |
| `POST` | `/api/admin/i18n/translations/bulk` | Toplu çeviri ekle/güncelle |
| `PATCH` | `/api/admin/i18n/translations/:id` | Çeviri güncelle |
| `DELETE` | `/api/admin/i18n/translations/:id` | Çeviri sil |
| `POST` | `/api/admin/i18n/import` | JSON dosyasından import |
| `GET` | `/api/admin/i18n/export/:locale` | JSON olarak export |
| `GET` | `/api/admin/i18n/missing/:locale` | Eksik çevirileri bul |

---

## Bundle Compile & Cache Logic

### Bundle Derleme

Admin bir değişiklik yaptığında:

```typescript
async function compileBundleForLocale(localeCode: string): Promise<CompiledBundle> {
  // 1. DB'den tüm translation'ları çek
  const translations = await prisma.i18nTranslation.findMany({
    where: { localeCode },
    orderBy: { key: 'asc' },
  });

  // 2. Nested JSON oluştur: "home.title" → { home: { title: "..." } }
  const bundle: Record<string, unknown> = {};
  for (const t of translations) {
    setNestedValue(bundle, `${t.namespace}.${t.key}`, t.value);
  }

  // 3. Hash hesapla (deterministic JSON stringify)
  const jsonStr = JSON.stringify(bundle, null, 0); // compact
  const hash = crypto.createHash('sha256').update(jsonStr).digest('hex');

  // 4. Version'ı güncelle
  await prisma.i18nBundleVersion.upsert({
    where: { localeCode },
    update: { version: { increment: 1 }, hash },
    create: { localeCode, version: 1, hash },
  });

  // 5. Redis'e cache'le
  await cache.set(`i18n:bundle:${localeCode}`, jsonStr, CACHE_TTL.LONG);
  await cache.set(`i18n:hash:${localeCode}`, hash, CACHE_TTL.LONG);

  return { bundle, hash };
}
```

### Bundle Serve (ETag ile)

```typescript
// GET /api/i18n/bundle/:locale
router.get('/i18n/bundle/:locale', asyncHandler(async (req, res) => {
  const { locale } = req.params;
  const clientETag = req.headers['if-none-match'];

  // 1. Hash'i kontrol et (Redis'ten, çok hızlı)
  let currentHash = await cache.get(`i18n:hash:${locale}`);

  if (!currentHash) {
    // Cache miss → DB'den al veya compile et
    const bundleVersion = await prisma.i18nBundleVersion.findUnique({
      where: { localeCode: locale },
    });
    currentHash = bundleVersion?.hash ?? null;
  }

  // 2. ETag match → 304 Not Modified
  if (clientETag && clientETag === `"${currentHash}"`) {
    return res.status(304).end();
  }

  // 3. Bundle'ı getir (Redis cache → DB fallback)
  let bundleJson = await cache.get(`i18n:bundle:${locale}`);
  if (!bundleJson) {
    const compiled = await compileBundleForLocale(locale);
    bundleJson = JSON.stringify(compiled.bundle);
    currentHash = compiled.hash;
  }

  // 4. Response
  res.setHeader('ETag', `"${currentHash}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600'); // 1 saat client cache
  return res.status(200).json({
    success: true,
    data: JSON.parse(bundleJson),
    meta: { locale, hash: currentHash },
  });
}));
```

---

## Cache Invalidation Strategy

```
Admin değişiklik yapar
        │
        ▼
  DB güncellenir
        │
        ▼
  compileBundleForLocale(locale) çalışır
        │
        ├─▶ Yeni hash hesaplanır
        ├─▶ i18n_bundle_version tablosu güncellenir (version++)
        ├─▶ Redis: i18n:bundle:{locale} güncellenir
        └─▶ Redis: i18n:hash:{locale} güncellenir
              │
              ▼
  Sonraki app request'i farklı ETag görür → 200 + yeni bundle
```

**Önemli:** Cache invalidation her zaman **write path**'te yapılır (admin güncelleme anında). Read path'te asla invalidation olmaz.

---

## Mobile App Tarafı (Client Strategy)

### React Native / Expo Tarafında

```typescript
// i18nService.ts
class I18nService {
  private static STORAGE_KEY_BUNDLE = 'i18n_bundle';
  private static STORAGE_KEY_ETAG = 'i18n_etag';

  async loadBundle(locale: string): Promise<I18nBundle> {
    // 1. Local storage'dan mevcut bundle ve etag'i al
    const [cachedBundle, cachedETag] = await Promise.all([
      AsyncStorage.getItem(`${I18nService.STORAGE_KEY_BUNDLE}_${locale}`),
      AsyncStorage.getItem(`${I18nService.STORAGE_KEY_ETAG}_${locale}`),
    ]);

    try {
      // 2. Conditional request
      const headers: Record<string, string> = {};
      if (cachedETag) {
        headers['If-None-Match'] = cachedETag;
      }

      const response = await fetch(`${API_URL}/api/i18n/bundle/${locale}`, { headers });

      // 3. 304 → değişiklik yok, local bundle kullan
      if (response.status === 304 && cachedBundle) {
        return JSON.parse(cachedBundle);
      }

      // 4. 200 → yeni bundle geldi
      if (response.ok) {
        const { data } = await response.json();
        const newETag = response.headers.get('ETag');

        // Local storage'a kaydet
        await Promise.all([
          AsyncStorage.setItem(`${I18nService.STORAGE_KEY_BUNDLE}_${locale}`, JSON.stringify(data)),
          newETag ? AsyncStorage.setItem(`${I18nService.STORAGE_KEY_ETAG}_${locale}`, newETag) : null,
        ]);

        return data;
      }
    } catch (error) {
      // Network hatası → offline, local bundle kullan
      if (cachedBundle) {
        return JSON.parse(cachedBundle);
      }
    }

    // Fallback: embedded default bundle (app binary içinde)
    return require('./defaults/tr.json');
  }
}
```

### Önemli: Fallback Bundle

App binary'sine **varsayılan bir bundle** gömülmeli. Böylece:
- İlk açılışta internet yoksa → embedded bundle kullanılır
- Backend erişilemezse → son cached veya embedded bundle kullanılır

---

## Admin Panel CRUD

### Translation Listesi Sayfası

```
┌─────────────────────────────────────────────────────────────┐
│  i18n Yönetimi                                    [+ Ekle]  │
├──────────┬──────────────┬────────────────┬─────────────────┤
│ Locale ▼ │ Namespace ▼  │ Filtre: [____] │ [JSON Import]   │
├──────────┴──────────────┴────────────────┴─────────────────┤
│                                                             │
│  Key                    │ TR              │ EN              │
│  ─────────────────────  │ ──────────────  │ ──────────────  │
│  common.save            │ Kaydet          │ Save            │
│  common.cancel          │ İptal           │ Cancel          │
│  home.title             │ Ana Sayfa       │ Home            │
│  home.welcome           │ Hoş geldin      │ Welcome         │
│  auth.login             │ Giriş Yap       │ Log In          │
│  auth.register          │ Kayıt Ol        │ Sign Up         │
│  profile.bio            │ ⚠️ EKSİK        │ Biography       │
│                                                             │
│  Sayfa: [< 1 2 3 ... >]                                    │
└─────────────────────────────────────────────────────────────┘
```

### JSON Import Özelliği

Admin, mevcut i18n JSON dosyasını yükleyebilir:

```typescript
// POST /api/admin/i18n/import
// Body: { locale: "tr", namespace: "common", data: { "save": "Kaydet", "cancel": "İptal" } }

async function importTranslations(
  localeCode: string,
  namespace: string,
  data: Record<string, string>, // flat key-value pairs
): Promise<ImportResult> {
  const entries = flattenObject(data); // nested → flat keys

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(entries)) {
      await tx.i18nTranslation.upsert({
        where: {
          localeCode_namespace_key: { localeCode, namespace, key },
        },
        update: { value },
        create: { localeCode, namespace, key, value },
      });
    }
  });

  // Bundle'ı yeniden derle
  await compileBundleForLocale(localeCode);

  return { imported: Object.keys(entries).length };
}
```

### Eksik Çeviri Bulma

```typescript
// GET /api/admin/i18n/missing/:locale
// Default dildeki key'lerden, hedef dilde olmayanları bul

async function findMissingTranslations(targetLocale: string): Promise<string[]> {
  const defaultLocale = await prisma.i18nLocale.findFirst({
    where: { isDefault: true },
  });

  const defaultKeys = await prisma.i18nTranslation.findMany({
    where: { localeCode: defaultLocale.code },
    select: { namespace: true, key: true },
  });

  const targetKeys = await prisma.i18nTranslation.findMany({
    where: { localeCode: targetLocale },
    select: { namespace: true, key: true },
  });

  const targetKeySet = new Set(targetKeys.map(k => `${k.namespace}:${k.key}`));

  return defaultKeys
    .filter(k => !targetKeySet.has(`${k.namespace}:${k.key}`))
    .map(k => `${k.namespace}.${k.key}`);
}
```

---

## Namespace Stratejisi

Bundle'ı namespace'lere böl. Bu sayede:
- Admin panel'de filtreleme kolay
- İleride lazy loading yapılabilir (sadece gerekli namespace'i çek)

```
common      → Ortak: "save", "cancel", "loading", "error"
auth        → Giriş/kayıt: "login", "register", "forgot_password"
home        → Ana sayfa: "title", "welcome", "feed"
profile     → Profil: "bio", "followers", "settings"
post        → İçerik: "create", "edit", "delete", "share"
event       → Etkinlik: "join", "leave", "upcoming"
gamification→ Oyunlaştırma: "badge_earned", "level_up", "streak"
messaging   → Mesajlaşma: "new_message", "typing", "read"
notification→ Bildirimler: "push_title", "push_body"
error       → Hata mesajları: "network", "not_found", "server_error"
```

---

## Pluralization & Interpolation

### Interpolation (Değişken enjeksiyonu)

```json
{
  "welcome": "Merhaba {{username}}, tekrar hoş geldin!",
  "followers_count": "{{count}} takipçin var"
}
```

### Pluralization

Birden fazla form için key suffix pattern:

```json
{
  "notifications_zero": "Bildirim yok",
  "notifications_one": "{{count}} bildirim",
  "notifications_other": "{{count}} bildirim"
}
```

Bu mantık **client tarafında** çözülür (i18next, react-intl gibi kütüphaneler). Backend sadece raw string'leri saklar.

---

## Performans Optimizasyonları

### 1. Redis Cache

```
i18n:bundle:{locale}  → Compiled JSON string (TTL: 24h)
i18n:hash:{locale}    → SHA-256 hash (TTL: 24h)
```

Cache hit oranı çok yüksek olacak çünkü çeviriler nadiren değişir.

### 2. Gzip/Brotli Compression

Express'te compression middleware zaten aktifse, JSON response otomatik sıkıştırılır. Tipik bir i18n bundle:

```
Raw JSON:    ~50KB (1000 key)
Gzip:        ~8KB
Brotli:      ~6KB
```

### 3. Lazy Namespace Loading (İleri Seviye - Opsiyonel)

Eğer bundle çok büyürse, namespace bazında ayrı endpoint:

```
GET /api/i18n/bundle/tr?namespaces=common,home
```

Böylece app sadece o anki ekran için gerekli namespace'leri çeker.

---

## Güvenlik

- Bundle endpoint'i **public** olabilir (auth gerektirmez), çeviriler hassas veri değil
- Admin endpoint'leri **authMiddleware + requireAdmin** ile korunmalı
- Import endpoint'inde JSON boyut limiti (max 1MB)
- Key validation: sadece `a-z`, `0-9`, `.`, `_` karakterleri

---

## Migration Planı (Mevcut JSON → DB)

1. Mevcut app'teki JSON dosyalarını al
2. `POST /api/admin/i18n/import` ile DB'ye yükle
3. App'i yeni endpoint'i kullanacak şekilde güncelle
4. İlk açılışta full bundle çekilir → local storage'a kaydedilir
5. Sonraki açılışlarda ETag ile conditional request

---

## Özet: Karar Matrisi

| Kriter | ETag + Version (Önerilen) | Delta Updates | CDN Static |
|--------|--------------------------|---------------|------------|
| Complexity | Düşük | Yüksek | Orta |
| Bandwidth | İyi (304 = 0 byte) | En iyi | İyi |
| Admin CRUD | Kolay | Kolay | Zor (rebuild) |
| Real-time | Anında | Anında | CDN gecikme |
| Offline | Embedded fallback | Embedded fallback | Embedded fallback |
| Ölçek | 100K+ user | 1M+ user | 10M+ user |
| Tipbox için | ✅ En uygun | Overkill | Erken aşama için fazla |

---

## Sonraki Adımlar

1. Prisma schema'ya i18n modellerini ekle
2. `i18n.service.ts` → compile, cache, serve logic
3. `i18n.router.ts` → public bundle endpoint
4. `admin/i18n.router.ts` → admin CRUD endpoints
5. Mevcut JSON dosyalarını import et
6. App tarafında `I18nService` entegrasyonu
7. Admin panel'de i18n yönetim sayfası
