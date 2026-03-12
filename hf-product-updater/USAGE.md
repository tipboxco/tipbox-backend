# HF Product Updater - Kullanim Rehberi

## Kurulum

```bash
cd hf-product-updater
npm install
```

`.env` dosyasi (opsiyonel, remote sorgular icin):
```
HF_TOKEN=hf_xxxxxxxxxx
HF_DATASET_ID=iguzelofficial/AMAZON-Products-2023
```

---

## 1. Local Sorgular (`npm run query`)

Local CSV dosyasi uzerinden calisir (`data/amazon_products.csv`). Internet gerektirmez, anlik sonuc doner.

### Dataset istatistikleri
```bash
npm run query
```

### Urun ara (title, store, description icinde)
```bash
npm run query -- search "Samsung Galaxy"
npm run query -- search "wireless earbuds" 50    # limit belirle (default: 20)
```

### Marka listele
```bash
npm run query -- brands                  # en cok urune sahip 50 marka
npm run query -- brands "sam"            # "sam" iceren markalar
npm run query -- brands "nike" 10        # limit belirle
```

### Kategori listele
```bash
npm run query -- categories
```

### Bir markanin urunleri
```bash
npm run query -- brand-products "Samsung"
npm run query -- brand-products "Nike"
```

### Custom SQL sorgusu
```bash
npm run query -- sql "SELECT * FROM products WHERE price > 100 AND LOWER(store) = 'nike' LIMIT 10"
npm run query -- sql "SELECT store, COUNT(*) as cnt FROM products GROUP BY store ORDER BY cnt DESC LIMIT 20"
npm run query -- sql "SELECT * FROM products WHERE average_rating >= 4.5 AND price < 50 LIMIT 10"
```

---

## 2. Remote Sorgular (`npm run remote`)

HuggingFace uzerindeki dataset'i dogrudan sorgular. Internet gerektirir, HF_TOKEN onerilir.

### Dataset istatistikleri
```bash
npm run remote -- stats
```

### Urun ara
```bash
npm run remote -- search "Nike"
npm run remote -- search "laptop" 30
```

### Marka urunleri
```bash
npm run remote -- brand "Nike" 10
npm run remote -- brand "Samsung" 50
```

### Marka listele
```bash
npm run remote -- brands
npm run remote -- brands "apple" 20
```

### Marka verilerini JSON'a export et
```bash
npm run remote -- export "Nike" nike_products.json
```

### Tum dataset'i indir
```bash
npm run remote -- download csv          # CSV olarak indir (onerilen)
npm run remote -- download json         # JSON olarak indir
```

### Custom SQL
```bash
npm run remote -- sql "SELECT COUNT(*) FROM products WHERE price > 500"
```

---

## 3. Urun Ekleme (`npm run add-products`)

`csv/` klasorune CSV dosyasi koyarak yeni urun ekleyebilirsin.

```bash
npm run add-products
```

CSV formati (`csv/example_products.csv`):
```csv
parent_asin,title,description,main_category,store,average_rating,rating_number,price,image
B0EXAMPLE1,Urun Adi,Aciklama,Electronics,BrandName,4.5,100,29.99,https://image.url
```

---

## 4. Diger Komutlar

### Marka listesi (ayri script)
```bash
npm run list-brands
```

### Dataset indir (eski parquet yontemi)
```bash
npm run download
```

---

## Veritabani Kolonlari

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| `parent_asin` | string | Amazon ASIN kodu |
| `title` | string | Urun adi |
| `description` | string | Urun aciklamasi |
| `main_category` | string | Ana kategori |
| `categories` | list | Alt kategoriler |
| `store` | string | Marka / magaza adi |
| `average_rating` | float | Ortalama puan (1-5) |
| `rating_number` | float | Degerlendirme sayisi |
| `price` | float | Fiyat (USD) |
| `features` | list | Urun ozellikleri |
| `details` | string | Detay bilgileri |
| `image` | string | Gorsel URL |
| `date_first_available` | timestamp | Ilk cikis tarihi |
| `filename` | string | Kaynak dosya adi |

---

## Ornek SQL Sorgulari

```sql
-- En pahali 10 urun
SELECT title, store, price FROM products ORDER BY price DESC LIMIT 10

-- 4.5+ puan ve 1000+ degerlendirme alan urunler
SELECT title, store, price, average_rating, rating_number
FROM products
WHERE average_rating >= 4.5 AND rating_number >= 1000
ORDER BY rating_number DESC LIMIT 20

-- Kategori bazli ortalama fiyat
SELECT main_category, ROUND(AVG(price), 2) as avg_price, COUNT(*) as cnt
FROM products
WHERE price IS NOT NULL
GROUP BY main_category
ORDER BY avg_price DESC

-- Belirli fiyat araliginda urun ara
SELECT title, store, price FROM products
WHERE price BETWEEN 50 AND 100 AND LOWER(main_category) = 'electronics'
ORDER BY average_rating DESC LIMIT 20

-- Markalarin ortalama puani
SELECT store, ROUND(AVG(average_rating), 2) as avg_rating, COUNT(*) as products
FROM products
WHERE store IS NOT NULL
GROUP BY store
HAVING COUNT(*) >= 10
ORDER BY avg_rating DESC LIMIT 20
```
