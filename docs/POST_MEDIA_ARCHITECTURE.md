# PostMedia Tablosu - Mimari ve Performans Rehberi

## 📋 Genel Bakış

`PostMedia` tablosu, gönderilere ait görselleri doğrudan saklamak için kullanılır. Bu tablo, gönderilerin ürün bağımlılığı olmadan görsellerini yönetmeyi sağlar.

## 🎯 Kullanım Senaryoları

### 1. Post Oluşturma Endpoint'leri

PostMedia tablosu şu endpoint'lerde kullanılacak:

#### ✅ `/posts/free` - Serbest Gönderi
- **Kullanım**: Kullanıcı serbest gönderi oluştururken görseller yükler
- **Görsel Kaynağı**: Doğrudan kullanıcı yüklemesi
- **PostMedia'ya Kayıt**: Evet

#### ✅ `/posts/tips-and-tricks` - İpucu Gönderisi
- **Kullanım**: İpucu paylaşırken görseller eklenebilir
- **Görsel Kaynağı**: Doğrudan kullanıcı yüklemesi
- **PostMedia'ya Kayıt**: Evet

#### ✅ `/posts/question` - Soru Gönderisi
- **Kullanım**: Soru sorarken görseller eklenebilir
- **Görsel Kaynağı**: Doğrudan kullanıcı yüklemesi
- **PostMedia'ya Kayıt**: Evet

#### ✅ `/posts/experience` - Deneyim Paylaşımı
- **Kullanım**: Ürün deneyimi paylaşırken görseller eklenebilir
- **Görsel Kaynağı**: Doğrudan kullanıcı yüklemesi veya InventoryMedia'dan
- **PostMedia'ya Kayıt**: Evet (doğrudan yüklenenler için)

#### ✅ `/posts/benchmark` - Karşılaştırma Gönderisi
- **Kullanım**: Ürün karşılaştırması yaparken görseller eklenebilir
- **Görsel Kaynağı**: Doğrudan kullanıcı yüklemesi
- **PostMedia'ya Kayıt**: Evet

#### ✅ `/posts/update` - Güncelleme Gönderisi
- **Kullanım**: Mevcut gönderiyi güncellerken görseller eklenebilir
- **Görsel Kaynağı**: Doğrudan kullanıcı yüklemesi
- **PostMedia'ya Kayıt**: Evet

### 2. Post Görüntüleme Endpoint'leri

#### ✅ `/feed` - Ana Feed
- **Kullanım**: Feed'de gönderilerin görsellerini gösterir
- **Veri Kaynağı**: PostMedia tablosundan batch olarak çekilir
- **Performans**: Batch query ile optimize edilmiş

#### ✅ `/posts/:id` - Tekil Post Detayı
- **Kullanım**: Post detay sayfasında görselleri gösterir
- **Veri Kaynağı**: PostMedia tablosundan postId ile çekilir
- **Performans**: Tek query ile tüm görseller

#### ✅ `/users/:id/posts` - Kullanıcı Gönderileri
- **Kullanım**: Kullanıcının gönderilerini listelerken görselleri gösterir
- **Veri Kaynağı**: PostMedia tablosundan batch olarak çekilir
- **Performans**: Batch query ile optimize edilmiş

#### ✅ `/explore` - Keşfet Sayfası
- **Kullanım**: Keşfet sayfasında gönderilerin görsellerini gösterir
- **Veri Kaynağı**: PostMedia tablosundan batch olarak çekilir
- **Performans**: Batch query ile optimize edilmiş

#### ✅ `/brands/:id/posts` - Marka Gönderileri
- **Kullanım**: Marka sayfasında gönderilerin görsellerini gösterir
- **Veri Kaynağı**: PostMedia tablosundan batch olarak çekilir
- **Performans**: Batch query ile optimize edilmiş

#### ✅ `/events/:id/posts` - Etkinlik Gönderileri
- **Kullanım**: Etkinlik sayfasında gönderilerin görsellerini gösterir
- **Veri Kaynağı**: PostMedia tablosundan batch olarak çekilir
- **Performans**: Batch query ile optimize edilmiş

## 🏗️ Mimari Tasarım

### Veri Akışı

```
1. Kullanıcı görsel yükler
   ↓
2. Görsel S3/MinIO'ya yüklenir → URL alınır
   ↓
3. Post oluşturulur (ContentPost)
   ↓
4. PostMedia kayıtları oluşturulur (her görsel için bir kayıt)
   ↓
5. Feed/Liste endpoint'lerinde batch olarak çekilir
```

### Mevcut Durum vs Yeni Durum

#### ❌ Mevcut Durum (InventoryMedia)
- Görseller sadece ürün bağlantılı gönderilerde gösteriliyor
- InventoryMedia'dan çekiliyor (dolaylı)
- Ürün bağımlılığı var

#### ✅ Yeni Durum (PostMedia)
- Tüm gönderi tiplerinde görseller gösterilebilir
- PostMedia'dan doğrudan çekiliyor
- Ürün bağımlılığı yok
- Daha esnek ve performanslı

## ⚡ Performans Optimizasyonları

### 1. Batch Query Stratejisi

**Sorun**: Her post için ayrı query yapmak N+1 problemine yol açar.

**Çözüm**: Tüm post ID'leri için tek seferde query yapın.

