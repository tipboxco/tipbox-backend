# 🔍 Search Inputs Analizi ve Backend Endpoint Talepleri

## 📊 Özet

Uygulamadaki tüm search inputları analiz edildi. Aşağıda endpoint bağlantı durumları ve backend'den talep edilmesi gereken endpoint'ler listelenmiştir.

---

## ✅ Endpoint Bağlı Search Inputlar

### 1. **SearchModal** (`src/components/SearchModal/index.tsx`)
- **Endpoint**: ✅ `/search` (GET)
- **Hook**: `useSearch` (`src/features/search/api/hooks.ts`)
- **Durum**: ✅ Çalışıyor
- **Arama Tipi**: Users, Brands, Products (multi-type search)
- **Parametreler**: `keyword`, `types`, `limit`
- **Not**: Genel arama modal'ı, tüm tiplerde arama yapabiliyor

### 2. **ProductCatalogScreen** (`src/features/catalog/screens/ProductCatalogScreen.tsx`)
- **Endpoint**: ✅ `/catalog/products/search` (GET)
- **Hook**: `useGlobalProductSearch` (`src/features/catalog/api/hooks.ts`)
- **Durum**: ✅ Çalışıyor
- **Arama Tipi**: Global product search (tüm product group'lar arasında)
- **Parametreler**: `search` (product name), `cursor`, `limit`
- **Not**: Infinite scroll destekli, product group bazında gruplanmış sonuçlar

### 3. **BrandScreen** (`src/features/catalog/screens/BrandScreen.tsx`)
- **Endpoint**: ✅ `/brands/search` (GET)
- **Hook**: `useGlobalBrandSearch` (`src/features/catalog/api/hooks.ts`)
- **Durum**: ✅ Çalışıyor
- **Arama Tipi**: Global brand search (tüm brand kategorileri arasında)
- **Parametreler**: `search` (brand name), `cursor`, `limit`
- **Not**: Infinite scroll destekli, category bazında gruplanmış sonuçlar

### 4. **InboxScreen → MessagesScreen** (`src/features/inbox/screens/InboxScreen.tsx`)
- **Endpoint**: ✅ `/inbox/messages` (GET)
- **Hook**: `useMessages` (`src/features/inbox/api/hooks.ts`)
- **Durum**: ✅ Çalışıyor
- **Arama Tipi**: Message search (username ve son mesaj bazlı)
- **Parametreler**: `search` (username veya message content)
- **Not**: Search query MessagesScreen'e prop olarak geçiliyor ve API'ye gönderiliyor

### 5. **Trust_TrusterListScreen** (`src/features/profile/screens/Trust_TrusterListScreen.tsx`)
- **Endpoint**: ✅ `/profile/{userId}/trust` ve `/profile/{userId}/truster` (GET)
- **Hook**: `useTrustList`, `useTrusterList` (`src/features/profile/api/hooks.ts`)
- **Durum**: ✅ Çalışıyor
- **Arama Tipi**: 
  - Trust tab: Backend'de search yapılıyor (API'ye search parametresi gönderiliyor)
  - Truster tab: Frontend'de filtreleme yapılıyor (name ve title bazlı)
- **Parametreler**: 
  - Trust: `search` (user name)
  - Truster: `search` (user name), `sort` (date_desc, date_asc)
- **Not**: Trust tab'ında backend search, Truster tab'ında frontend filtreleme var

---

## ❌ Endpoint Bağlı OLMAYAN Search Inputlar

### 1. **ExploreScreen** (`src/features/explore/screens/ExploreScreen.tsx`)
- **Endpoint**: ❌ Yok
- **Durum**: Sadece state var (`searchQuery`), API çağrısı yok
- **Placeholder**: "Select product group or search product name"
- **Kullanım**: `debouncedSearchQuery` HottestTab ve NewsTab'a prop olarak geçiliyor
- **Sorun**: 
  - Search query state'i var ama endpoint bağlantısı yok
  - HottestTab ve NewsTab component'lerinde search query kullanılmıyor
- **Backend Talebi**: 
  - **Endpoint**: `/explore/hottest/search` veya `/explore/news/search`
  - **Parametreler**: `q` (search query), `cursor`, `limit`
  - **Açıklama**: Explore ekranında Hottest ve News tab'larında post/product araması yapılabilmeli

### 2. **EventsScreen** (`src/features/events/screens/EventsScreen.tsx`)
- **Endpoint**: ❌ Yok
- **Durum**: Sadece state var (`searchQuery`), API çağrısı yok
- **Placeholder**: "Select product group or search product name" (yanlış placeholder)
- **Kullanım**: Search query hiçbir yere geçilmiyor
- **Sorun**: 
  - Search query state'i var ama kullanılmıyor
  - CommunityTab ve AchievementTab'a search query prop'u geçilmiyor
  - Placeholder yanlış (product group değil, event araması olmalı)
