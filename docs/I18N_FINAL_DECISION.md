# i18n Strateji Karşılaştırması ve Final Karar

## Karşılaştırılan İki Yaklaşım

| | **A: Full Bundle + ETag** | **B: Manifest + Namespace-Level Hash** |
|---|---|---|
| **Kaynak** | I18N_STRATEGY.md (ilk doküman) | App tarafı önerisi (ikinci doküman) |
| **Temel fikir** | Locale başına tek büyük JSON, ETag ile 304 | Manifest endpoint + her namespace için ayrı hash, sadece değişenler indirilir |
| **Request sayısı** | 1 request (bundle) | 1 manifest + N namespace request |
| **Cache mekanizması** | HTTP ETag (tek hash, tüm locale) | Manifest hash map (namespace başına hash) |
| **Admin değişiklik akışı** | Anında yansır (immediate) | Draft → Publish (kontrollü) |
| **Audit log** | Yok | Var (translation_audit_log) |
| **DB tablo sayısı** | 3 (locale, translation, bundle_version) | 3+1 (translations, translation_versions, audit_log) |
| **Client complexity** | Düşük (tek fetch + ETag) | Yüksek (manifest fetch → diff → selective download → merge) |

---

## Kritik Analiz

### Tipbox'un Gerçek Verileri

```
Dil sayısı:        2 (en, tr)
Namespace sayısı:  13
Tahmini key sayısı: ~800-1500 (13 namespace x ~60-120 key)
Tahmini bundle boyutu:
  Raw JSON:   ~40-80KB (tüm namespace'ler birlikte)
  Gzip:       ~6-12KB
  Brotli:     ~4-8KB
```

### Kriter Bazlı Karşılaştırma

#### 1. Bandwidth Maliyeti

| Senaryo | A: Full Bundle | B: Manifest + NS |
|---------|---------------|-------------------|
| İlk açılış | 1 req × ~10KB | 1 req (manifest ~1KB) + 13 req × ~1KB = ~14KB |
| Değişiklik yok | 1 req → 304 (~200B header) | 1 req → 304 (~200B header) |
| 1 namespace değişti | 1 req × ~10KB (full bundle) | 1 req (manifest ~1KB) + 1 req × ~1KB = ~2KB |
| 5 namespace değişti | 1 req × ~10KB (full bundle) | 1 req + 5 req × ~1KB = ~6KB |

**Verdict:** B, granüler değişikliklerde daha az bandwidth kullanır. **AMA** Tipbox ölçeğinde full bundle gzip ile 10KB. Bu, bir kullanıcı profil fotoğrafının 1/10'u. Bandwidth tasarrufu **ihmal edilebilir düzeyde**.

#### 2. Request Sayısı ve Latency

| Senaryo | A | B |
|---------|---|---|
| Değişiklik yok | 1 request | 1 request |
| Değişiklik var | 1 request | 1 + N request (N = değişen namespace sayısı) |
| İlk açılış | 1 request | 1 + 13 request (veya batch ile 1+1) |

**Verdict:** A, her senaryoda daha az request atar. Mobile'da her request ~100-300ms RTT eklediği için, A daha hızlı.

#### 3. Implementation Complexity

| Boyut | A | B |
|-------|---|---|
| Backend endpoint sayısı | 2 (bundle + locales) | 4 (manifest + namespace + batch + locales) |
| Client-side logic | fetch → ETag check → cache | fetch manifest → compare hashes → selective fetch → merge → cache per NS |
| Cache management | 1 key per locale | 1 manifest + 13 key per locale per lang = ~28 AsyncStorage key |
| Hata senaryoları | Basit (ya alır ya 304) | Karmaşık (yarım kalan sync, partial update, stale manifest) |
| Debug kolaylığı | Çok kolay | Zor (hangi namespace stale? hash neden uyuşmuyor?) |

**Verdict:** A, geliştirme ve bakım maliyeti olarak **3-4x daha düşük**.

