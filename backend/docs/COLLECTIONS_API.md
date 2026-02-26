# Collections API — Frontend Entegrasyon Dökümanı

**Version:** 1.0
**Last Updated:** 2026-02-26
**Status:** Ready for Integration
**Base URL:** `{API_BASE}` (örn. `http://192.168.x.x:3000`)

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Auth](#auth)
- [EP-01 — Collections Listesi](#ep-01--collections-listesi)
- [EP-02 — Chip Filtre Kategorileri](#ep-02--chip-filtre-kategorileri)
- [EP-03 — Collection Detay + Badge Listesi](#ep-03--collection-detay--badge-listesi)
- [TypeScript Tipleri](#typescript-tipleri)
- [React Query Hook'ları](#react-query-hookları)
- [API Fonksiyonları](#api-fonksiyonları)
- [Hata Yanıtları](#hata-yanıtları)
- [Mock'tan Gerçek API'ye Geçiş](#mocktan-gerçek-apiye-geçiş)
- [Notlar & Dikkat Edilecekler](#notlar--dikkat-edilecekler)

---

## Genel Bakış

| # | Endpoint | Method | Açıklama | Durum |
|---|---|---|---|---|
| EP-01 | `/events/collections` | GET | Collections listesi (search + filtre + pagination) | ✅ Hazır |
| EP-02 | `/events/collections/categories` | GET | Chip filtre kategorileri | ✅ Hazır |
| EP-03 | `/events/collections/:id` | GET | Collection detay + badge listesi | ✅ Hazır |

> **Not:** Medusa kategori endpoint'leri (EP-04/05/06 — Ana/Alt/Ürün Grubu kategoriler) zaten `/medusa/store/product-categories` üzerinden çalışıyor. Bu döküman onları kapsamıyor.

---

## Auth

Tüm endpoint'ler **Bearer Token** (JWT) gerektirir.

```typescript
headers: {
  Authorization: `Bearer ${accessToken}`
}
```

Token yoksa `401 Unauthorized` döner.

---

## EP-01 — Collections Listesi

### Request

```
GET /events/collections
```

**Query Parameters:**

| Parametre | Tip | Zorunlu | Default | Açıklama |
|---|---|---|---|---|
| `search` | string | Hayır | — | Title/description'da arama. Frontend 500ms debounce yapmalı |
| `category` | string | Hayır | — | Chip filter handle (ör: `electronics`). Boş veya `all` = tümü |
| `mainCategoryId` | string | Hayır | — | Medusa ana kategori ID (bottom sheet) |
| `subCategoryId` | string | Hayır | — | Medusa alt kategori ID (bottom sheet) |
| `productGroupId` | string | Hayır | — | Medusa ürün grubu ID (bottom sheet, ileride aktif) |
| `cursor` | string | Hayır | — | Bir önceki sayfanın son collection ID'si (infinite scroll) |
| `limit` | number | Hayır | `20` | Sayfa başı item. Max: `50` |

### Response — `200 OK`

```json
{
  "collections": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "title": "Silicon Strategist",
      "description": "Master the hardware landscape.",
      "currentProgress": 12,
      "totalProgress": 120,
      "backgroundGradient": {
        "colors": ["#a855f7", "#9333ea", "#7e22ce"],
        "start": { "x": 0, "y": 0 },
        "end": { "x": 1, "y": 1 }
      },
      "category": "electronics"
    }
  ],
  "pagination": {
    "cursor": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "hasMore": true,
    "limit": 20,
    "total": 42
  }
}
```

**Pagination Mantığı:**
- `cursor`: Sonraki sayfayı çekmek için `cursor` query param'ına gönder
- `hasMore: false` → son sayfaya ulaşıldı, daha fazla fetch etme
- `cursor: null` → son sayfa

**`backgroundGradient` Notu:**
- Admin panelden set edilmemişse backend koleksiyonun ID'sinden deterministik olarak üretir
- Her collection için tutarlı, benzersiz renkler garantilenir
- `expo-linear-gradient` ile doğrudan kullanılabilir:
  ```tsx
  <LinearGradient
    colors={collection.backgroundGradient.colors}
    start={collection.backgroundGradient.start}
    end={collection.backgroundGradient.end}
  />
  ```

---

## EP-02 — Chip Filtre Kategorileri

### Request

```
GET /events/collections/categories
```

Query param yok.

### Response — `200 OK`

```json
{
  "categories": [
    {
      "id": "cat_01",
      "name": "Electronics",
      "handle": "electronics"
    },
    {
      "id": "cat_02",
      "name": "Cosmetics",
      "handle": "cosmetics"
    }
  ]
}
```

**Frontend Notu:**
- `"All"` chip'i backend'den gelmiyor — frontend kendisi eklemeli (handle: `"all"`)
- `handle` değeri EP-01'deki `category` query param'ına birebir gönderilmeli
- Bu liste nadir değişir → **24 saat** client-side cache'lenebilir (`staleTime: 24 * 60 * 60 * 1000`)

---

## EP-03 — Collection Detay + Badge Listesi

### Request

```
GET /events/collections/:collectionId
```

**Path Parameters:**

| Parametre | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `collectionId` | string (UUID) | Evet | Collection ID |

**Query Parameters:**

| Parametre | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `search` | string | Hayır | Badge title/description'da arama. Frontend 400ms debounce yapmalı |

### Response — `200 OK`

```json
{
  "collection": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "title": "Silicon Strategist",
    "description": "Completing this collection proves your deep understanding of the digital backbone. You've demonstrated that you know exactly what drives modern productivity.",
    "currentProgress": 12,
    "totalProgress": 120,
    "backgroundGradient": {
      "colors": ["#a855f7", "#9333ea", "#7e22ce"],
      "start": { "x": 0, "y": 0 },
      "end": { "x": 1, "y": 1 }
    },
    "category": "electronics"
  },
  "badges": [
    {
      "id": "badge-uuid-01",
      "title": "Boot Loader",
      "description": "Add your first computer or tablet to your inventory.",
      "icon": "https://api.tipbox.co/media/badges/boot-loader.png",
      "currentProgress": 8,
      "totalProgress": 10,
      "status": "in_progress"
    },
    {
      "id": "badge-uuid-02",
      "title": "Sound Wave",
      "description": "Add 3 audio devices to your collection.",
      "icon": "https://api.tipbox.co/media/badges/sound-wave.png",
      "currentProgress": 10,
      "totalProgress": 10,
      "status": "completed"
    },
    {
      "id": "badge-uuid-03",
      "title": "First Step",
      "description": "Register your first product in the system.",
      "icon": "https://api.tipbox.co/media/badges/first-step.png",
      "currentProgress": 0,
      "totalProgress": 10,
      "status": "not_started"
    }
  ]
}
```

### Badge Status Değerleri

| `status` | Koşul | UI |
|---|---|---|
| `"not_started"` | `currentProgress === 0` | Gri / kilitli görünüm |
| `"in_progress"` | `0 < currentProgress < totalProgress` | Progress bar göster |
| `"completed"` | `currentProgress >= totalProgress` | Tamamlandı rozetli |

**Notlar:**
- `collection.description` → uzun açıklama (kısaltma yapma, scrollable göster)
- `badge.icon` → public CDN URL, hem görsel hem download için kullanılabilir
- Status filtreleme (`All / Not Started / In Progress / Completed`) **client-side** yapılmalı — backend filtrelemiyor
- `search` parametresi sadece badge'leri filtreler, collection info her zaman döner

**404 Response:**
```json
{ "message": "Collection not found" }
```

---

## TypeScript Tipleri

`src/features/events/types/collection.types.ts` dosyasına eklenecek:

```typescript
// ─── Background Gradient ───────────────────────────────────────────
export interface CollectionBackgroundGradient {
  colors: string[];                    // Min 2 hex renk, ör: ["#a855f7", "#7e22ce"]
  start: { x: number; y: number };     // 0-1 arası koordinat
  end: { x: number; y: number };       // 0-1 arası koordinat
}

// ─── Collection (liste ve detayda ortak) ───────────────────────────
export interface Collection {
  id: string;
  title: string;
  description: string;
  currentProgress: number;             // Kullanıcıya özel ilerleme
  totalProgress: number;               // Toplam hedef
  backgroundGradient: CollectionBackgroundGradient;
  category?: string | null;            // Chip filter handle'ı
}

// ─── EP-01: Collections List ───────────────────────────────────────
export interface CollectionsPagination {
  cursor: string | null;               // null = son sayfa
  hasMore: boolean;
  limit: number;
  total: number;
}

export interface CollectionsListResponse {
  collections: Collection[];
  pagination: CollectionsPagination;
}

export interface CollectionsListParams {
  search?: string;
  category?: string;
  mainCategoryId?: string;
  subCategoryId?: string;
  productGroupId?: string;
  cursor?: string;
  limit?: number;
}

// ─── EP-02: Categories ────────────────────────────────────────────
export interface CollectionCategory {
  id: string;
  name: string;
  handle: string;                      // EP-01'e "category" olarak gönderilir
}

export interface CollectionCategoriesResponse {
  categories: CollectionCategory[];
}

// ─── EP-03: Collection Detail ─────────────────────────────────────
export type CollectionBadgeStatus = 'not_started' | 'in_progress' | 'completed';

export interface CollectionBadge {
  id: string;
  title: string;
  description: string;
  icon: string;                        // Public CDN URL
  currentProgress: number;
  totalProgress: number;
  status: CollectionBadgeStatus;
}

export interface CollectionDetailResponse {
  collection: Collection;
  badges: CollectionBadge[];
}
```

---

## API Fonksiyonları

`src/features/events/api/communityEventsApi.ts` dosyasına eklenecek:

```typescript
import type {
  CollectionsListResponse,
  CollectionsListParams,
  CollectionCategoriesResponse,
  CollectionDetailResponse,
} from '../types/collection.types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL; // veya mevcut apiClient

// ─── EP-01: Collections Listesi ───────────────────────────────────
export async function getCollections(
  params: CollectionsListParams,
  token: string,
): Promise<CollectionsListResponse> {
  const query = new URLSearchParams();
  if (params.search)         query.set('search', params.search);
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.mainCategoryId) query.set('mainCategoryId', params.mainCategoryId);
  if (params.subCategoryId)  query.set('subCategoryId', params.subCategoryId);
  if (params.productGroupId) query.set('productGroupId', params.productGroupId);
  if (params.cursor)         query.set('cursor', params.cursor);
  if (params.limit)          query.set('limit', String(params.limit));

  const res = await fetch(`${BASE_URL}/events/collections?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Collections fetch failed: ${res.status}`);
  return res.json();
}

// ─── EP-02: Chip Filtre Kategorileri ─────────────────────────────
export async function getCollectionCategories(
  token: string,
): Promise<CollectionCategoriesResponse> {
  const res = await fetch(`${BASE_URL}/events/collections/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Collection categories fetch failed: ${res.status}`);
  return res.json();
}

// ─── EP-03: Collection Detay + Badge Listesi ─────────────────────
export async function getCollectionDetail(
  collectionId: string,
  token: string,
  search?: string,
): Promise<CollectionDetailResponse> {
  const query = new URLSearchParams();
  if (search) query.set('search', search);

  const url = `${BASE_URL}/events/collections/${collectionId}${query.size ? `?${query}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) throw new Error('Collection not found');
  if (!res.ok) throw new Error(`Collection detail fetch failed: ${res.status}`);
  return res.json();
}
```

---

## React Query Hook'ları

`src/features/events/api/hooks.ts` dosyasına eklenecek:

```typescript
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth'; // token hook'unuz
import {
  getCollections,
  getCollectionCategories,
  getCollectionDetail,
} from './communityEventsApi';
import type {
  CollectionsListParams,
  CollectionsListResponse,
} from '../types/collection.types';

// ─── EP-01: Collections Infinite Scroll ──────────────────────────
export function useCollections(params: Omit<CollectionsListParams, 'cursor'>) {
  const { token } = useAuth();

  return useInfiniteQuery<
    CollectionsListResponse,
    Error,
    InfiniteData<CollectionsListResponse>,
    [string, typeof params],
    string | undefined
  >({
    queryKey: ['collections', params],
    queryFn: ({ pageParam }) =>
      getCollections({ ...params, cursor: pageParam, limit: 20 }, token!),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.cursor ?? undefined) : undefined,
    enabled: !!token,
  });
}

// ─── EP-02: Chip Filtre Kategorileri ─────────────────────────────
export function useCollectionCategories() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['collection-categories'],
    queryFn: () => getCollectionCategories(token!),
    staleTime: 24 * 60 * 60 * 1000, // 24 saat
    enabled: !!token,
  });
}

// ─── EP-03: Collection Detay ──────────────────────────────────────
export function useCollectionDetail(collectionId: string, search?: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['collection-detail', collectionId, search],
    queryFn: () => getCollectionDetail(collectionId, token!, search),
    enabled: !!token && !!collectionId,
  });
}
```

---

## CollectionsTab Bileşeni Entegrasyonu

`CollectionsTab.tsx` içinde:

```tsx
import { useCollections, useCollectionCategories } from '../api/hooks';

export function CollectionsTab() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  // EP-02: Chip kategoriler
  const { data: categoriesData } = useCollectionCategories();
  const chipCategories = [
    { id: 'all', name: 'All', handle: 'all' },
    ...(categoriesData?.categories ?? []),
  ];

  // EP-01: Collections listesi
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useCollections({
    search: debouncedSearch || undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
  });

  const collections = data?.pages.flatMap((page) => page.collections) ?? [];

  return (
    <FlatList
      data={collections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <CollectionCard collection={item} />}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
      // Chip filter bar
      ListHeaderComponent={
        <ChipFilterBar
          categories={chipCategories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      }
    />
  );
}
```

---

## CollectionDetailScreen Bileşeni Entegrasyonu

`CollectionDetailScreen.tsx` içinde:

```tsx
import { useCollectionDetail } from '../api/hooks';

type BadgeFilter = 'all' | 'not_started' | 'in_progress' | 'completed';

export function CollectionDetailScreen({ collectionId }: { collectionId: string }) {
  const [badgeSearch, setBadgeSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BadgeFilter>('all');
  const debouncedSearch = useDebounce(badgeSearch, 400);

  // EP-03: Collection detay
  const { data, isLoading, error } = useCollectionDetail(collectionId, debouncedSearch || undefined);

  if (isLoading) return <LoadingScreen />;
  if (error?.message === 'Collection not found') return <NotFoundScreen />;
  if (!data) return null;

  const { collection, badges } = data;

  // Status filtresi client-side
  const filteredBadges =
    statusFilter === 'all'
      ? badges
      : badges.filter((b) => b.status === statusFilter);

  return (
    <ScrollView>
      {/* Gradient header */}
      <LinearGradient
        colors={collection.backgroundGradient.colors}
        start={collection.backgroundGradient.start}
        end={collection.backgroundGradient.end}
      >
        <Text>{collection.title}</Text>
        <ProgressBar current={collection.currentProgress} total={collection.totalProgress} />
      </LinearGradient>

      <Text>{collection.description}</Text>

      {/* Badge search */}
      <SearchInput
        value={badgeSearch}
        onChangeText={setBadgeSearch}
        placeholder="Search badges..."
      />

      {/* Status chip filter (client-side) */}
      <BadgeStatusFilter selected={statusFilter} onSelect={setStatusFilter} />

      {/* Badge listesi */}
      {filteredBadges.map((badge) => (
        <BadgeCard key={badge.id} badge={badge} />
      ))}
    </ScrollView>
  );
}
```

---

## Hata Yanıtları

Tüm endpoint'lerde ortak:

| HTTP Kodu | Neden | Nasıl handle edilmeli |
|---|---|---|
| `401` | Token yok veya geçersiz | Auth refresh / login'e yönlendir |
| `404` | Collection bulunamadı (EP-03) | "Bulunamadı" ekranı göster |
| `500` | Sunucu hatası | Hata mesajı + retry butonu göster |

```json
// 401
{ "message": "Unauthorized" }

// 404
{ "message": "Collection not found" }

// 500
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "...",
    "traceId": "...",
    "timestamp": "...",
    "path": "..."
  }
}
```

---

## Mock'tan Gerçek API'ye Geçiş

### CollectionsTab.tsx

```diff
- import { MOCK_COLLECTIONS } from '../mocks/collections.mock';
- import { FILTER_CATEGORIES } from '../constants/filterCategories';
+ import { useCollections, useCollectionCategories } from '../api/hooks';

- const collections = MOCK_COLLECTIONS;
- const categories = FILTER_CATEGORIES;
+ const { data, fetchNextPage, hasNextPage } = useCollections({ search, category });
+ const { data: categoriesData } = useCollectionCategories();
+ const collections = data?.pages.flatMap(p => p.collections) ?? [];
+ const categories = [{ id: 'all', name: 'All', handle: 'all' }, ...(categoriesData?.categories ?? [])];
```

### CollectionDetailScreen.tsx

```diff
- import { MOCK_COLLECTION, MOCK_BADGES } from '../mocks/collection.mock';
+ import { useCollectionDetail } from '../api/hooks';

- const collection = MOCK_COLLECTION;
- const badges = MOCK_BADGES;
+ const { data } = useCollectionDetail(collectionId, debouncedSearch);
+ const { collection, badges } = data ?? {};
```

---

## Notlar & Dikkat Edilecekler

### Route Sırası (Backend — Bilgi için)

Backend'de `/events/collections` mount'u `/events`'tan **önce** yapılmıştır. Bu sayede Event router'ın `/:eventId` route'u collection path'lerini yakalamamaktadır.

### `backgroundGradient`

Admin panelden her collection için özel gradient set edilebilir (`PATCH /admin/badges/collections/:id`). Set edilmemişse backend, collection ID'sinden deterministik gradient üretir — her request'te aynı renkler döner.

### Search Debounce

| Endpoint | Önerilen Debounce |
|---|---|
| EP-01 (`search`) | 500ms |
| EP-03 (`search`) | 400ms |

### Badge İndirme

`badge.icon` public CDN URL'idir. Kullanıcının badge görselini Media Library'e kaydetmek için bu URL doğrudan `expo-media-library` ile kullanılabilir:

```typescript
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

async function downloadBadge(iconUrl: string) {
  const fileUri = FileSystem.cacheDirectory + 'badge.png';
  await FileSystem.downloadAsync(iconUrl, fileUri);
  await MediaLibrary.saveToLibraryAsync(fileUri);
}
```

### Cache Stratejisi (Önerilen)

| Endpoint | `staleTime` | Açıklama |
|---|---|---|
| EP-01 (collections list) | `5 * 60 * 1000` (5dk) | Progress sık değişebilir |
| EP-02 (categories) | `24 * 60 * 60 * 1000` (24sa) | Kategoriler nadir değişir |
| EP-03 (collection detail) | `5 * 60 * 1000` (5dk) | Badge progress sık değişebilir |

---

*Sorular veya değişiklik talepleri için backend ekibiyle iletişime geçin.*
