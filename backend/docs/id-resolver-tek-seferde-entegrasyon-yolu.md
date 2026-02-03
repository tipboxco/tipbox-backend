# ID Resolver – Tek seferde kalıcı entegrasyon yolu

Bu doküman, **Medusa ID Resolver** planı ile mobil taraftaki **Post Context ID Analizi** sonuçlarını birleştirir ve tek seferde kalıcı bir yapı için izlenecek yolu netleştirir.

**İlgili planlar:**
- Medusa ID Resolver Entegrasyonu (Cursor plan)
- [Post Context ID Analizi](../post_context_id_analizi_080778c9.plan.md)

---

## 0. Medusa = tek tablo (categories), Product = ayrı tablo — Doğrulama ve tek id stratejisi

### Veritabanı yapısı (şema özeti)

- **categories** (tek tablo): `id`, `parent_id`, `name`, `level`, `metadata`, … — Hiyerarşi `parentId` ile; main category, sub category ve product group seviyeleri bu tabloda düğüm olarak tutulabilir (Medusa sync buna göre).
- **products**: Ayrı tablo; `id`, `category_id` (→ categories), `group_id` (→ product_groups), …

Şemada ayrıca **main_categories**, **sub_categories**, **product_groups** tabloları da var; bunlar ileride Medusa dışı modda contextId ile kullanılmak üzere. **Şimdilik Medusa kullanıldığı için** category / subcategory / product group bilgisi tek tabloda (**categories**) kabul edilir; product ayrı tablodadır.

**Doğrulama (isteğe bağlı):** Aynı yapıyı canlı veride görmek için:

```bash
docker compose exec <db_service> psql -U <user> -d <dbname> -c "SELECT id, parent_id, name, level FROM categories LIMIT 20;"
```

Beklenen: `id` (örn. pcat_*, mcat_*, scat_*), `parent_id`, `name`, `level` ile hiyerarşik yapı.

### Şimdilik tek id üzerinden gitmek (Medusa modu)

- **contextId** bugün ayrı tablolardaki id’leri (product group, subcategory vb.) tutmak için kullanılıyor; ileride Medusa yerine bu tablolar kullanılınca yine aynı mantık devreye girecek.
- **Medusa varken:** Tüm category / subcategory / product group seviyeleri **tek tabloda (categories)** olduğu için **tek id** yeterli: **contextId = categories.id**.
- **Çözümleme:** `contextType` ne olursa olsun (sub_category, product_group, vb.), gelen **contextId** sadece **categories** tablosunda aranır (id, metadata->externalId/medusaId). Bulunan değer = **categories.id**.
- **ContentPost’a yazma:** Medusa modunda **categoryId = çözümlenen categories.id** set edilir. **mainCategoryId, subCategoryId, productGroupId** şimdilik **doldurulmayabilir (null)**; ileride ayrı tablolar kullanılmaya başlanınca contextId yine bu alanlara çözümlenir.
- **Request/response’lardan contextType ve contextId kaldırılmaz.** API sözleşmesi aynı kalır; sadece backend’de çözümleme “tek id = categories.id” olur. İleride Medusa’dan çıkılınca contextId yine main_categories / sub_categories / product_groups id’leri için kullanılabilir.

---

## 1. Mobil analizden çıkanlar

- **Tips & Tricks hatası:** `POST /posts/tips-and-tricks` ile `contextType: product_group`, `contextId: pcat_01KFBPPAPD6GPRSQSH18B4PWBQ` gönderiliyor; backend "ProductGroup not found" dönüyor. **contextId, Catalog API'den dönen productGroupId ile birebir.** Yani Catalog'da product group = `categories` tablosundaki düğüm; **productGroupId = categories.id** (pcat_ prefix'i buradan geliyor).
- **İki farklı model:** Catalog hiyerarşisi **Category** tablosunda (id, parentId); Post tarafı **MainCategory / SubCategory / ProductGroup** ayrı tablolarda. Aynı contextId (pcat_xxx) Catalog'da `categories.id`, Post'ta ise **ProductGroup.id** (UUID) bekleniyor; bu yüzden **Category → ProductGroup eşlemesi** zorunlu.
- **Öneri:** Catalog ile Post aynı ID semantiğini kullansın; ID çözümlemesi tek yerde (IdResolver), contextType'a göre doğru tabloya yönlendirilsin.

---

## 2. Medusa modunda contextId çözümlemesi (tek id = categories.id)

**Şimdilik Medusa kullanıldığı için** category / subcategory / product group tek tabloda (categories). Bu yüzden:

- **sub_category** veya **product_group** (veya üst seviye category) için gelen **contextId** doğrudan **categories** tablosunda aranır; bulunan id = **categories.id**.
- **Çözümleme sırası:** 1) **categories.id** ile ara (pcat_xxx vb.), 2) **categories.metadata->>'externalId'** ve **metadata->>'medusaId'** ile ara. Bulunursa bu **categories.id** döner; ContentPost’ta **categoryId** bu değerle set edilir.
- **ContentPost:** Medusa modunda **categoryId = çözümlenen categories.id** yeterli; **mainCategoryId, subCategoryId, productGroupId** null bırakılabilir (ileride Medusa dışı modda bu alanlar contextId ile doldurulacak).