#### 4. Publish Flow (Draft → Live)

- **A:** Yok. Admin değişiklik yaptığında anında yansır.
- **B:** Var. Admin "Publish" yapana kadar değişiklikler draft kalır.

**Verdict:** B'nin publish flow'u **gerçekten değerli** bir özellik. Yarım kalan çevirilerin canlıya çıkmasını önler. **AMA** bu özellik A yaklaşımına da eklenebilir (bundle compile'ı publish butonuna bağla).

#### 5. Audit Log

- **A:** Yok.
- **B:** Var (translation_audit_log tablosu).

**Verdict:** Audit log kesinlikle olmalı. **AMA** bu da A yaklaşımına kolayca eklenebilir (mevcut adminLog tablosu zaten var Tipbox'ta).

#### 6. Ne Zaman B Mantıklı Olur?

B yaklaşımı şu durumlarda tercih edilmeli:
- **50+ namespace** ve **10.000+ key** varsa (bundle >500KB)
- **10+ dil** destekleniyorsa
- **Lazy loading** gerekiyorsa (sadece aktif ekranın namespace'i)
- **CDN entegrasyonu** planlanıyorsa (namespace bazlı cache)
- **Çevirmen ekibi** varsa ve paralel çalışma gerekiyorsa

Tipbox'ta bunların **hiçbiri geçerli değil** (şu an ve yakın gelecekte).

---

## Final Karar: Hibrit Yaklaşım (A Temelli + B'den Seçilmiş Özellikler)

### Neden?

```
A yaklaşımının basitliği + B yaklaşımından publish flow + audit log
= Tipbox için optimal çözüm
```

### Alınan ve Alınmayan Özellikler

| Özellik | Kaynak | Alındı mı? | Neden? |
|---------|--------|------------|--------|
| Full bundle per locale | A | ✅ | 10KB gzip yeterince küçük, tek request |
| ETag / If-None-Match | A | ✅ | HTTP standardı, tüm client'lar destekler |
| Redis cache (bundle + hash) | A | ✅ | Basit ve etkili |
| Publish flow (draft → live) | B | ✅ | Yarım çevirileri önler |
| Audit log | B | ✅ | Admin accountability |
| Namespace-level hashing | B | ❌ | Tipbox ölçeğinde gereksiz complexity |
| Manifest endpoint | B | ❌ | Tek ETag yeterli |
| Per-namespace fetch | B | ❌ | Full bundle 10KB, namespace'e bölmek anlamsız |
| Delta updates | B | ❌ | Overkill |
| Batch endpoint | B | ❌ | Tek bundle endpoint yeterli |
| Bundle fallback chain | B | ✅ | İyi UX pattern (cache → bundle → fallback lang → key) |
| Foreground sync trigger | B | ✅ | Background'dan dönüşte kontrol et |
| Missing translation detection | A+B | ✅ | Admin panel için kritik |
| JSON import/export | A | ✅ | Migration ve bulk işlemler için |

---

## Final Mimari

### Akış

```
┌────────────────────────────────────────────────────────────────┐
│                        APP AÇILIŞI                             │
│                                                                │
│  1. Bundle fallback yükle (embedded, 0ms)          ← ANINDA   │
│  2. AsyncStorage cache varsa override et (~30ms)   ← HIZLI    │
│  3. UI render et                                   ← KULLANICI│
│  4. Background'da:                                    BEKLEMEZ │
│     GET /api/v1/i18n/bundle/:locale                            │
│     If-None-Match: "cached-etag"                               │
│     ├─ 304 → Hiçbir şey yapma ✓                               │
│     └─ 200 → Cache güncelle + i18n.addResourceBundle() ✓      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    ADMIN DEĞİŞİKLİK                            │
│                                                                │
│  1. Admin çeviriyi düzenler (DB güncellenir)                   │
│  2. Değişiklik "draft" olarak kalır                            │
│  3. Admin "Publish" butonuna basar                             │
│  4. compileBundleForLocale() çalışır:                          │
│     ├─ DB'den tüm çevirileri çek                              │
│     ├─ JSON oluştur + SHA-256 hash hesapla                    │
│     ├─ i18n_bundle_version tablosu güncelle (version++, hash) │
│     ├─ Redis cache güncelle (bundle + hash)                   │
│     └─ Admin audit log yaz                                    │
│  5. Sonraki app request'i yeni ETag görür → 200 + yeni bundle │
└────────────────────────────────────────────────────────────────┘
```

### Database (3+1 Tablo)

```
i18n_locale            → Desteklenen diller (en, tr)
i18n_translation       → Tüm çeviriler (locale + namespace + key + value)
i18n_bundle_version    → Her locale'in hash + version'ı + is_published flag
admin_log              → Mevcut Tipbox admin_log tablosu (yeni tablo gereksiz)
```

**Not:** Ayrı bir `translation_audit_log` tablosu yerine mevcut `adminLog` tablosu kullanılır. Tipbox'ta bu pattern zaten var.

### API Endpoints

```
PUBLIC:
  GET  /api/v1/i18n/locales                    → Aktif dil listesi
  GET  /api/v1/i18n/bundle/:locale             → Full bundle (ETag destekli)

ADMIN:
  GET    /api/v1/admin/i18n/translations       → Liste (filter: locale, namespace, search)
  POST   /api/v1/admin/i18n/translations       → Yeni key ekle
  PATCH  /api/v1/admin/i18n/translations/:id   → Value güncelle
  DELETE /api/v1/admin/i18n/translations/:id   → Key sil
  POST   /api/v1/admin/i18n/translations/bulk  → Toplu güncelle
  POST   /api/v1/admin/i18n/publish            → Değişiklikleri yayınla
  POST   /api/v1/admin/i18n/import             → JSON import
  GET    /api/v1/admin/i18n/export/:locale     → JSON export
  GET    /api/v1/admin/i18n/missing/:locale    → Eksik çeviriler
```

### Redis Cache

```
i18n:bundle:{locale}      → Compiled JSON string     (TTL: 24h, write-time invalidate)
i18n:hash:{locale}        → SHA-256 hash string      (TTL: 24h, write-time invalidate)
```

Sadece **2 key per locale**. Toplam: 4 Redis key (2 dil x 2 key).

### Client (App) Cache

```
AsyncStorage:
  i18n_bundle_{locale}    → Cached JSON bundle
  i18n_etag_{locale}      → Last known ETag
  i18n_last_sync          → Timestamp
```

Sadece **5 AsyncStorage key** (2 dil x 2 key + 1 timestamp).

---

## Publish Flow Detayı

Bu, B yaklaşımından alınan en değerli özellik:

```
Admin "Kaydet" → DB'de i18n_translation.value güncellenir
                  i18n_translation.updated_at güncellenir
                  AMA bundle_version.hash DEĞİŞMEZ
                  → App hâlâ eski bundle'ı kullanır

Admin "Yayınla" → compileBundleForLocale(locale) çalışır
                   bundle_version.hash güncellenir
                   bundle_version.version++
                   Redis cache güncellenir
                   → App yeni bundle'ı alır
```

**Neden önemli:**
- Admin 50 key'i güncelliyor, 30'unu bitirdi, 20'si eksik → Publish yapmadığı için kullanıcılar eski bundle'ı görür
- Admin yanlış çeviri girdi → Publish etmeden düzeltebilir
- Birden fazla admin paralel çalışıyor → Publish atomik, çakışma riski düşük

### Unpublished Changes Tracking

```sql
-- Yayınlanmamış değişiklik var mı?
SELECT COUNT(*) as unpublished_count
FROM i18n_translation t
JOIN i18n_bundle_version bv ON t.locale_code = bv.locale_code
WHERE t.locale_code = 'tr'
AND t.updated_at > bv.updated_at;
```

Admin panelde: `"3 yayınlanmamış değişiklik"` badge'i gösterilir.

---

## Maliyet Karşılaştırması

### Geliştirme Süresi

| Bileşen | A (Full Bundle) | B (Manifest+NS) | Hibrit (Final) |
|---------|-----------------|-------------------|----------------|
| Backend API | ~2 gün | ~4 gün | ~3 gün |
| DB + Prisma | ~0.5 gün | ~1 gün | ~0.5 gün |
| Redis cache logic | ~0.5 gün | ~1.5 gün | ~0.5 gün |
| Client (App) | ~1 gün | ~3 gün | ~1.5 gün |
| Admin panel | ~3 gün | ~4 gün | ~3.5 gün |
| Test + debug | ~1 gün | ~3 gün | ~1.5 gün |
| **Toplam** | **~8 gün** | **~16.5 gün** | **~10.5 gün** |

### Runtime Maliyeti (Aylık, 10K aktif kullanıcı)

| Metrik | A | B | Hibrit |
|--------|---|---|--------|
| Redis memory | ~200KB | ~500KB | ~200KB |
| DB queries (read) | ~0 (Redis hit) | ~0 (Redis hit) | ~0 (Redis hit) |
| Bandwidth (değişiklik yok) | ~60MB/ay | ~60MB/ay | ~60MB/ay |
| Bandwidth (günlük 1 değişiklik) | ~3GB/ay | ~300MB/ay | ~3GB/ay |

**Not:** B'nin bandwidth avantajı var ama 3GB/ay = $0.27 (AWS). Tipbox ölçeğinde anlamsız.

### Bakım Maliyeti

| Boyut | A | B | Hibrit |
|-------|---|---|--------|
| Bug surface area | Düşük | Yüksek | Düşük |
| Yeni dil ekleme | Kolay | Orta | Kolay |
| Yeni namespace ekleme | Otomatik | Otomatik | Otomatik |
| Client-side debug | Kolay | Zor | Kolay |
| Cache corruption recovery | Basit (tek key sil) | Karmaşık (N key) | Basit |

---

## Ölçeklendirme Yol Haritası

Eğer Tipbox büyürse ve hibrit yaklaşım yetersiz kalırsa:

```
Şu an (2 dil, 13 NS, ~1000 key)
  → Hibrit: Full bundle + ETag ✅

5+ dil, 20+ NS, ~5000 key (bundle ~50KB gzip)
  → Hâlâ hibrit yeterli ✅
  → Opsiyonel: CDN önüne koy

10+ dil, 50+ NS, ~20000 key (bundle ~200KB gzip)
  → Namespace-level hash'e geç (B yaklaşımı)
  → Bu geçiş backward-compatible yapılabilir:
    1. Manifest endpoint ekle
    2. Client'ı güncelle
    3. Eski bundle endpoint'i de çalışmaya devam eder
```

**Önemli:** A'dan B'ye geçiş, B'den A'ya geçişten çok daha kolay. Basit başlamak her zaman doğru strateji.

---

## Sonuç

| | A: Full Bundle | B: Manifest+NS | **Hibrit (Final)** |
|---|---|---|---|
| Complexity | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Bandwidth | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Geliştirme hızı | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Bakım kolaylığı | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Güvenlik (publish) | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Ölçeklenebilirlik | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ (yol haritası ile ⭐⭐⭐⭐) |
| **Tipbox uygunluğu** | ⭐⭐⭐⭐ | ⭐⭐⭐ | **⭐⭐⭐⭐⭐** |

**Final karar:** A'nın basitliği temel alınır, B'den publish flow ve audit log eklenir. Namespace-level granülerlik Tipbox'un mevcut ölçeği için **over-engineering** olur ve gereksiz complexity getirir. İleride gerekirse backward-compatible şekilde eklenebilir.
