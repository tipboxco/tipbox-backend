# Filtreleme Endpoint'leri - Detaylı Analiz ve Geliştirme Planı

## 📊 Mevcut Durum Analizi

### 1. NotificationsScreen
**Mevcut:**
- ✅ `GET /notifications` - limit, offset, unreadOnly parametreleri var
- ❌ **Eksik:** Type/Category filtering

**Geliştirme Gereksinimleri:**
- `type` parametresi ekle (NotificationType enum değerleri)
- `category` parametresi ekle (NotificationCategory enum değerleri)
- Repository ve service katmanında filtreleme mantığı

### 2. MessagesScreen
**Mevcut:**
- ✅ `GET /messages` - search, unreadOnly, limit parametreleri var
- ❌ **Eksik:** Category filtering (DM, SUPPORT)

**Geliştirme Gereksinimleri:**
- `category` veya `threadType` parametresi ekle
- DM ve SUPPORT thread'lerini filtreleme

### 3. Trust_TrusterListScreen
**Mevcut:**
- ✅ `GET /users/:id/trusters` - q (search) parametresi var
- ❌ **Eksik:** Sort parametresi

**Geliştirme Gereksinimleri:**
- `sort` parametresi ekle (name_asc, name_desc, date_asc, date_desc, trusted_first)
- Repository'de sıralama mantığı

### 4. ExploreScreen
**Mevcut:**
- ✅ `GET /explore/hottest` - cursor, limit var
- ✅ `GET /explore/events` - cursor, limit var
- ✅ `GET /explore/brands/new` - cursor, limit var
- ❌ **Eksik:** Search parametresi

**Geliştirme Gereksinimleri:**
- Her endpoint'e `search` parametresi ekle
- Post title/body, event title/description, brand name'de arama

### 5. MarketPlaceScreen
**Mevcut:**
- ✅ `GET /marketplace/listings` - search, type, rarity, minPrice, maxPrice, orderBy var
- ⚠️ **Kontrol:** Endpoint çalışıyor mu?

**Geliştirme Gereksinimleri:**
- Mevcut filtrelerin çalıştığını doğrula
- Gerekirse iyileştirme yap

### 6. ProductCatalogScreen
**Mevcut:**
- ✅ `GET /catalog/categories` - Kategorileri listele
- ✅ `GET /catalog/categories/:categoryId/sub-categories` - Sub kategoriler
- ✅ `GET /catalog/sub-categories/:subCategoryId/product-groups` - Product groups
- ✅ `GET /catalog/product-groups/:productGroupId/products` - Products
- ❌ **Eksik:** Search parametresi

**Geliştirme Gereksinimleri:**
- Product listesi endpoint'ine `search` parametresi ekle
- Product name, brand, description'da arama

---

## 🎯 Geliştirme Planı

### Öncelik Sırası:
1. **NotificationsScreen** - Type filtering (Yüksek öncelik)
2. **MessagesScreen** - Category filtering (Yüksek öncelik)
3. **Trust_TrusterListScreen** - Sort (Orta öncelik)
4. **ExploreScreen** - Search (Orta öncelik)
5. **ProductCatalogScreen** - Search (Düşük öncelik)
6. **MarketPlaceScreen** - Kontrol ve iyileştirme (Düşük öncelik)

---

## 📝 Detaylı Filtreleme Mantıkları

### 1. Notifications - Type Filtering

**Endpoint:** `GET /notifications`

**Yeni Parametreler:**
- `type` (string, optional): NotificationType enum değeri
  - Örnek: `POST_LIKED`, `NEW_MESSAGE`, `NEW_TRUSTER`, vb.
- `category` (string, optional): NotificationCategory enum değeri
  - Örnek: `POST`, `TRUST`, `MESSAGE`, `SUPPORT`, vb.

**Filtreleme Mantığı:**
```typescript
where: {
  userId,
  ...(unreadOnly && { read: false }),
  ...(type && { type }),
  ...(category && { 
    type: {
      in: getNotificationTypesByCategory(category)
    }
  })
}
```

### 2. Messages - Category Filtering

**Endpoint:** `GET /messages`

**Yeni Parametreler:**
- `threadType` (string, optional): `DM` | `SUPPORT` | `ALL`
  - Default: `ALL`

**Filtreleme Mantığı:**
```typescript
where: {
  ...(threadType === 'DM' && { isSupportThread: false }),
  ...(threadType === 'SUPPORT' && { isSupportThread: true })
}
```

### 3. Trust_TrusterList - Sort

**Endpoint:** `GET /users/:id/trusters`

**Yeni Parametreler:**
- `sort` (string, optional): 
  - `name_asc` - İsme göre A-Z
  - `name_desc` - İsme göre Z-A
  - `date_asc` - Trust tarihine göre eski-yeni
  - `date_desc` - Trust tarihine göre yeni-eski
  - `trusted_first` - Önce trust edilenler
  - Default: `date_desc`

**Sıralama Mantığı:**
```typescript
orderBy: {
  ...(sort === 'name_asc' && { displayName: 'asc' }),
  ...(sort === 'name_desc' && { displayName: 'desc' }),
  ...(sort === 'date_asc' && { trustRelation: { createdAt: 'asc' } }),
  ...(sort === 'date_desc' && { trustRelation: { createdAt: 'desc' } })
}
```

### 4. Explore - Search

**Endpoint'ler:**
- `GET /explore/hottest?search=...`
- `GET /explore/events?search=...`
- `GET /explore/brands/new?search=...`

**Yeni Parametreler:**
- `search` (string, optional): Arama terimi

**Filtreleme Mantığı:**
```typescript
// Hottest posts
where: {
  OR: [
    { title: { contains: search, mode: 'insensitive' } },
    { body: { contains: search, mode: 'insensitive' } }
  ]
}

// Events
where: {
  OR: [
    { title: { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } }
  ]
}

// Brands
where: {
  name: { contains: search, mode: 'insensitive' }
}
```

### 5. ProductCatalog - Search

**Endpoint:** `GET /catalog/product-groups/:productGroupId/products`

**Yeni Parametreler:**
- `search` (string, optional): Product name, brand veya description'da arama

**Filtreleme Mantığı:**
```typescript
where: {
  productGroupId,
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { brand: { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } }
  ]
}
```

---

## 🔧 Implementation Checklist

- [ ] Notification repository'ye type/category filtering ekle
- [ ] Notification service'e type/category filtering ekle
- [ ] Notification router'a type/category query parametreleri ekle
- [ ] Messages service'e threadType filtering ekle
- [ ] Messages router'a threadType query parametresi ekle
- [ ] User service'e listTrusters sort parametresi ekle
- [ ] User router'a sort query parametresi ekle
- [ ] Explore service'lere search parametresi ekle
- [ ] Explore router'lara search query parametresi ekle
- [ ] Catalog service'e product search ekle
- [ ] Catalog router'a search query parametresi ekle
- [ ] Marketplace endpoint'lerini test et ve iyileştir
- [ ] Tüm endpoint'leri Swagger'a dokümante et
- [ ] Test yaz (opsiyonel)