**İleride Medusa dışı mod:** contextId yine sub_category / product_group için kullanılacak; o zaman resolveSubCategoryId / resolveProductGroupId ile **main_categories / sub_categories / product_groups** tablolarında arama yapılıp ContentPost.mainCategoryId / subCategoryId / productGroupId doldurulabilir. Şu an bu adım atlanır; tek id (categories.id) üzerinden gidilir.

**Bulunamama:** contextId categories’ta yoksa net hata (örn. "Category not found: …") fırlatılır.

---

## 3. contextType / contextId tutarlılığı

Post create (Tips & Tricks, Question, vb.) isteklerinde **contextType + contextId** geliyor. Backend zaten contextType'a göre ilgili resolver'ı çağırıyor:
- sub_category → resolveSubCategoryId  
- product_group → resolveProductGroupId  
- product → resolveProductId  

Tek yapılacak: **tüm bu resolver'lar tek IdResolverService'te toplanacak** ve aynı kurallar (Catalog = Category tablosu, Post = MainCategory/SubCategory/ProductGroup) uygulanacak. Böylece "aynı ID formatı ve kaynağı" mobil analizdeki öneriyle uyumlu olur.

---

## 4. Hata cevabı formatı (mobil React hatası için)

Mobil analiz: `error.response.data.error` obje olarak kullanılıyor → "Objects are not valid as a React child".

**Backend tarafı:** Tüm API hata cevaplarında kullanıcıya gösterilecek **tek bir string** alan sağlanmalı (örn. `message`). Global error handler'da dönen JSON'da `message` (string) her zaman dolu olsun; obje (`code`, `traceId`, `path`, `stack`) ayrı alanlarda kalsın. Frontend tek satırda `error.response?.data?.message` veya `error.response?.data?.error?.message` kullanabilsin.

---

## 5. Tek seferde kalıcı entegrasyon sırası

| Sıra | Adım | Açıklama |
|------|------|----------|
| 1 | **IdResolverService oluştur** | Tüm resolve* mantığı tek dosyada. **Medusa modu:** sub_category / product_group için **resolveCategoryId(contextId)** — sadece categories tablosunda id / metadata ile ara; dönüş = categories.id. Product için resolveProductId ayrı (products tablosu). |
| 2 | **PostService / resolveContextIds** | contextType sub_category veya product_group iken contextId’yi **IdResolver.resolveCategoryId** ile çöz; dönüşü **ContentPost.categoryId** olarak yaz; mainCategoryId, subCategoryId, productGroupId şimdilik null. contextType product iken resolveProductId; productId set et. **contextType ve contextId request/response’dan kaldırılmaz.** |
| 3 | **Inventory, Catalog, Brand entegrasyonu** | IdResolver’ı bu servislere enjekte et; productId / categoryId / brandId girişlerini resolve et. |
| 4 | **Hata cevabı standardı** | Global error handler’da `message` (string) alanını garanti et. |
| 5 | **Doğrulama / Test** | İstenirse `docker compose exec … psql -c "SELECT id, parent_id, name, level FROM categories LIMIT 20;"` ile categories yapısını doğrula. `POST /posts/tips-and-tricks` ile contextType: product_group, contextId: pcat_xxx gönderip 200 ve post oluşumu (ContentPost.categoryId = pcat_xxx veya ilgili categories.id). |

Bu sıra ile Medusa modunda tek id (categories.id) üzerinden gidilir; contextType/contextId API’da kalır; ileride Medusa dışı modda aynı alanlar main_categories / sub_categories / product_groups id’leri için kullanılabilir.
