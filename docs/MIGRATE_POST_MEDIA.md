# PostMedia Migration Rehberi

## 📋 Genel Bakış

Bu rehber, InventoryMedia tablosundaki post görsellerini PostMedia tablosuna taşıma sürecini açıklar.

## 🎯 Sorun

Şu anda hem inventory görselleri hem de post görselleri `InventoryMedia` tablosunda tutuluyor. Bu durum:
- ❌ Post görsellerini ayırt etmeyi zorlaştırıyor
- ❌ Ürün bağımlılığı oluşturuyor
- ❌ Performans sorunlarına yol açabiliyor

## ✅ Çözüm

Post görsellerini `PostMedia` tablosuna taşıyoruz.

## 🔄 Migration Stratejisi

### 1. Yeni Post'lar için

**Artık tüm yeni post'larda görseller direkt PostMedia'ya kaydedilecek:**

```typescript
// Post oluşturulurken
await prisma.postMedia.createMany({
  data: images.map((imageUrl, index) => ({
    postId: post.id,
    userId: userId,
    mediaUrl: imageUrl,
    orderIndex: index,
  })),
});
```

### 2. Mevcut Veriler için

**Mevcut InventoryMedia'daki post görsellerini taşımak için iki yaklaşım:**

#### Yaklaşım A: Otomatik Migration (Önerilen)

```bash
# Migration script'i çalıştır
docker-compose exec backend npx ts-node scripts/migrate-post-media-from-inventory.ts
```

**Bu script:**
- ProductId'si olan postları bulur
- Post'un userId ve productId'si ile eşleşen inventory'yi bulur
- Post oluşturulduktan sonra eklenen görselleri PostMedia'ya taşır
- Zaten PostMedia'da olan görselleri atlar

#### Yaklaşım B: Manuel SQL Migration

Eğer daha kontrollü bir yaklaşım istiyorsanız:

```sql
-- 1. Önce backup alın!
-- pg_dump -t inventory_media > backup_inventory_media.sql

-- 2. PostMedia'ya veri taşıma
INSERT INTO post_media (id, post_id, user_id, media_url, order_index, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  cp.id,
  cp.user_id,
  im.media_url,
  ROW_NUMBER() OVER (PARTITION BY cp.id ORDER BY im.created_at),
  im.created_at,
  im.updated_at
FROM inventory_media im
INNER JOIN inventories inv ON inv.id = im.inventory_id
INNER JOIN content_posts cp ON 
  cp.product_id = inv.product_id 
  AND cp.user_id = inv.user_id
  AND im.created_at >= cp.created_at  -- Post'tan sonra eklenen görseller
WHERE im.type = 'IMAGE'
  AND NOT EXISTS (
    SELECT 1 FROM post_media pm 
    WHERE pm.post_id = cp.id AND pm.media_url = im.media_url
  );
```

## ⚠️ Dikkat Edilmesi Gerekenler

### 1. Hangi Görseller Post İçin?

**Sorun:** InventoryMedia'da hangi görsellerin post için olduğunu kesin bilemeyiz.

**Çözüm:**
- Post oluşturulduktan sonra eklenen görselleri taşıyoruz
- Bu mantıklı çünkü post oluşturulduktan sonra eklenen görseller muhtemelen post için eklenmiştir

### 2. Inventory Görselleri

**Önemli:** Inventory görselleri InventoryMedia'da kalacak. Sadece post görselleri taşınacak.

**Nasıl ayırt edilir:**
- Post görselleri: Post oluşturulduktan sonra eklenen ve PostMedia'ya taşınan
- Inventory görselleri: Post'tan önce eklenen veya post ile ilgisi olmayan

### 3. Veri Tutarlılığı

**PostMedia'ya taşıdıktan sonra:**
- InventoryMedia'daki görselleri silmeyin (inventory için gerekli olabilir)
- PostMedia'daki görselleri kullanın
- Eğer bir görsel hem inventory hem post için kullanılıyorsa, her iki tabloda da kalabilir

## 📊 Migration Sonrası

### 1. Kod Güncellemeleri

**Post oluşturma servislerini güncelleyin:**

```typescript
// ❌ ESKİ: InventoryMedia'ya ekleme
await prisma.inventoryMedia.create({
  data: {
    inventoryId: inventory.id,
    mediaUrl: imageUrl,
    type: 'IMAGE',
  },
});

// ✅ YENİ: PostMedia'ya ekleme
await prisma.postMedia.create({
  data: {
    postId: post.id,
    userId: userId,
    mediaUrl: imageUrl,
    orderIndex: index,
  },
});
```

### 2. Feed Servislerini Güncelleyin

**InventoryMedia yerine PostMedia kullanın:**

```typescript
// ❌ ESKİ: InventoryMedia'dan çekme
const inventoryMedia = await prisma.inventory.findMany({
  where: { userId, productId: { in: productIds } },
  include: { media: true },
});

// ✅ YENİ: PostMedia'dan çekme
const postMedia = await prisma.postMedia.findMany({
  where: { postId: { in: postIds } },
  orderBy: { orderIndex: 'asc' },
});
```

### 3. Test

Migration sonrası test edin:
- ✅ Post oluşturma çalışıyor mu?
- ✅ Feed'de görseller görünüyor mu?
- ✅ Post detay sayfasında görseller var mı?
- ✅ Inventory görselleri hala InventoryMedia'da mı?

## 🔍 Doğrulama

### Migration başarılı mı kontrol edin:

```sql
-- PostMedia'da kaç görsel var?
SELECT COUNT(*) FROM post_media;

-- Hangi postların görselleri var?
SELECT post_id, COUNT(*) as media_count 
FROM post_media 
GROUP BY post_id 
ORDER BY media_count DESC 
LIMIT 10;

-- InventoryMedia'da hala görsel var mı?
SELECT COUNT(*) FROM inventory_media WHERE type = 'IMAGE';
```

## 🎯 Sonuç

Migration sonrası:
- ✅ Post görselleri PostMedia'da
- ✅ Inventory görselleri InventoryMedia'da
- ✅ Daha temiz ve performanslı yapı
- ✅ Ürün bağımlılığı yok
