---
name: Post Context ID Analizi
overview: Tips & Tricks ve diğer post tiplerinde contextType/contextId kaynaklı backend hatalarının analizi, ID prefix/format uyumsuzluğu ve React hata gösterim hatasının çözümü için backend ve frontend aksiyonları.
todos: []
---

# Post / Product / Category / Product Group ID Analizi ve Hata Çözümleri

## 1. Olay Özeti (Terminal Hatası)

- **Endpoint:** `POST /posts/tips-and-tricks`
- **Backend hata:** `ProductGroup not found with id or externalId: pcat_01KFBPPAPD6GPRSQSH18B4PWBQ`
- **Backend stack:** `PostService.resolveProductGroupId` → `PostService.resolveContextIds` → `PostService.createTipsAndTricksPost`
- **Ek hata:** React: "Objects are not valid as a React child" — hata objesi (`{ code, message, traceId, path, stack }`) doğrudan `description` olarak kullanılıyor.

---

## 2. Frontend’de Context / ID Akışı

### 2.1 Hiyerarşi ve contextType Eşlemesi

Frontend üç seviye kullanıyor; API’ye giden `contextType` ve `contextId` buna göre set ediliyor:

| Ekran stage | ProductInfoType | API contextType | contextId kaynağı |
|-------------|-----------------|-----------------|-------------------|
| SubCategories | SUB_CATEGORY | sub_category | selectedSubCategoryId (API: subCategoryId) |
| ProductGroup | PRODUCT_GROUP | product_group | selectedProductGroupId (API: productGroupId) |
| Product | PRODUCT | product | selectedProductId (API: productId) |

Mapping: [src/features/post/types.ts](src/features/post/types.ts) — `mapProductInfoTypeToContextType()`.

### 2.2 contextId nereden geliyor?

- **CreateTipsAndTricksPostScreen:** `contextType` ve `contextId` sadece **createPostFlowStore**’dan okunuyor ([CreateTipsAndTrickPostScreen.tsx](src/features/post/screens/CreateTipsAndTrickPostScreen.tsx) ~318–334).
- Store, katalogdan “Create post” akışında dolduruluyor:
- [ProductCatalogScreen.tsx](src/features/catalog/screens/ProductCatalogScreen.tsx): `setFlowContext(contextType, contextId, productInfoSnapshot)` (örn. ~1003, 1121, 1208, 1278).
- **contextId değeri:** Catalog API’den gelen ham ID:
- SubCategory: `subCat.subCategoryId` → `id` olarak kullanılıyor ([ProductCatalogScreen.tsx](src/features/catalog/screens/ProductCatalogScreen.tsx) ~298).
- ProductGroup: `productGroup.productGroupId` → `id` ([ProductCatalogScreen.tsx](src/features/catalog/screens/ProductCatalogScreen.tsx) ~333).
- Product: `product.id` / `productId` ([ProductCatalogScreen.tsx](src/features/catalog/screens/ProductCatalogScreen.tsx) ~672, 755).

Yani **gönderilen contextId, catalog API’nin döndüğü ID (prefix dahil) ile birebir aynı.** Prefix’i frontend üretmiyor; backend/catalog servisi belirliyor.

### 2.3 Hatanın anlamı

- İstekte: `contextType: 'product_group'`, `contextId: 'pcat_01KFBPPAPD6GPRSQSH18B4PWBQ'`.
- Backend `resolveProductGroupId('pcat_01KFBPPAPD6GPRSQSH18B4PWBQ')` çağırıyor ve **product_group** tablosunda bu ID/externalId ile kayıt bulamıyor.
- **pcat_** büyük ihtimalle “product category” veya “parent category” gibi bir anlama geliyor; yani bu ID:
- Ya **sub_category** (veya üst kategori) için kullanılıyor ve product_group ile yanlış eşleştiriliyor,
- Ya da catalog ile post servisi **farklı ID formatı/prefix** kullanıyor (catalog `pcat_` döndürüyor, post servisi product_group için farklı prefix/format bekliyor).

---

## 3. Backend İçin Detaylı Analiz ve Öneriler

### 3.1 resolveProductGroupId / resolveContextIds

- **Mevcut davranış:** `contextType === 'product_group'` iken `contextId` ile product_group çözümleniyor; bulunamazsa “ProductGroup not found with id or externalId: …” hatası.
- **Kontrol edilmesi gerekenler:**

1. **ID / externalId formatı:** Catalog API’de product_group için hangi alan kullanılıyor? (örn. `productGroupId`, `id`, `externalId`.) Post tarafında product_group tablosunda hangi alan(lar) ile arama yapılıyor? `pcat_` prefix’i sizin product_group ID formatınız mı, yoksa sadece category/subcategory için mi?
2. **Tek kaynak (single source of truth):** Catalog API ile Post API aynı product_group tanımını/kaynağını mı kullanıyor? Farklı servislerde farklı ID setleri varsa, post tarafında “externalId” veya “catalog_id” benzeri bir alanla eşleme yapılması gerekebilir.
3. **Prefix / tür eşlemesi:** Backend’de ID prefix’ine göre tür ayırımı var mı? (örn. `pcat_` → category/subcategory, `pgrp_` → product_group.) Varsa, `pcat_` gelen bir ID’yi product_group olarak çözmeye çalışmamak veya önce “sub_category”/category tablosunda arayıp sonra product_group’a map etmek gerekebilir.

### 3.2 Tüm contextType’lar için tutarlı çözüm

