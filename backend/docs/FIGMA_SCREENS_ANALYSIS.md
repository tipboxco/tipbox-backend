# Figma Ekranları Analiz Raporu
## Node ID'ler: 1350-1369

Bu dokümanda, belirtilen Figma node-id'lerine karşılık gelen ekranların component'leri ve API yapıları listelenmiştir.

---

## 📱 EKRAN LİSTESİ VE COMPONENT ANALİZİ

### 1. BrandScreen (Select Category / Select Brand)
**Node ID:** 1356, 1357, 1350, 1351, 1352, 1353, 1354, 1355

#### Kullanılan Component'ler:
- `Header` - Başlık ve geri butonu
- `Breadcrumb` - Navigasyon breadcrumb'ı
- `CategoryCard` - Kategori kartları (3 sütun grid)
- `BrandCard` - Marka kartları (3 sütun grid)
- `ScrollView` - Scroll container
- `VStack`, `HStack` - Layout component'leri
- `Text`, `Box` - Temel UI component'leri
- `Input`, `InputField` - Arama input'u (opsiyonel)

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/categories
// Query params: Yok

// GET /brands/categories/{categoryId}/brands
// Path params: { categoryId: string }
```

**Response:**
```typescript
// GET /brands/categories
interface BrandCategory[] {
  categoryId: string;
  name: string;
  image: string | null;
}

// GET /brands/categories/{categoryId}/brands
interface BrandListItem[] {
  brandId?: string;
  id?: string;
  categoryId: string;
  name: string;
  image: string | null;
}
```

---

### 2. BrandDetailScreen
**Node ID:** 1360, 1361, 1362, 1363

#### Kullanılan Component'ler:
- `Header` - Animated sticky header
- `Image` - Banner image
- `VStack`, `HStack` - Layout
- `Text`, `Box` - UI elements
- `Button`, `ButtonText` - Join/Leave button
- `PostCard` - Feed post kartları
- `ExperiencePostCard` - Experience post kartları
- `BenchmarkPostCard` - Benchmark post kartları
- `QuestionPostCard` - Question post kartları
- `TipsAndTricksPostCard` - Tips post kartları
- `ScrollView` (Animated) - Scroll container

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/{brandId}/catalog
// Path params: { brandId: string }

// GET /brands/{brandId}/feed
// Query params: { cursor?: string, limit?: number }
```

**Response:**
```typescript
// GET /brands/{brandId}/catalog
interface BrandCatalogResponse {
  brandId: string;
  name: string;
  description: string | null;
  bannerImage: string | null;
  followers: number;
  isJoined: boolean;
}

// GET /brands/{brandId}/feed
interface BrandFeedResponse {
  brandId: string;
  name: string;
  posts: BrandFeedPost[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

interface BrandFeedPost {
  type: string;
  data: ProfilePost | ReviewApiItem | BenchmarkApiItem | TipsApiItem | QuestionApiItem | BrandUpdateApiItem;
}
```

---

### 3. BrandProductBookScreen
**Node ID:** 1364, 1365

