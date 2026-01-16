# Post Type ve Context-Based Feed Filtreleme Analizi

Bu doküman, kategori hiyerarşisinde hangi seviyede hangi tip gönderilerin oluşturulabileceği, görüntülenebileceği ve backend'den nasıl getirileceği konusundaki mevcut durumu ve eksiklikleri analiz eder.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Post Type Kuralları](#post-type-kuralları)
3. [Mevcut Durum Analizi](#mevcut-durum-analizi)
4. [Eksiklikler ve Çözüm Önerileri](#eksiklikler-ve-çözüm-önerileri)
5. [Backend Endpoint Gereksinimleri](#backend-endpoint-gereksinimleri)
6. [Frontend Implementation Plan](#frontend-implementation-plan)

---

## 🎯 Genel Bakış

### Post Type Hiyerarşisi

```
Sub Category / Product Group Seviyesi:
  ✅ Oluşturulabilen: Free, Tips & Tricks, Question
  ✅ Görüntülenebilen: Free, Tips & Tricks, Question
  ❌ Görüntülenemeyen: Experience, Update, Benchmark

Product Seviyesi:
  ✅ Oluşturulabilen: Experience, Tips & Tricks, Question, Update, Benchmark
  ✅ Görüntülenebilen: Experience, Tips & Tricks, Question, Update, Benchmark
```

### Hiyerarşik Feed Mantığı

- **Bir üst seviye**, hem kendine ait hem de **alt seviyeye ait** gönderileri feedinde barındırabilir
- **Experience ve Benchmark** sadece **product feed'de** görüntülenir
- Sub Category ve Product Group feed'lerinde Experience ve Benchmark gönderileri **filtrelenmelidir**

---

## 📊 Post Type Kuralları

### Seviye Bazlı Post Type Matrisi

| Seviye | Free | Tips & Tricks | Question | Experience | Update | Benchmark |
|--------|------|--------------|----------|------------|--------|-----------|
| **Sub Category** | ✅ Oluştur | ✅ Oluştur | ✅ Oluştur | ❌ Oluştur | ❌ Oluştur | ❌ Oluştur |
| **Sub Category Feed** | ✅ Görüntüle | ✅ Görüntüle | ✅ Görüntüle | ❌ Görüntüleme | ❌ Görüntüleme | ❌ Görüntüleme |
| **Product Group** | ✅ Oluştur | ✅ Oluştur | ✅ Oluştur | ❌ Oluştur | ❌ Oluştur | ❌ Oluştur |
| **Product Group Feed** | ✅ Görüntüle | ✅ Görüntüle | ✅ Görüntüle | ❌ Görüntüleme | ❌ Görüntüleme | ❌ Görüntüleme |
| **Product** | ❌ Oluştur | ✅ Oluştur | ✅ Oluştur | ✅ Oluştur | ✅ Oluştur | ✅ Oluştur |
| **Product Feed** | ✅ Görüntüle | ✅ Görüntüle | ✅ Görüntüle | ✅ Görüntüle | ✅ Görüntüle | ✅ Görüntüle |

### Backend Tag Mapping

| Frontend Post Type | Backend Tag | Açıklama |
|-------------------|-------------|----------|
| Free | `Review` veya tag yok | Serbest gönderiler |
| Tips & Tricks | `Tips` | İpucu gönderileri |
| Question | `Question` | Soru gönderileri |
| Experience | `Experience` | Deneyim gönderileri |
| Update | `Update` | Güncelleme gönderileri |
| Benchmark | `Benchmark` | Karşılaştırma gönderileri |

---

## 🔍 Mevcut Durum Analizi

### ✅ Çalışan Özellikler

1. **CreatePostBottomSheet - Post Type Filtreleme**
   - `subcategories` ve `productgroups` seviyesinde: Sadece Free, Tips, Question gösteriliyor ✅
   - `products` seviyesinde: Experience, Tips, Comparison, Update, Question gösteriliyor ✅
   - **Dosya:** `src/components/CreatePostBottomSheet/index.tsx` (satır 114-141)

2. **Feed API - Context Support**
   - `getFeed` fonksiyonu `contextType` ve `contextId` parametrelerini destekliyor ✅
   - **Dosya:** `src/features/feed/api/feedApi.ts` (satır 94-141)

3. **PostsScreen - Context Detection**
   - Context type ve ID'yi route params ve store'dan belirliyor ✅
   - **Dosya:** `src/features/post/screens/PostsScreen.tsx` (satır 64-103)

### ❌ Eksik Özellikler

#### 1. PostsScreen - Filter/Sort UI Eksik

**Mevcut Durum:**
- `handleFilterPress` sadece `console.log` yapıyor
- Filter/Sort bottom sheet yok
- Post type'a göre filtreleme yok

**Dosya:** `src/features/post/screens/PostsScreen.tsx` (satır 147-150)

```typescript
const handleFilterPress = () => {
  // Handle filter/sort action
  console.log('Filter/Sort pressed');
};
```

**Eksik:**
- Filter/Sort bottom sheet component'i
- Context seviyesine göre post type filtreleme
- Sort seçenekleri (Newest First, Oldest First, Most Popular)

#### 2. Feed API - Context-Based Post Type Filtreleme Eksik

**Mevcut Durum:**
- `getFeed` fonksiyonu contextType ve contextId alıyor ama post type filtreleme yapmıyor
- Backend'den gelen tüm post type'ları gösteriliyor

**Dosya:** `src/features/feed/api/feedApi.ts` (satır 94-141)

**Eksik:**
- Context seviyesine göre otomatik post type filtreleme
- Sub Category ve Product Group için Experience, Update, Benchmark'ı filtreleme

#### 3. Filtered Feed API - Context Support Eksik

**Mevcut Durum:**
- `getFilteredFeed` fonksiyonu contextType ve contextId parametrelerini desteklemiyor
- Sadece tags, interests, category, sort filtreleri var

**Dosya:** `src/features/feed/api/feedApi.ts` (satır 161-284)

**Eksik:**
- `contextType` ve `contextId` parametreleri
- Context seviyesine göre otomatik post type filtreleme

#### 4. Hiyerarşik Feed Mantığı Eksik

**Mevcut Durum:**
- Backend sadece seçili context'e ait gönderileri getiriyor
- Üst seviye alt seviyeye ait gönderileri göstermiyor

**Eksik:**
- Backend'de hiyerarşik feed mantığı (üst seviye alt seviyeye ait gönderileri de getirmeli)
- Frontend'de bu mantığın kullanımı

#### 5. PostsScreen - Post Type Render Eksik

**Mevcut Durum:**
- Sadece `post` type'ı render ediliyor
- Experience, Benchmark, Tips, Question, Update render edilmiyor

**Dosya:** `src/features/post/screens/PostsScreen.tsx` (satır 436-471)

**Eksik:**
- Tüm post type'ları için render logic
- FeedScreen'deki mapping fonksiyonlarının kullanımı

---

## 🚨 Eksiklikler ve Çözüm Önerileri

### 1. Filter/Sort Bottom Sheet Component

**Gereksinim:**
- Context seviyesine göre post type filtreleme seçenekleri
- Sort seçenekleri (Newest First, Oldest First, Most Popular)
- Reset ve Done butonları

**Önerilen Yapı:**

```typescript
interface FilterSortBottomSheetProps {
  contextType: 'sub_category' | 'product_group' | 'product';
  onFilterChange: (filters: {
    postTypes?: string[];
    sort?: 'newest' | 'oldest' | 'popular';
  }) => void;
  onClose: () => void;
}

// Post Type Seçenekleri (Context'e göre)
const getAvailablePostTypes = (contextType: string) => {
  switch (contextType) {
    case 'sub_category':
    case 'product_group':
      return ['All', 'Generals', 'Tips & Tricks', 'Questions'];
    case 'product':
      return ['All', 'Reviews', 'Tips & Tricks', 'Benchmarks', 'Updates', 'Questions'];
    default:
      return [];
  }
};
```

**Yeni Dosya:** `src/features/post/components/FilterSortBottomSheet/index.tsx`

### 2. Feed API - Context-Based Post Type Filtreleme

**Gereksinim:**
- `getFeed` fonksiyonuna context seviyesine göre otomatik post type filtreleme eklenmeli
- Sub Category ve Product Group için Experience, Update, Benchmark filtrelenmeli

**Önerilen Değişiklik:**

```typescript
export const getFeed = async (
  cursor?: string,
  limit: number = 20,
  contextType?: 'sub_category' | 'product_group' | 'product',
  contextId?: string,
  postTypeFilters?: string[] // Yeni parametre
): Promise<FeedApiResponse> => {
  const params = new URLSearchParams();
  // ... mevcut parametreler
  
  // Context seviyesine göre otomatik filtreleme
  if (contextType && !postTypeFilters) {
    const allowedTypes = getAllowedPostTypesForContext(contextType);
    allowedTypes.forEach(type => params.append('tags[]', type));
  } else if (postTypeFilters) {
    postTypeFilters.forEach(type => params.append('tags[]', type));
  }
  
  // ...
};

const getAllowedPostTypesForContext = (contextType: string): string[] => {
  switch (contextType) {
    case 'sub_category':
    case 'product_group':
      // Experience, Update, Benchmark hariç
      return ['Review', 'Tips', 'Question'];
    case 'product':
      // Tüm post type'lar
      return ['Review', 'Tips', 'Question', 'Experience', 'Update', 'Benchmark'];
    default:
      return [];
  }
};
```

**Dosya:** `src/features/feed/api/feedApi.ts`

### 3. Filtered Feed API - Context Support

**Gereksinim:**
- `getFilteredFeed` fonksiyonuna `contextType` ve `contextId` parametreleri eklenmeli
- Context seviyesine göre otomatik post type filtreleme

**Önerilen Değişiklik:**

```typescript
export const getFilteredFeed = async (
  cursor?: string,
  limit: number = 20,
  filters?: FeedFilterParams,
  contextType?: 'sub_category' | 'product_group' | 'product', // Yeni parametre
  contextId?: string // Yeni parametre
): Promise<FeedApiResponse> => {
  const params = new URLSearchParams();
  // ... mevcut parametreler
  
  // Context parametreleri
  if (contextType) {
    params.append('contextType', contextType);
  }
  if (contextId) {
    params.append('contextId', contextId);
  }
  
  // Context seviyesine göre otomatik post type filtreleme
  if (contextType && (!filters?.tags || filters.tags.length === 0)) {
    const allowedTypes = getAllowedPostTypesForContext(contextType);
    allowedTypes.forEach(type => params.append('tags[]', type));
  }
  
  // ...
};
```

**Dosya:** `src/features/feed/api/feedApi.ts`

### 4. PostsScreen - Filter/Sort Integration

**Gereksinim:**
- Filter/Sort bottom sheet entegrasyonu
- Filtrelenmiş feed API çağrısı
- Post type render logic

**Önerilen Değişiklik:**

```typescript
// State
const [filters, setFilters] = useState<{
  postTypes?: string[];
  sort?: 'newest' | 'oldest' | 'popular';
}>({});

// Filtered feed hook
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  error,
} = useFilteredFeed(
  20,
  {
    tags: filters.postTypes?.map(type => mapPostTypeToTag(type)),
    sort: filters.sort ? mapSortToBackend(filters.sort) : undefined,
  },
  feedContextType,
  feedContextId
);

// Filter press handler
const handleFilterPress = () => {
  openBottomSheet(
    <FilterSortBottomSheet
      contextType={feedContextType}
      onFilterChange={(newFilters) => {
        setFilters(newFilters);
        closeBottomSheet();
      }}
      onClose={closeBottomSheet}
    />
  );
};
```

**Dosya:** `src/features/post/screens/PostsScreen.tsx`

### 5. Post Type Render Logic

**Gereksinim:**
- Tüm post type'ları için render logic
- FeedScreen'deki mapping fonksiyonlarının kullanımı

**Önerilen Değişiklik:**

```typescript
const renderFeedItem = useCallback((item: FeedApiItem) => {
  switch (item.type) {
    case 'post':
      return <PostCard data={mapToPostCardData(item)} />;
    case 'experience':
      return <ExperiencePostCard data={mapToExperienceCardData(item)} />;
    case 'benchmark':
      return <BenchmarkPostCard data={mapToBenchmarkCardData(item)} />;
    case 'tipsAndTricks':
      return <TipsAndTricksPostCard data={mapToTipsCardData(item)} />;
    case 'question':
      return <QuestionPostCard data={mapToQuestionCardData(item)} />;
    case 'update':
      return <UpdatePostCard data={mapToUpdateCardData(item)} />;
    default:
      return null;
  }
}, []);
```

**Dosya:** `src/features/post/screens/PostsScreen.tsx`

---

## 🔧 Backend Endpoint Gereksinimleri

### 1. GET /feed - Context-Based Post Type Filtreleme

**Mevcut Endpoint:**
```
GET /feed?cursor=<cursor>&limit=<limit>&contextType=<type>&contextId=<id>
```

**Gereksinim:**
- Context seviyesine göre otomatik post type filtreleme
- Sub Category ve Product Group için Experience, Update, Benchmark'ı filtreleme

**Önerilen Backend Mantığı:**

```typescript
// Backend'de contextType'a göre otomatik filtreleme
if (contextType === 'sub_category' || contextType === 'product_group') {
  // Sadece Review, Tips, Question göster
  postWhere.AND.push({
    OR: [
      { contentPostTags: { some: { tag: { in: ['Review', 'Tips', 'Question'] } } } },
      { tags: { some: { tag: { in: ['Review', 'Tips', 'Question'] } } } },
    ],
  });
} else if (contextType === 'product') {
  // Tüm post type'lar gösterilebilir (filtreleme yok)
}
```

### 2. GET /feed/filtered - Context Support

**Mevcut Endpoint:**
```
GET /feed/filtered?cursor=<cursor>&limit=<limit>&tags[]=<tag>&sort=<sort>
```

**Gereksinim:**
- `contextType` ve `contextId` parametreleri
- Context seviyesine göre otomatik post type filtreleme

**Önerilen Endpoint:**
```
GET /feed/filtered?cursor=<cursor>&limit=<limit>&contextType=<type>&contextId=<id>&tags[]=<tag>&sort=<sort>
```

**Backend Mantığı:**
- `contextType` ve `contextId` varsa, context'e göre filtreleme yap
- `tags` parametresi varsa, kullanıcının seçtiği filtreleri uygula
- `tags` yoksa, context seviyesine göre otomatik filtreleme yap

### 3. Hiyerarşik Feed Mantığı

**Gereksinim:**
- Üst seviye alt seviyeye ait gönderileri de getirmeli

**Önerilen Backend Mantığı:**

```typescript
// Sub Category Feed: Sub Category'ye ait + Alt Product Group'lara ait gönderiler
if (contextType === 'sub_category') {
  // Sub Category'ye ait gönderiler
  const subCategoryPosts = await getPostsBySubCategory(contextId);
  
  // Alt Product Group'lara ait gönderiler
  const productGroups = await getProductGroupsBySubCategory(contextId);
  const productGroupPosts = await getPostsByProductGroups(productGroups.map(pg => pg.id));
  
  // Birleştir ve sırala
  return mergeAndSortPosts(subCategoryPosts, productGroupPosts);
}

// Product Group Feed: Product Group'a ait + Alt Product'lara ait gönderiler
if (contextType === 'product_group') {
  // Product Group'a ait gönderiler
  const productGroupPosts = await getPostsByProductGroup(contextId);
  
  // Alt Product'lara ait gönderiler (sadece Experience, Update, Benchmark hariç)
  const products = await getProductsByProductGroup(contextId);
  const productPosts = await getPostsByProducts(
    products.map(p => p.id),
    { excludeTypes: ['Experience', 'Update', 'Benchmark'] }
  );
  
  // Birleştir ve sırala
  return mergeAndSortPosts(productGroupPosts, productPosts);
}
```

---

## 📱 Frontend Implementation Plan

### Phase 1: Filter/Sort Bottom Sheet Component

**Dosya:** `src/features/post/components/FilterSortBottomSheet/index.tsx`

**Özellikler:**
- Context seviyesine göre post type seçenekleri
- Sort seçenekleri (Newest First, Oldest First, Most Popular)
- Reset ve Done butonları
- Radio button seçimi

**Post Type Mapping:**
```typescript
const POST_TYPE_MAPPING = {
  'All': undefined,
  'Generals': 'Review', // Free posts
  'Reviews': 'Review', // Experience posts (product seviyesinde)
  'Tips & Tricks': 'Tips',
  'Questions': 'Question',
  'Benchmarks': 'Benchmark',
  'Updates': 'Update',
};
```

### Phase 2: Feed API Updates

**Dosya:** `src/features/feed/api/feedApi.ts`

**Değişiklikler:**
1. `getFeed` fonksiyonuna context-based post type filtreleme
2. `getFilteredFeed` fonksiyonuna `contextType` ve `contextId` parametreleri
3. Helper fonksiyonlar: `getAllowedPostTypesForContext`, `mapPostTypeToTag`

### Phase 3: Feed Hooks Updates

**Dosya:** `src/features/feed/api/hooks.ts`

**Değişiklikler:**
1. `useFilteredFeed` hook'una `contextType` ve `contextId` parametreleri
2. Context seviyesine göre otomatik filtreleme

### Phase 4: PostsScreen Integration

**Dosya:** `src/features/post/screens/PostsScreen.tsx`

**Değişiklikler:**
1. Filter/Sort state management
2. Filter/Sort bottom sheet entegrasyonu
3. Filtered feed API çağrısı
4. Post type render logic (tüm post type'lar için)

### Phase 5: Post Type Mapping Functions

**Dosya:** `src/features/post/utils/postTypeMapping.ts` (yeni)

**Fonksiyonlar:**
- `mapPostTypeToTag`: Frontend post type → Backend tag
- `mapTagToPostType`: Backend tag → Frontend post type
- `getAllowedPostTypesForContext`: Context seviyesine göre izin verilen post type'lar
- `mapSortToBackend`: Frontend sort → Backend sort
- `mapSortFromBackend`: Backend sort → Frontend sort

---

## 📝 Request/Response Yapıları

### Request: GET /feed (Context-Based)

```typescript
// Request
GET /feed?cursor=<cursor>&limit=20&contextType=sub_category&contextId=<id>

// Backend otomatik olarak şu tag'leri filtreler:
// - Review, Tips, Question (Experience, Update, Benchmark hariç)
```

### Request: GET /feed/filtered (Context-Based)

```typescript
// Request
GET /feed/filtered?cursor=<cursor>&limit=20&contextType=product_group&contextId=<id>&tags[]=Tips&tags[]=Question&sort=recent

// Backend:
// 1. Context'e göre otomatik filtreleme yapar (sub_category/product_group için Experience, Update, Benchmark hariç)
// 2. Kullanıcının seçtiği tag filtrelerini uygular
// 3. Sort parametresine göre sıralar
```

### Response: FeedApiResponse

```typescript
interface FeedApiResponse {
  items: FeedApiItem[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

interface FeedApiItem {
  type: 'post' | 'experience' | 'benchmark' | 'tipsAndTricks' | 'question' | 'update';
  data: ProfilePost | ReviewApiItem | BenchmarkApiItem | TipsApiItem | QuestionApiItem | UpdateApiItem;
}
```

---

## 🎯 Özet

### Eksik Ekranlar
1. ❌ **FilterSortBottomSheet** - Filter/Sort bottom sheet component'i

### Eksik Logic'ler
1. ❌ **Context-based post type filtreleme** - Feed API'de otomatik filtreleme
2. ❌ **Filter/Sort state management** - PostsScreen'de filter state
3. ❌ **Post type render logic** - Tüm post type'lar için render
4. ❌ **Hiyerarşik feed mantığı** - Üst seviye alt seviyeye ait gönderileri gösterme

### Eksik Endpoint'ler
1. ❌ **GET /feed/filtered** - `contextType` ve `contextId` parametreleri eksik
2. ❌ **Hiyerarşik feed endpoint** - Üst seviye alt seviyeye ait gönderileri getirme

### Eksik Request/Response Yapıları
1. ❌ **FilteredFeedRequest** - `contextType` ve `contextId` alanları
2. ❌ **Post type mapping** - Frontend post type ↔ Backend tag mapping

---

**Son Güncelleme:** 2024-12-19
