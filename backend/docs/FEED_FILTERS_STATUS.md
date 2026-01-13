# Feed Filtreleri Durum Raporu

## ✅ Çalışan Filtreler

### 1. İlgi Alanı (Interests) ✅
**Endpoint:** `GET /feed/filtered?interests=category-id-1,category-id-2`

**Nasıl Çalışıyor:**
- `interests` parametresi kategori ID'leri array olarak alınıyor
- Category ve interests birleştiriliyor
- `mainCategoryId` ve `subCategoryId` alanlarında filtreleme yapılıyor

**Kod:**
```typescript
// Merge category + interests into a single category filter
const mergedCategoryIds = new Set<string>();
if (filters.category) {
  mergedCategoryIds.add(filters.category);
}
if (filters.interests && filters.interests.length > 0) {
  filters.interests.forEach((id) => mergedCategoryIds.add(id));
}

if (mergedCategoryIds.size > 0) {
  const categoryArray = Array.from(mergedCategoryIds);
  postWhere.OR = [
    { mainCategoryId: { in: categoryArray } },
    { subCategoryId: { in: categoryArray } },
  ];
}
```

### 2. Etiket (Tags) ✅
**Endpoint:** `GET /feed/filtered?tags=Review,Benchmark,Tips`

**Nasıl Çalışıyor:**
- `tags` parametresi string array olarak alınıyor
- `contentPostTags` ve `tags` ilişkilerinde arama yapılıyor
- Her iki tabloda da tag eşleşmesi aranıyor

**Kod:**
```typescript
if (filters.tags && filters.tags.length > 0) {
  (postWhere.AND ||= []).push({
    OR: [
      { contentPostTags: { some: { tag: { in: filters.tags } } } },
      { tags: { some: { tag: { in: filters.tags } } } },
    ],
  });
}
```

**Desteklenen Tag'ler:**
- Review
- Benchmark
- Tips
- Question
- Experience
- Update

### 3. Kategori (Category) ✅
**Endpoint:** `GET /feed/filtered?category=category-id`

**Nasıl Çalışıyor:**
- `category` parametresi tek bir kategori ID alıyor
- Interests ile birleştiriliyor
- `mainCategoryId` ve `subCategoryId` alanlarında filtreleme yapılıyor

### 4. Sırala (Sort) ✅
**Endpoint:** `GET /feed/filtered?sort=recent` veya `?sort=top`

**Nasıl Çalışıyor:**

**Recent (En Yeni):**
```typescript
orderBy: [
  { post: { isBoosted: 'desc' } },
  { post: { createdAt: 'desc' } },
]
```
- Boost edilmiş postlar önce
- Sonra oluşturulma tarihine göre (yeni → eski)

**Top (En Popüler):**
```typescript
orderBy: [
  { post: { likesCount: 'desc' } },
  { post: { viewsCount: 'desc' } },
  { post: { createdAt: 'desc' } },
]
```
- Önce beğeni sayısına göre (yüksek → düşük)
- Sonra görüntülenme sayısına göre
- Son olarak oluşturulma tarihine göre

**Database Alanları:**
- `likesCount` ✅ (ContentPost tablosunda mevcut)
- `viewsCount` ✅ (ContentPost tablosunda mevcut)
- `commentsCount` ✅ (mevcut ama sort'ta kullanılmıyor)
- `favoritesCount` ✅ (mevcut ama sort'ta kullanılmıyor)

## 📊 Örnek Kullanım

### Tüm Filtreler Birlikte
```bash
GET /feed/filtered?interests=cat1,cat2&tags=Review,Benchmark&category=cat3&sort=top&limit=20&cursor=feed-id
```

### Sadece İlgi Alanı
```bash
GET /feed/filtered?interests=category-id-1,category-id-2
```

### Sadece Etiket
```bash
GET /feed/filtered?tags=Review,Tips
```

### Sadece Kategori
```bash
GET /feed/filtered?category=category-id
```

### Sadece Sıralama
```bash
GET /feed/filtered?sort=top
```

## 🔍 Test Senaryoları

### Test 1: İlgi Alanı Filtresi
```bash
curl -X GET "http://localhost:3000/feed/filtered?interests=6120f25d-bdfc-44bf-ba32-a5bc29156c35" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 2: Etiket Filtresi
```bash
curl -X GET "http://localhost:3000/feed/filtered?tags=Review,Benchmark" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 3: Kategori Filtresi
```bash
curl -X GET "http://localhost:3000/feed/filtered?category=6120f25d-bdfc-44bf-ba32-a5bc29156c35" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 4: Sıralama (Top)
```bash
curl -X GET "http://localhost:3000/feed/filtered?sort=top" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 5: Tüm Filtreler
```bash
curl -X GET "http://localhost:3000/feed/filtered?interests=cat1&tags=Review&category=cat2&sort=top&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ✅ Sonuç

Tüm filtreler çalışıyor:
- ✅ İlgi Alanı (Interests) - Category ID'leri ile filtreleme
- ✅ Etiket (Tags) - Post tag'leri ile filtreleme
- ✅ Kategori (Category) - Tek kategori ile filtreleme
- ✅ Sırala (Sort) - Recent ve Top seçenekleri

## 📝 Notlar

1. **Interests ve Category Birleşimi**: Interests ve category aynı mantıkla çalışıyor (ikisi de kategori ID'leri)
2. **Tag Filtreleme**: Hem `contentPostTags` hem de `tags` tablolarında arama yapılıyor
3. **Sort Mantığı**: 
   - `recent`: Boost → Tarih
   - `top`: Beğeni → Görüntülenme → Tarih
4. **Pagination**: Cursor-based pagination destekleniyor