```typescript
// ❌ KÖTÜ: N+1 Problem
for (const post of posts) {
  const media = await prisma.postMedia.findMany({
    where: { postId: post.id }
  });
}

// ✅ İYİ: Batch Query
const postIds = posts.map(p => p.id);
const allMedia = await prisma.postMedia.findMany({
  where: { postId: { in: postIds } },
  orderBy: { orderIndex: 'asc' }
});

// Map'e dönüştür
const mediaMap = new Map<string, PostMedia[]>();
for (const media of allMedia) {
  if (!mediaMap.has(media.postId)) {
    mediaMap.set(media.postId, []);
  }
  mediaMap.get(media.postId)!.push(media);
}
```

### 2. Index Kullanımı

Schema'da zaten doğru index'ler var:
```prisma
@@index([postId])
@@index([postId, orderIndex])
```

Bu index'ler sayesinde:
- `WHERE postId = ?` query'leri hızlı çalışır
- `ORDER BY orderIndex` sıralama hızlı yapılır

### 3. Lazy Loading vs Eager Loading

**Feed/Liste Endpoint'leri için:**
- ✅ **Eager Loading**: PostMedia'yı include ile çekin
- ✅ **Batch Query**: Tüm postlar için tek query

**Tekil Post Detay için:**
- ✅ **Eager Loading**: PostMedia'yı include ile çekin

### 4. Caching Stratejisi

**Redis Cache Kullanımı:**
```typescript
// Cache key: `post:media:${postId}`
// TTL: 1 saat (görseller sık değişmez)
```

**Ne zaman cache'i invalidate edilmeli:**
- Post silindiğinde
- PostMedia eklendiğinde
- PostMedia silindiğinde
- PostMedia sırası değiştiğinde

### 5. Pagination

**Görseller için limit:**
- Feed'de: İlk 3-5 görsel göster (lazy load ile daha fazlası)
- Detay sayfasında: Tüm görseller göster

**Query optimizasyonu:**
```typescript
// İlk 5 görseli çek
const media = await prisma.postMedia.findMany({
  where: { postId: { in: postIds } },
  orderBy: { orderIndex: 'asc' },
  take: 5 // Her post için max 5 görsel
});
```

### 6. Database Connection Pooling

PostgreSQL connection pool ayarları:
```env
DATABASE_URL=postgresql://...?connection_limit=20&pool_timeout=10
```

## 📊 Örnek Implementasyon

### Post Oluşturma

```typescript
async createFreePost(userId: string, request: CreatePostRequest) {
  // 1. Post oluştur
  const post = await this.postRepo.create({
    userId,
    type: ContentPostType.FREE,
    title: request.description,
    body: request.description,
    // ... diğer alanlar
  });

  // 2. Görselleri PostMedia'ya kaydet
  if (request.images && request.images.length > 0) {
    await this.prisma.postMedia.createMany({
      data: request.images.map((imageUrl, index) => ({
        postId: post.id,
        mediaUrl: imageUrl,
        orderIndex: index,
      })),
    });
  }

  return { id: post.id };
}
```

### Feed'de Görselleri Çekme

```typescript
async getUserFeed(userId: string) {
  // 1. Postları çek
  const posts = await this.postRepo.findMany({
    where: { /* feed koşulları */ },
    take: 20,
  });

  // 2. Batch olarak görselleri çek
  const postIds = posts.map(p => p.id);
  const allMedia = await this.prisma.postMedia.findMany({
    where: { postId: { in: postIds } },
    orderBy: { orderIndex: 'asc' },
  });

  // 3. Map'e dönüştür
  const mediaMap = new Map<string, string[]>();
  for (const media of allMedia) {
    if (!mediaMap.has(media.postId)) {
      mediaMap.set(media.postId, []);
    }
    mediaMap.get(media.postId)!.push(media.mediaUrl);
  }

  // 4. Postlara görselleri ekle
  return posts.map(post => ({
    ...post,
    images: mediaMap.get(post.id) || [],
  }));
}
```

## 🔄 Migration Stratejisi

### Mevcut Verileri Taşıma

Eğer mevcut gönderilerde InventoryMedia'dan görseller varsa:

```sql
-- InventoryMedia'dan PostMedia'ya veri taşıma
INSERT INTO post_media (id, post_id, media_url, order_index, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  cp.id,
  im.media_url,
  ROW_NUMBER() OVER (PARTITION BY im.inventory_id ORDER BY im.created_at),
  im.created_at,
  im.updated_at
FROM inventory_media im
INNER JOIN inventories inv ON inv.id = im.inventory_id
INNER JOIN content_posts cp ON cp.product_id = inv.product_id AND cp.user_id = inv.user_id
WHERE im.type = 'IMAGE';
```

## 📈 Performans Metrikleri

### Beklenen Performans

- **Batch Query**: 100 post için ~10-20ms
- **Tekil Post**: ~1-2ms
- **Cache Hit**: ~0.5ms

### Monitoring

- Query execution time
- Cache hit rate
- Database connection pool usage
- N+1 query detection

## 🎯 Sonuç

PostMedia tablosu:
- ✅ Tüm post tiplerinde görsel desteği sağlar
- ✅ Ürün bağımlılığı olmadan çalışır
- ✅ Batch query ile performanslı
- ✅ Index'ler ile optimize edilmiş
- ✅ Cache ile daha da hızlandırılabilir

