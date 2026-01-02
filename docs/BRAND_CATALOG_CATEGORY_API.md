# Brand Catalog ve Category API Dokümantasyonu

Bu dokümantasyon, mobil uygulama için Brand Catalog ve Category endpoint'lerinin kullanımını ve performans optimizasyonlarını içerir.

## 📋 İçindekiler

1. [Brand Endpoint'leri](#brand-endpointleri)
2. [Catalog Endpoint'leri](#catalog-endpointleri)
3. [Request/Response Formatları](#requestresponse-formatlari)
4. [Görsel Yönetimi](#gorsel-yonetimi)
5. [Mobil Uygulama Performans Önerileri](#mobil-uygulama-performans-onerileri)

---

## Brand Endpoint'leri

### 1. Brand Kategorilerini Listele

**Endpoint:** `GET /brands/categories`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /brands/categories
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "categoryId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Elektronik",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/brand-categories/electronics.jpg"
  },
  {
    "categoryId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Giyim",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/brand-categories/clothing.jpg"
  }
]
```

**Response Fields:**
- `categoryId` (string, UUID): Kategori benzersiz ID'si
- `name` (string): Kategori adı
- `image` (string | null): Kategori görseli (tam URL)

---

### 2. Kategoriye Göre Markaları Listele

**Endpoint:** `GET /brands/categories/{categoryId}/brands`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /brands/categories/550e8400-e29b-41d4-a716-446655440000/brands
Authorization: Bearer {token}
```

**Path Parameters:**
- `categoryId` (string): Brand kategori ID'si (UUID veya kategori adı)

**Response:**
```json
[
  {
    "brandId": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Apple",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg"
  },
  {
    "brandId": "880e8400-e29b-41d4-a716-446655440001",
    "name": "Samsung",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/brands/samsung-logo.jpg"
  }
]
```

**Response Fields:**
- `brandId` (string, UUID): Marka benzersiz ID'si
- `name` (string): Marka adı
- `image` (string | null): Marka logosu (tam URL)

---

### 3. Brand Catalog Detayları

**Endpoint:** `GET /brands/{brandId}/catalog`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /brands/770e8400-e29b-41d4-a716-446655440000/catalog
Authorization: Bearer {token}
```

**Path Parameters:**
- `brandId` (string, UUID): Brand ID'si

**Response:**
```json
{
  "brandId": "770e8400-e29b-41d4-a716-446655440000",
  "name": "Apple",
  "description": "Apple Inc. teknoloji şirketi",
  "bannerImage": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-banner.jpg",
  "followers": 1250,
  "isJoined": true
}
```

**Response Fields:**
- `brandId` (string, UUID): Brand benzersiz ID'si
- `name` (string): Brand adı
- `description` (string | null): Brand açıklaması
- `bannerImage` (string | null): Brand catalog ekranında kullanılacak banner görseli (tam URL)
- `followers` (number): Brand'i takip eden kullanıcı sayısı
- `isJoined` (boolean): Kullanıcının bu brand'i takip edip etmediği

**Error Responses:**
- `404 Not Found`: Brand bulunamadı

---

## Catalog Endpoint'leri

### 1. Tüm Kategorileri Listele

**Endpoint:** `GET /catalog/categories`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /catalog/categories
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "categoryId": "110e8400-e29b-41d4-a716-446655440000",
    "name": "Elektronik",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/categories/electronics.jpg"
  },
  {
    "categoryId": "220e8400-e29b-41d4-a716-446655440001",
    "name": "Ev & Yaşam",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/categories/home.jpg"
  }
]
```

**Response Fields:**
- `categoryId` (string, UUID): Kategori benzersiz ID'si
- `name` (string): Kategori adı
- `image` (string | null): Kategori görseli (tam URL)

**Not:** Bu endpoint cache'lenmiştir (24 saat TTL). Kategoriler nadiren değiştiği için performanslıdır.

---

### 2. Kategoriye Göre Sub-Kategorileri Listele

**Endpoint:** `GET /catalog/categories/{categoryId}/sub-categories`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /catalog/categories/110e8400-e29b-41d4-a716-446655440000/sub-categories
Authorization: Bearer {token}
```

**Path Parameters:**
- `categoryId` (string, UUID): Kategori ID'si

**Response:**
```json
[
  {
    "subCategoryId": "330e8400-e29b-41d4-a716-446655440000",
    "name": "Akıllı Telefonlar",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/sub-categories/smartphones.jpg",
    "categoryId": "110e8400-e29b-41d4-a716-446655440000"
  },
  {
    "subCategoryId": "440e8400-e29b-41d4-a716-446655440001",
    "name": "Laptoplar",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/sub-categories/laptops.jpg",
    "categoryId": "110e8400-e29b-41d4-a716-446655440000"
  }
]
```

**Response Fields:**
- `subCategoryId` (string, UUID): Sub-kategori benzersiz ID'si
- `name` (string): Sub-kategori adı
- `image` (string | null): Sub-kategori görseli (tam URL)
- `categoryId` (string, UUID): Ana kategori ID'si

**Error Responses:**
- `404 Not Found`: Kategori bulunamadı

**Not:** Bu endpoint cache'lenmiştir (2 saat TTL).

---

### 3. Sub-Kategoriye Göre Product Group'ları Listele

**Endpoint:** `GET /catalog/sub-categories/{subCategoryId}/product-groups`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /catalog/sub-categories/330e8400-e29b-41d4-a716-446655440000/product-groups
Authorization: Bearer {token}
```

**Path Parameters:**
- `subCategoryId` (string, UUID): Sub-kategori ID'si

**Response:**
```json
[
  {
    "productGroupId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "iPhone Serisi",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/product-groups/iphone-series.jpg",
    "subCategoryId": "330e8400-e29b-41d4-a716-446655440000"
  },
  {
    "productGroupId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Galaxy Serisi",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/product-groups/galaxy-series.jpg",
    "subCategoryId": "330e8400-e29b-41d4-a716-446655440000"
  }
]
```

**Response Fields:**
- `productGroupId` (string, UUID): Product group benzersiz ID'si
- `name` (string): Product group adı
- `image` (string | null): Product group görseli (tam URL)
- `subCategoryId` (string, UUID): Sub-kategori ID'si

**Error Responses:**
- `404 Not Found`: Sub-kategori bulunamadı

**Not:** Bu endpoint cache'lenmiştir (2 saat TTL).

---

### 4. Product Group'a Göre Ürünleri Listele

**Endpoint:** `GET /catalog/product-groups/{productGroupId}/products`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /catalog/product-groups/550e8400-e29b-41d4-a716-446655440000/products
Authorization: Bearer {token}
```

**Path Parameters:**
- `productGroupId` (string, UUID): Product group ID'si

**Response:**
```json
[
  {
    "productId": "770e8400-e29b-41d4-a716-446655440000",
    "name": "iPhone 15 Pro",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg",
    "productGroupId": "550e8400-e29b-41d4-a716-446655440000"
  },
  {
    "productId": "880e8400-e29b-41d4-a716-446655440001",
    "name": "iPhone 15",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15.jpg",
    "productGroupId": "550e8400-e29b-41d4-a716-446655440000"
  }
]
```

**Response Fields:**
- `productId` (string, UUID): Ürün benzersiz ID'si
- `name` (string): Ürün adı
- `image` (string | null): Ürün görseli (tam URL)
- `productGroupId` (string, UUID): Product group ID'si

**Error Responses:**
- `404 Not Found`: Product group bulunamadı

**Not:** Bu endpoint cache'lenmiştir (1 saat TTL).

---

## Görsel Yönetimi

### Görsel URL Formatı

Tüm görseller MinIO object storage'dan servis edilir ve tam URL formatında döner:

```
http://api-test.tipbox.co:9000/tipbox-media/{bucket-path}/{filename}
```

**Örnekler:**
- Brand logosu: `http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg`
- Kategori görseli: `http://api-test.tipbox.co:9000/tipbox-media/categories/electronics.jpg`
- Ürün görseli: `http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg`

### Görsel URL Çözümleme

Backend'de `resolveMediaUrl()` fonksiyonu kullanılarak:
- Database'deki relative path'ler tam URL'ye çevrilir
- Zaten tam URL ise olduğu gibi döndürülür
- Production ve development ortamları için otomatik endpoint çözümlemesi yapılır

### Null Görseller

Eğer bir görsel yoksa, `image` alanı `null` döner. Mobil uygulamada placeholder görsel kullanılmalıdır.

---

## Mobil Uygulama Performans Önerileri

### 1. Görsel Optimizasyonu

#### Lazy Loading
- Görseller sadece görünür olduklarında yüklenmelidir
- FlatList/ScrollView'de `onEndReached` kullanarak infinite scroll implementasyonu

**React Native Örneği:**
```typescript
import { Image } from 'react-native';
import FastImage from 'react-native-fast-image';

// Lazy loading için
<FastImage
  source={{ uri: item.image || PLACEHOLDER_IMAGE }}
  style={styles.image}
  resizeMode={FastImage.resizeMode.cover}
  priority={FastImage.priority.normal} // İlk görünenler için high
/>
```

#### Image Caching
- Görselleri disk cache'inde saklayın
- `react-native-fast-image` veya benzeri kütüphane kullanın
- Cache stratejisi: Disk cache + Memory cache

**Önerilen Kütüphane:**
```bash
npm install react-native-fast-image
```

#### Thumbnail/Resize Kullanımı
- Backend'den gelen görselleri optimize edin
- Gerekirse CDN üzerinden resize parametreleri ekleyin (gelecek özellik)
- Şimdilik mobil tarafında resize yapılabilir

**Örnek:**
```typescript
// Görsel boyutunu optimize et
const getOptimizedImageUrl = (url: string | null, width: number = 300) => {
  if (!url) return null;
  // Gelecekte CDN resize parametresi eklenebilir
  // return `${url}?w=${width}&q=80`;
  return url;
};
```

### 2. API İstek Optimizasyonu

#### Cache Stratejisi
- Kategori listeleri nadiren değişir, local storage'da cache'leyin
- React Query veya SWR kullanarak otomatik cache yönetimi

**React Query Örneği:**
```typescript
import { useQuery } from '@tanstack/react-query';

// Kategorileri cache'le (24 saat)
const { data: categories } = useQuery({
  queryKey: ['catalog', 'categories'],
  queryFn: () => fetchCategories(),
  staleTime: 24 * 60 * 60 * 1000, // 24 saat
  cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 gün
});
```

#### Batch Loading
- İlk yüklemede sadece gerekli verileri çekin
- Detay sayfaları için lazy loading kullanın

**Örnek Akış:**
```
1. Ana ekran: Sadece kategorileri yükle
2. Kategori seçimi: Sub-kategorileri yükle
3. Sub-kategori seçimi: Product group'ları yükle
4. Product group seçimi: Ürünleri yükle
```

#### Prefetching
- Kullanıcı bir kategoriye tıklamadan önce, muhtemel sonraki adımları prefetch edin

**Örnek:**
```typescript
// Kategori seçildiğinde sub-kategorileri prefetch et
const prefetchSubCategories = (categoryId: string) => {
  queryClient.prefetchQuery({
    queryKey: ['catalog', 'sub-categories', categoryId],
    queryFn: () => fetchSubCategories(categoryId),
  });
};
```

### 3. State Management

#### Local State vs Server State
- Kategori hiyerarşisi için local state kullanın (navigation stack)
- API'den gelen veriler için server state kullanın (React Query)

**Örnek:**
```typescript
// Navigation state (local)
const [navigationStack, setNavigationStack] = useState<CategoryStack[]>([]);

// API data (server state)
const { data: categories } = useQuery(['categories'], fetchCategories);
```

### 4. Pagination (Gelecek Özellik)

Brand feed ve product listeleri için cursor-based pagination kullanılacak:

**Örnek Request:**
```http
GET /brands/{brandId}/feed?limit=20&cursor={lastPostId}
```

**Örnek Response:**
```json
{
  "posts": [...],
  "pagination": {
    "cursor": "last-post-id",
    "hasMore": true,
    "limit": 20
  }
}
```

### 5. Error Handling

#### Retry Mekanizması
- Network hatalarında otomatik retry
- Exponential backoff kullanın

**React Query ile:**
```typescript
const { data, error } = useQuery({
  queryKey: ['categories'],
  queryFn: fetchCategories,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

#### Fallback Görseller
- Görsel yüklenemezse placeholder gösterin
- Offline durumda cache'lenmiş görselleri kullanın

### 6. Memory Management

#### Image Cleanup
- Ekrandan çıkan görselleri memory'den temizleyin
- FlatList'te `removeClippedSubviews` kullanın

**Örnek:**
```typescript
<FlatList
  data={items}
  renderItem={renderItem}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
  initialNumToRender={10}
/>
```

### 7. Network Optimizasyonu

#### Request Batching
- Birden fazla kategori için tek seferde istek atmayın
- Her kategori için ayrı istek atın (cache sayesinde hızlı olacak)

#### Compression
- API response'ları zaten JSON formatında (gzip compression backend'de aktif olmalı)
- Görseller için WebP formatı düşünülebilir (gelecek özellik)

### 8. Loading States

#### Skeleton Screens
- İlk yüklemede skeleton screen gösterin
- Kategori listeleri için placeholder kartlar

**Örnek:**
```typescript
const CategorySkeleton = () => (
  <View style={styles.skeletonCard}>
    <Skeleton width={80} height={80} />
    <Skeleton width={120} height={20} style={{ marginTop: 8 }} />
  </View>
);
```

### 9. Performance Monitoring

#### Metrics to Track
- API response time
- Image load time
- Cache hit rate
- Memory usage

**Örnek:**
```typescript
// Performance tracking
const startTime = Date.now();
const data = await fetchCategories();
const loadTime = Date.now() - startTime;
analytics.track('category_load_time', { loadTime });
```

---

## Örnek Kullanım Senaryoları

### Senaryo 1: Kategori Hiyerarşisi Navigasyonu

```
1. Kullanıcı ana ekranda kategorileri görür
   → GET /catalog/categories (cache'den hızlı)

2. Kullanıcı "Elektronik" kategorisine tıklar
   → GET /catalog/categories/{id}/sub-categories
   → Sub-kategoriler listelenir

3. Kullanıcı "Akıllı Telefonlar" sub-kategorisine tıklar
   → GET /catalog/sub-categories/{id}/product-groups
   → Product group'lar listelenir

4. Kullanıcı "iPhone Serisi" product group'una tıklar
   → GET /catalog/product-groups/{id}/products
   → Ürünler listelenir
```

### Senaryo 2: Brand Catalog Görüntüleme

```
1. Kullanıcı brand listesinden bir marka seçer
   → GET /brands/{brandId}/catalog
   → Brand detayları, banner görseli, takipçi sayısı gösterilir

2. Kullanıcı brand feed'ini görüntülemek ister
   → GET /brands/{brandId}/feed?limit=20
   → Brand'e ait post'lar listelenir
```

---

## Best Practices

### ✅ Yapılması Gerekenler

1. **Cache Kullanımı**: Kategori listelerini local storage'da cache'leyin
2. **Lazy Loading**: Görselleri sadece görünür olduklarında yükleyin
3. **Error Handling**: Network hatalarında retry mekanizması kullanın
4. **Placeholder**: Görsel yoksa placeholder gösterin
5. **Loading States**: Yükleme sırasında skeleton screen gösterin
6. **Memory Management**: Ekrandan çıkan görselleri temizleyin

### ❌ Yapılmaması Gerekenler

1. **Gereksiz İstekler**: Aynı veriyi tekrar tekrar çekmeyin
2. **Büyük Görseller**: Görselleri optimize etmeden yüklemeyin
3. **Blocking UI**: API istekleri UI'ı bloklamamalı
4. **Memory Leaks**: Component unmount olduğunda cleanup yapın
5. **Hardcoded URL'ler**: Environment variable kullanın

---

## Sorun Giderme

### Görsel Yüklenmiyor

1. URL formatını kontrol edin (tam URL olmalı)
2. MinIO endpoint'ine erişilebilirliği kontrol edin
3. Network loglarını inceleyin
4. Cache'i temizleyin

### API Yavaş

1. Cache kullanımını kontrol edin
2. Gereksiz istekleri azaltın
3. Batch loading kullanın
4. Backend cache TTL'lerini kontrol edin

### Memory Kullanımı Yüksek

1. Image cache boyutunu sınırlayın
2. `removeClippedSubviews` kullanın
3. Görsel boyutlarını optimize edin
4. Memory leak'leri kontrol edin

---

## Sonuç

Bu endpoint'ler mobil uygulama için optimize edilmiştir:
- ✅ Cache mekanizması (backend'de)
- ✅ Pagination desteği (cursor-based)
- ✅ Optimize edilmiş görsel URL'leri
- ✅ Hata yönetimi

Mobil uygulamada yukarıdaki performans önerilerini uygulayarak kullanıcı deneyimini en üst seviyeye çıkarabilirsiniz.