- **Backend Talebi**: 
  - **Endpoint**: `/events/search` veya `/events/community/search` ve `/events/achievement/search`
  - **Parametreler**: `q` (search query), `type` (community/achievement), `cursor`, `limit`
  - **Açıklama**: Events ekranında Community Events ve Achievement Ladder'da event araması yapılabilmeli

### 3. **CatalogScreen (Brand-Catalog Mode)** (`src/features/catalog/screens/CatalogScreen.tsx`)
- **Endpoint**: ⚠️ Kısmen bağlı
- **Durum**: Search query BrandScreen'e prop olarak geçiliyor, BrandScreen'de endpoint bağlı
- **Placeholder**: "Search brand or category"
- **Kullanım**: `searchQuery` state'i BrandScreen'e prop olarak geçiliyor
- **Not**: Aslında BrandScreen'de endpoint bağlı olduğu için bu search çalışıyor, ama CatalogScreen'de direkt endpoint yok
- **Durum**: ✅ Çalışıyor (BrandScreen üzerinden)

---

## 🔧 Backend'den Talep Edilmesi Gereken Endpoint'ler

### 1. **Explore Screen Search Endpoint**

**Endpoint**: `GET /explore/search`

**Parametreler**:
- `q` (string, required): Arama terimi
- `type` (string, optional): `hottest` | `news` (default: `hottest`)
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına item sayısı (default: 20, max: 50)

**Response**:
```typescript
{
  items: Array<{
    id: string;
    type: 'post' | 'product' | 'brand';
    title: string;
    content?: string;
    image?: string;
    // ... diğer alanlar
  }>;
  pagination: {
    cursor?: string;
    hasMore: boolean;
  };
}
```

**Açıklama**: Explore ekranında Hottest ve News tab'larında arama yapılabilmeli. Post, product ve brand sonuçları döndürmeli.

---

### 2. **Events Screen Search Endpoint**

**Endpoint**: `GET /events/search`

**Parametreler**:
- `q` (string, required): Arama terimi
- `type` (string, optional): `community` | `achievement` (default: `community`)
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına item sayısı (default: 20, max: 50)

**Response**:
```typescript
{
  items: Array<{
    id: string;
    name: string;
    description?: string;
    image?: string;
    startDate?: string;
    endDate?: string;
    // ... diğer event alanları
  }>;
  pagination: {
    cursor?: string;
    hasMore: boolean;
  };
}
```

**Açıklama**: Events ekranında Community Events ve Achievement Ladder'da event araması yapılabilmeli.

---

## 📝 Öneriler ve İyileştirmeler

### 1. **ExploreScreen Search Implementation**
- `HottestTab` ve `NewsTab` component'lerine `searchQuery` prop'u eklenmeli
- Backend endpoint hazır olana kadar frontend'de filtreleme yapılabilir (geçici çözüm)
- Placeholder metni düzeltilmeli: "Search posts, products, or brands"

### 2. **EventsScreen Search Implementation**
- `CommunityTab` ve `AchievementTab` component'lerine `searchQuery` prop'u eklenmeli
- Placeholder metni düzeltilmeli: "Search events"
- Backend endpoint hazır olana kadar frontend'de filtreleme yapılabilir (geçici çözüm)

### 3. **Trust_TrusterListScreen Truster Tab**
- Şu anda Truster tab'ında frontend filtreleme yapılıyor
- Backend'den search desteği gelirse, `useTrusterList` hook'una search parametresi eklenebilir
- Şu anki durum: ✅ Çalışıyor (frontend filtreleme ile)

### 4. **Search Query Debouncing**
- Tüm search inputlarında 500ms debounce kullanılıyor ✅
- Bu performans için yeterli

### 5. **Search Query State Management**
- Search query'ler genellikle local state'te tutuluyor ✅
- Global state'e ihtiyaç yok (her ekran kendi search'ünü yönetiyor)

---

## 🎯 Öncelik Sırası

1. **Yüksek Öncelik**: 
   - EventsScreen search endpoint (kullanıcılar event aramak isteyebilir)
   
2. **Orta Öncelik**: 
   - ExploreScreen search endpoint (keşfet ekranında arama önemli)

3. **Düşük Öncelik**: 
   - Trust_TrusterListScreen Truster tab backend search (şu anda frontend filtreleme çalışıyor)

---

## ✅ Sonuç

- **Toplam Search Input**: 8 adet
- **Endpoint Bağlı**: 5 adet ✅
- **Endpoint Bağlı Değil**: 2 adet ❌ (ExploreScreen, EventsScreen)
- **Kısmen Bağlı**: 1 adet ⚠️ (CatalogScreen - BrandScreen üzerinden çalışıyor)

**Backend'den Talep Edilmesi Gereken Endpoint Sayısı**: 2 adet
1. `/explore/search` - Explore ekranı için
2. `/events/search` - Events ekranı için