#### Kullanılan Component'ler:
- `Header` - Başlık
- `Input`, `InputField` - Arama input'u
- `FlatList` - Horizontal scrollable product list
- `VStack`, `HStack` - Layout
- `Text`, `Box`, `Pressable` - UI elements
- `Image` - Product images
- `ScrollView` - Vertical scroll container

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/{brandId}/groups
// Query params: { cursor?: string, limit?: number }
```

**Response:**
```typescript
interface BrandProductBookResponse {
  items: BrandProductGroup[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

interface BrandProductGroup {
  productGroupId: string;
  productGroupName: string;
  products: BrandProduct[];
}

interface BrandProduct {
  productId: string;
  name: string;
  image: string;
  stats: {
    reviews: number;
    likes: number;
    share: number;
  };
}
```

---

### 4. BrandProductDetailScreen
**Node ID:** 1366, 1367, 1368, 1369

#### Kullanılan Component'ler:
- `Header` - Başlık
- `BrandProductInfoCard` - Ürün bilgi kartı
- `TabsBar` - Tab navigasyonu (Animated)
- `PagerView` (Animated) - Tab içerikleri
- `FlatList` - Her tab için post listesi
- `PostCard` - Post kartları
- `ExperiencePostCard` - Experience kartları
- `BenchmarkPostCard` - Benchmark kartları
- `TipsAndTricksPostCard` - Tips kartları
- `QuestionPostCard` - Question kartları
- `NewsCard` - News kartları

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /products/{productId}
// Path params: { productId: string }

// GET /products/{productId}/posts
// Query params: { type?: 'experience' | 'comments' | 'benchmark', cursor?: string, limit?: number }

// GET /catalog/products/{productId}/posts
// Query params: { filter?: string, sort?: string, cursor?: string, limit?: number }

// GET /products/{productId}/news
// Query params: { cursor?: string, limit?: number }
```

**Response:**
```typescript
// GET /products/{productId}
interface ProductDetail {
  productId: string;
  name: string;
  subName?: string;
  description?: string;
  image: string | null;
  brand?: {
    id: string;
    name: string;
    image: string | null;
  };
  specs?: string[];
  price?: number;
  currency?: string;
}

// GET /products/{productId}/posts
interface ProductPostsResponse {
  items: BrandFeedPost[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// GET /catalog/products/{productId}/posts
interface FeedApiResponse {
  items: FeedApiItem[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// GET /products/{productId}/news
interface ProductNewsResponse {
  items: NewsItem[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  date: string;
  image: string | null;
}
```

---

### 5. BrandEventsScreen
**Node ID:** (Events listesi)

#### Kullanılan Component'ler:
- `Header` - Başlık
- `EventCard` - Etkinlik kartları
- `ScrollView` - Scroll container
- `VStack` - Layout
- `ActivityIndicator` - Loading state

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/{brandId}/events
// Query params: { cursor?: string, limit?: number }
```

**Response:**
```typescript
interface BrandEventsResponse {
  items: Event[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  status: 'join' | 'joined';
  image: string;
}
```

---

### 6. BrandEventsDetailScreen
**Node ID:** (Event detay)

#### Kullanılan Component'ler:
- `Header` - Başlık
- `Box`, `VStack`, `HStack` - Layout
- `Text` - UI text
- `Image` - Event image
- `Pressable` - Join button
- `ActivityIndicator` - Loading state
- `CheckIcon`, `CircleStackIcon` - Icons
- `PresentationChartBarIcon`, `GiftIcon` - Icons

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /events/{eventId}
// Path params: { eventId: string }

// GET /events/{eventId}/requirements
// Path params: { eventId: string }

// POST /events/{eventId}/join
// Path params: { eventId: string }
```

**Response:**
```typescript
// GET /events/{eventId}
interface EventDetailApiResponse {
  id: string;
  title: string;
  description: string;
  bannerImage: string;
  isJoined: boolean;
  participants: number | Array<any>;
  rewards: Array<{
    id: string;
    title: string;
    image: string;
  }>;
}

// GET /events/{eventId}/requirements
interface EventRequirementsResponse {
  requirements: Array<{
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    progress?: {
      current: number;
      total: number;
    };
  }>;
}

// POST /events/{eventId}/join
// Response: Success/Error
```

---

### 7. BrandHistoryScreen
**Node ID:** (Brand history)

#### Kullanılan Component'ler:
- `Header` - Başlık
- `BrandInfoCard` - Marka bilgi kartı
- `PointsHistoryCard` - Puan geçmişi kartları
- `HStack`, `VStack` - Layout
- `Pressable` - Navigasyon butonları
- `Image` - Badge images
- `DocumentTextIcon`, `ChatBubbleLeftIcon`, `CalendarIcon` - Icons

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/{brandId}/history
// Path params: { brandId: string }
```

**Response:**
```typescript
interface BrandHistory {
  brandId: string;
  name: string;
  totalPoints: number;
  stats: {
    surveys: number;
    shares: number;
    events: number;
  };
  badges: Array<{
    id: string;
    title: string;
    image: string;
  }>;
  pointsHistory: Array<{
    id: string;
    title: string;
    points: number;
    date: string;
  }>;
}
```

---

### 8. BrandPostListScreen
**Node ID:** (Posts listesi)

#### Kullanılan Component'ler:
- `Header` - Başlık
- `PostCard` - Post kartları
- `ScrollView` - Scroll container
- `VStack` - Layout
- `ActivityIndicator` - Loading state

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/{brandId}/feed
// Query params: { cursor?: string, limit?: number }
```

**Response:**
```typescript
interface BrandFeedResponse {
  brandId: string;
  name: string;
  posts: BrandFeedPost[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}
```

---

### 9. BrandSurveyListScreen
**Node ID:** (Surveys listesi)

#### Kullanılan Component'ler:
- `Header` - Başlık
- `SurveyCard` - Anket kartları
- `ScrollView` - Scroll container
- `VStack` - Layout
- `ActivityIndicator` - Loading state

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/{brandId}/surveys
// Query params: { cursor?: string, limit?: number }
```

**Response:**
```typescript
interface BrandSurveysResponse {
  items: Survey[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

interface Survey {
  id: string;
  title: string;
  description: string;
  type: string;
  duration: string;
  points: number;
  status: 'start' | 'continue' | 'view_results';
  progress?: number;
}
```

---

### 10. SurveyScreen
**Node ID:** (Survey detay)

#### Kullanılan Component'ler:
- `Header` - Başlık
- `FilterTabs` - Tab navigasyonu
- `SurveyCard` - Anket kartları
- `EventCard` - Etkinlik kartları
- `PostCard`, `BenchmarkPostCard`, `TipsAndTricksPostCard`, `QuestionPostCard`, `ExperiencePostCard`, `UpdatePostCard` - Post kartları
- `BrandInfoCard` - Marka bilgi kartı
- `FlatList` - Scroll container
- `VStack` - Layout

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /brands/{brandId}/surveys
// Query params: { cursor?: string, limit?: number }

// GET /brands/{brandId}/trends
// Query params: { cursor?: string, limit?: number }

// GET /brands/{brandId}/events
// Query params: { cursor?: string, limit?: number }
```

**Response:**
```typescript
// GET /brands/{brandId}/surveys
interface BrandSurveysResponse {
  items: Survey[];
  pagination: { cursor?: string; hasMore: boolean; limit: number; };
}

// GET /brands/{brandId}/trends
interface BrandTrendsResponse {
  items: BrandFeedPost[];
  pagination: { cursor?: string; hasMore: boolean; limit: number; };
}

// GET /brands/{brandId}/events
interface BrandEventsResponse {
  items: Event[];
  pagination: { cursor?: string; hasMore: boolean; limit: number; };
}
```

---

### 11. NewsDetailScreen
**Node ID:** (News detay)

#### Kullanılan Component'ler:
- `Header` - Başlık
- `ScrollView` - Scroll container
- `VStack`, `HStack` - Layout
- `Text`, `Box` - UI elements
- `Image` - News image
- `BookOpenIcon` - Icon
- `ActivityIndicator` - Loading state

#### Request/Response Yapıları:

**Request:**
```typescript
// GET /news/{newsId}
// Path params: { newsId: string }
```

**Response:**
```typescript
interface NewsDetail {
  id: string;
  title: string;
  content: string;
  source: string;
  date: string;
  image: string | null;
  author?: string;
  tags?: string[];
}
```

---

## 📦 COMPONENT LİSTESİ

### Catalog Feature Components:
1. **BrandCard** - Marka kartı (logo, isim, followers)
2. **CategoryCard** - Kategori kartı (icon, isim)
3. **BrandInfoCard** - Marka bilgi kartı (logo, isim, notification, history)
4. **BrandProductInfoCard** - Ürün bilgi kartı
5. **EventCard** - Etkinlik kartı (image, title, description, date, status)
6. **SurveyCard** - Anket kartı (type, title, description, progress, points)
7. **NewsCard** - Haber kartı
8. **PointsHistoryCard** - Puan geçmişi kartı
9. **ActionButtons** - Show Posts / Create Post butonları
10. **FilterTabs** - Tab navigasyonu

### Shared Components (diğer feature'lardan):
- `Header` - Başlık component'i
- `Breadcrumb` - Breadcrumb navigasyonu
- `PostCard` - Post kartı
- `ExperiencePostCard` - Experience post kartı
- `BenchmarkPostCard` - Benchmark post kartı
- `QuestionPostCard` - Question post kartı
- `TipsAndTricksPostCard` - Tips post kartı
- `UpdatePostCard` - Update post kartı

---

## 🔄 API ENDPOINT ÖZETİ

### Brand Endpoints:
- `GET /brands/categories` - Marka kategorileri
- `GET /brands/categories/{categoryId}/brands` - Kategoriye göre markalar
- `GET /brands/{brandId}/catalog` - Marka katalog bilgisi
- `GET /brands/{brandId}/feed` - Marka feed postları
- `GET /brands/{brandId}/groups` - Marka ürün grupları
- `GET /brands/{brandId}/surveys` - Marka anketleri
- `GET /brands/{brandId}/trends` - Marka trendleri
- `GET /brands/{brandId}/events` - Marka etkinlikleri
- `GET /brands/{brandId}/history` - Marka geçmişi
- `GET /brands/{brandId}/stats` - Marka istatistikleri

### Product Endpoints:
- `GET /products/{productId}` - Ürün detayı
- `GET /products/{productId}/posts` - Ürün postları
- `GET /products/{productId}/news` - Ürün haberleri
- `GET /catalog/products/{productId}/posts` - Ürün postları (catalog API)

### News Endpoints:
- `GET /news/{newsId}` - Haber detayı

### Event Endpoints:
- `GET /events/{eventId}` - Etkinlik detayı
- `GET /events/{eventId}/requirements` - Etkinlik gereksinimleri
- `POST /events/{eventId}/join` - Etkinliğe katıl

---

## 📝 NOTLAR

1. **Pagination:** Tüm list endpoint'leri cursor-based pagination kullanıyor
2. **Error Handling:** Tüm endpoint'lerde error handling mevcut
3. **Caching:** React Query ile cache stratejileri tanımlı
4. **Type Safety:** Tüm response'lar TypeScript interface'leri ile tip güvenli
5. **Image Handling:** `toImageSource` utility fonksiyonu ile image URL'leri handle ediliyor
