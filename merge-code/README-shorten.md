# Ürün başlığı kısaltma script'leri

## Akış

1. **Merge** – `products_with_images.csv` ile `product_some_shorted_2.csv` birleştirilir, `product_with_images2.csv` oluşturulur ve `shorten_title` sütunu eklenir. Mevcut kısaltılmış kayıtlar id ile eşleştirilir.

2. **Bulk shorten** – `product_with_images2.csv` içinde `shorten_title` boş olan satırlar için Gemini API ile toplu kısaltma yapılır.

## Gereksinimler

- Node.js (catalog-service kökünden çalıştırın)
- `products_with_images.csv` ve `product_some_shorted_2.csv` (merge için)
- Gemini API key (bulk shorten için): [Google AI Studio](https://aistudio.google.com/apikey) üzerinden alınır.

## Kullanım

### 1. Merge (product_with_images2.csv oluşturma)

```bash
cd catalog-service
node scripts/merge-products-with-shorten.js
```

Çıktı: `scripts/product_with_images2.csv` – tüm orijinal sütunlar + `shorten_title`.  
`product_some_shorted_2.csv` içinde id’si olan satırlarda `shorten_title` dolu, diğerlerinde boş.

### 2. Bulk shorten (Gemini ile kısaltılmamış başlıkları doldurma)

`.env` içine `GEMINI_API_KEY=...` ekleyin veya ortam değişkeni verin:

```bash
cd catalog-service
# Opsiyonel: batch boyutu ve bekleme süresi (varsayılan: 10, 2000ms)
set GEMINI_API_KEY=your-api-key
set BATCH_SIZE=10
set DELAY_MS=2000
node scripts/bulk-shorten-gemini.js
```

Script yalnızca `shorten_title` boş ve `title` dolu satırları işler. Her batch’te `BATCH_SIZE` kadar ürün paralel Gemini isteği alır, batch’ler arasında `DELAY_MS` beklenir. Sonuçlar `product_with_images2.csv` dosyasına yazılır; script tekrar çalıştırılarak kalan boş satırlar doldurulabilir.

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `merge-products-with-shorten.js` | CSV merge + `shorten_title` sütunu ekleme |
| `bulk-shorten-gemini.js` | Gemini ile boş `shorten_title` alanlarını doldurma |
| `products_with_images.csv` | Girdi: ürün listesi (title vb.) |
| `product_some_shorted_2.csv` | Girdi: id, kısaltılmış başlık (header yok) |
| `product_with_images2.csv` | Çıktı: merge edilmiş tablo + `shorten_title` |
