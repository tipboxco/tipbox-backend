# Hiyerarşik Feed Ağaç Yapısı Şeması

## Genel Yapı

```
┌─────────────────────────────────────────────────────────────────┐
│                     2 Main Categories                            │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │   Electronics           │  │   Cosmetics            │        │
│  │   (3968a741-...)        │  │   (2ec1c38f-...)       │        │
│  └────────────────────────┘  └────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────┐                      ┌──────────────────┐
│  Electronics      │                      │  Cosmetics        │
│  Sub Categories   │                      │  Sub Categories   │
│  (2 adet)         │                      │  (2 adet)         │
└──────────────────┘                      └──────────────────┘
        │                                           │
        │                                           │
   ┌────┴────┐                                 ┌────┴────┐
   │         │                                 │         │
   ▼         ▼                                 ▼         ▼
┌──────┐  ┌──────┐                        ┌──────┐  ┌──────┐
│cameras│  │drones│                        │Bath  │  │Facial│
│      │  │      │                        │body  │  │tools │
└──────┘  └──────┘                        └──────┘  └──────┘
   │         │                                 │         │
   │         │                                 │         │
   └────┬────┘                                 └────┬────┘
        │                                           │
        │                                           │
   ┌────┴────┐                                 ┌────┴────┐
   │         │                                 │         │
   ▼         ▼                                 ▼         ▼
┌──────────────────┐                      ┌──────────────────┐
│  Product Groups   │                      │  Product Groups   │
│  (Her sub için 2)  │                      │  (Her sub için 2) │
│  Toplam: 4        │                      │  Toplam: 4        │
└──────────────────┘                      └──────────────────┘
        │                                           │
        │                                           │
   ┌────┴────┐                                 ┌────┴────┐
   │         │                                 │         │
   ▼         ▼                                 ▼         ▼
┌──────────────────┐                      ┌──────────────────┐
│  Products         │                      │  Products         │
│  (Her group için 2)│                      │  (Her group için 2)│
│  Toplam: 8        │                      │  Toplam: 8        │
└──────────────────┘                      └──────────────────┘
```

## Detaylı Hiyerarşi

### Electronics Kategorisi
```
Electronics (3968a741-6ebe-4d97-b853-62b04198c91e)
│
├── cameras (079262b2-a70e-494d-aa69-d2746543caec)
│   │
│   ├── cameras (3bff32d3-2e8f-436c-b30c-70e5d59425bf)
│   │   │
│   │   ├── 2 In 1 Laptops (5b839ba6-7869-40ab-8540-8c91cfd1932e)
│   │   └── Acer Nitro 16 (2c1bbc03-d55c-4df2-b4d2-aa34c9ad1d4d)
│   │
│   └── cameras Group 2 (seed'den oluşturuluyor)
│       │
│       ├── Camera Product 1 (seed'den oluşturuluyor)
│       └── Camera Product 2 (seed'den oluşturuluyor)
│
└── drones (8fb311e1-9c72-4054-8f1a-4116c1c159b4)
    │
    ├── drones Group 1 (seed'den oluşturuluyor)
    │   │
    │   ├── Drone Product 1 (seed'den oluşturuluyor)
    │   └── Drone Product 2 (seed'den oluşturuluyor)
    │
    └── drones Group 2 (seed'den oluşturuluyor)
        │
        ├── Drone Product 3 (seed'den oluşturuluyor)
        └── Drone Product 4 (seed'den oluşturuluyor)
```

### Cosmetics Kategorisi
```
Cosmetics (2ec1c38f-a3e2-4228-87a0-d6e0067ac206)
│
├── Bath body (f4e84c4d-d09a-4e41-ae40-5ad23990a4f5)
│   │
│   ├── Bath body (cfde64de-52ce-4c88-b57e-e129f4d6b12c)
│   │   │
│   │   ├── BaBylissPRO Nano Titanium Portofino (00b369a7-394a-455c-a04d-58c3280db6ba)
│   │   └── Bath Body (1fe389b4-003d-4004-aabd-455fda354425)
│   │
│   └── Bath body Group 2 (seed'den oluşturuluyor)
│       │
│       ├── Bath Product 1 (seed'den oluşturuluyor)
│       └── Bath Product 2 (seed'den oluşturuluyor)
│
└── Facial tools (b496203a-58a6-499b-a9be-997522cae2af)
    │
    ├── Facial tools Group 1 (seed'den oluşturuluyor)
    │   │
    │   ├── Facial Product 1 (seed'den oluşturuluyor)
    │   └── Facial Product 2 (seed'den oluşturuluyor)
    │
    └── Facial tools Group 2 (seed'den oluşturuluyor)
        │
        ├── Facial Product 3 (seed'den oluşturuluyor)
        └── Facial Product 4 (seed'den oluşturuluyor)
```

## Post Oluşturma Mantığı

### 2'li Ağaç Yapısı
- **2 Main Category** (Electronics, Cosmetics)
- **4 Sub Category** (her main için 2)
- **8 Product Group** (her sub için 2)
- **16 Product** (her group için 2)

### Post Sayıları (Toplam: 132)