Aynı mantık **sub_category** ve **product** için de geçerli:

- **sub_category:** `resolveSubCategoryId(contextId)` — hangi tablo, hangi alan (id / externalId / catalog subCategoryId)?
- **product:** `resolveProductId(contextId)` — product tablosunda id / externalId / catalog productId eşlemesi nasıl?
- **product_group:** `resolveProductGroupId(contextId)` — yukarıdaki gibi; özellikle `pcat_` ile gelen ID’nin kabul edilip edilmeyeceği ve hangi tabloda aranacağı netleştirilmeli.

Öneri:

- Catalog ile post servisi **aynı ID’leri** kullanmalı (aynı tablo veya aynı externalId/catalog_id eşlemesi).  
- ID prefix’i backend’de tek bir yerde (örn. “context resolver”) yorumlanıp, `contextType` ile uyumlu tabloya yönlendirme yapılmalı; yanlış türde ID ile arama yapılmamalı.

### 3.3 Hata cevabı formatı

- Şu an `error.response.data.error` tam obje dönüyor (`code`, `message`, `traceId`, `path`, `stack`).
- Frontend’de kullanıcıya sadece **string** göstermek gerektiği için, backend’in `message` alanında **okunabilir, tek satırlık** bir mesaj döndürmesi yeterli (frontend bu mesajı kullanacak).
- İsteğe bağlı: API standardında her zaman `error.message` (string) veya `error.userMessage` gibi bir alanın dolu gelmesi; böylece tüm istemciler aynı şekilde güvenebilir.

---

## 4. Frontend Düzeltmeleri

### 4.1 React “Objects are not valid as a React child” hatası

**Sebep:** [CreateTipsAndTrickPostScreen.tsx](src/features/post/screens/CreateTipsAndTrickPostScreen.tsx) catch bloğunda (satır ~527) `errorMessage = error.response.data.error` atanıyor; bu bir **obje**. Sonra bu değer `showCustomToast(..., description: errorMessage)` ile kullanılıyor; `description` React’te render edildiği için obje kabul edilmiyor.

**Çözüm:** Hata mesajını her zaman **string** yap:

- Önce `error.response?.data?.error?.message` (varsa) kullan.
- Yoksa `error.response?.data?.message`.
- Yoksa `error.message`.
- Hiçbiri yoksa genel bir string (örn. "An error occurred...").

`error.response.data.error` objesini doğrudan `errorMessage` veya `description`’a atamamak.

### 4.2 Diğer post ekranlarında aynı pattern

Aynı pattern (response’taki error objesini doğrudan göstermek) başka create post ekranlarında da varsa (CreatePostScreen, CreateQuestionPostScreen, CreateExperiencePostScreen, CreateBenchmarkPostScreen vb.) aynı mantıkla düzeltmek: kullanıcıya sadece **string** mesaj gösterilmeli.

---

## 5. Özet Tablo: Hata Noktaları ve Sorumluluk

| Konu | Nerede | Sorun | Çözüm tarafı |
|------|--------|--------|----------------|
| ProductGroup not found (pcat_...) | Backend resolveProductGroupId | contextId (pcat_...) product_group’da bulunamıyor | Backend: ID/externalId/prefix kuralı ve catalog ile uyum |
| contextType / contextId uyumsuzluğu | Catalog vs Post API | Aynı ID’nin farklı anlamda kullanılması | Backend: Tekil ID semantiği veya externalId eşlemesi |
| Hata objesinin ekranda gösterilmesi | CreateTipsAndTrickPostScreen (ve benzeri) | error.response.data.error obje; description’da kullanılıyor | Frontend: Mesajı string’e çevir (error.message vb.) |
| Yeni oluşturulan post’ta yanlış istatistikler | Feed API response | Yeni post için likes/comments vb. yanlış | Backend: Yeni post için stats sıfır veya doğru değer |
| 404 Post not found | getPostDetail | ID formatı/geçerliliği | Backend kabul ediyor; 404 için frontend’de “Post bulunamadı” ekranı mevcut |
| Envantere ürün eklenmemesi | fromInventory yanlış true | Katalogdan “own” seçilince fromInventory: true gönderiliyordu | Frontend’de düzeltildi (fromInventory: false) |

---

## 6. Backend’e İletilebilecek Kısa Özet

1. **Tips & Tricks hatası:** `POST /posts/tips-and-tricks` ile `contextType: product_group`, `contextId: pcat_01KFBPPAPD6GPRSQSH18B4PWBQ` gönderiliyor. Backend “ProductGroup not found” dönüyor. contextId, catalog API’den gelen productGroupId ile birebir; yani ya catalog product_group ID’leri `pcat_` prefix’i ile dönüyor ya da bu ID aslında sub_category/category. Backend’de:

- Product_group tablosunda `pcat_` ile başlayan ID’ler / externalId’ler kabul ediliyor mu?
- Catalog ile post servisi aynı product_group kaynağını mı kullanıyor?

2. **Genel:** Tüm post create endpoint’lerinde `resolveContextIds` (veya benzeri) sub_category, product_group, product için **aynı ID formatı ve kaynağı** ile çalışmalı; ID prefix’i ile context türü tutarlı olmalı.
3. **Hata cevabı:** `error` objesi yerine kullanıcıya gösterilecek tek bir `message` (string) alanı sağlanmalı.

Bu analiz ve öneriler hem mevcut Tips & Tricks hatasını hem de “post / product / category / subcategory / product group” yapısında ID ile ilgili diğer hataları önlemek için kullanılabilir.