#### Sub Category Seviyesi (12 post)
- Her sub category için: **3 post** (FREE, TIPS, QUESTION)
- Toplam: 4 sub category × 3 = **12 post**

#### Product Group Seviyesi (24 post)
- Her product group için: **3 post** (FREE, TIPS, QUESTION)
- Toplam: 8 product group × 3 = **24 post**

#### Product Seviyesi (96 post)
- Her product için: **6 post** (FREE, TIPS, QUESTION, EXPERIENCE, UPDATE, BENCHMARK)
- Toplam: 16 product × 6 = **96 post**

## Feed Mantığı

### Sub Category Feed
```
Sub Category Feed = 
  Sub Category Posts (3 tip: FREE, TIPS, QUESTION)
  + Alt Product Group Posts (her group için 3 tip)
  + Alt Product Posts (her product için 3 tip: FREE, TIPS, QUESTION)
  
Örnek: cameras sub category
  = 3 (sub category) 
  + 6 (2 product group × 3)
  + 12 (4 product × 3)
  = 21 post
```

### Product Group Feed
```
Product Group Feed = 
  Product Group Posts (3 tip: FREE, TIPS, QUESTION)
  + Alt Product Posts (her product için 3 tip: FREE, TIPS, QUESTION)
  
Örnek: cameras product group
  = 3 (product group)
  + 6 (2 product × 3)
  = 9 post
```

### Product Feed
```
Product Feed = 
  Product Posts (6 tip: FREE, TIPS, QUESTION, EXPERIENCE, UPDATE, BENCHMARK)
  
Örnek: 2 In 1 Laptops product
  = 6 post
```

## Post Type Filtreleme Kuralları

### Sub Category Feed
- **Gösterilen:** FREE, TIPS, QUESTION
- **Gösterilmeyen:** EXPERIENCE, UPDATE, BENCHMARK

### Product Group Feed
- **Gösterilen:** FREE, TIPS, QUESTION
- **Gösterilmeyen:** EXPERIENCE, UPDATE, BENCHMARK

### Product Feed
- **Gösterilen:** Tüm 6 tip (FREE, TIPS, QUESTION, EXPERIENCE, UPDATE, BENCHMARK)

## ID'ler

### Electronics
- **Category ID:** `3968a741-6ebe-4d97-b853-62b04198c91e`
- **Sub Categories:**
  - cameras: `079262b2-a70e-494d-aa69-d2746543caec`
  - drones: `8fb311e1-9c72-4054-8f1a-4116c1c159b4`
- **Product Groups:**
  - cameras: `3bff32d3-2e8f-436c-b30c-70e5d59425bf`
  - cameras Group 2: (seed'den oluşturuluyor)
  - drones Group 1: (seed'den oluşturuluyor)
  - drones Group 2: (seed'den oluşturuluyor)
- **Products:**
  - 2 In 1 Laptops: `5b839ba6-7869-40ab-8540-8c91cfd1932e`
  - Acer Nitro 16: `2c1bbc03-d55c-4df2-b4d2-aa34c9ad1d4d`
  - Diğerleri: (seed'den oluşturuluyor)

### Cosmetics
- **Category ID:** `2ec1c38f-a3e2-4228-87a0-d6e0067ac206`
- **Sub Categories:**
  - Bath body: `f4e84c4d-d09a-4e41-ae40-5ad23990a4f5`
  - Facial tools: `b496203a-58a6-499b-a9be-997522cae2af`
- **Product Groups:**
  - Bath body: `cfde64de-52ce-4c88-b57e-e129f4d6b12c`
  - Bath body Group 2: (seed'den oluşturuluyor)
  - Facial tools Group 1: (seed'den oluşturuluyor)
  - Facial tools Group 2: (seed'den oluşturuluyor)
- **Products:**
  - BaBylissPRO Nano Titanium Portofino: `00b369a7-394a-455c-a04d-58c3280db6ba`
  - Bath Body: `1fe389b4-003d-4004-aabd-455fda354425`
  - Diğerleri: (seed'den oluşturuluyor)

## Test Senaryosu

### Oluşturulan Post'lar
1. **Sub Category Posts:** 12 (4 × 3)
2. **Product Group Posts:** 24 (8 × 3)
3. **Product Posts:** 96 (16 × 6)
4. **Toplam:** 132 post

### Test Edilen Endpoint'ler
1. `GET /catalog/sub-categories/:subCategoryId/posts`
2. `GET /catalog/sub-categories/:subCategoryId/posts?type=tips`
3. `GET /catalog/sub-categories/:subCategoryId/posts?type=question`
4. `GET /catalog/product-groups/:productGroupId/posts`
5. `GET /catalog/product-groups/:productGroupId/posts?type=tips`
6. `GET /catalog/products/:productId/posts`
7. `GET /catalog/products/:productId/posts?type=free`
8. `GET /catalog/products/:productId/posts?type=tips`
9. `GET /catalog/products/:productId/posts?type=question`
10. `GET /catalog/products/:productId/posts?type=experience`
11. `GET /catalog/products/:productId/posts?type=update`
12. `GET /catalog/products/:productId/posts?type=benchmark`
