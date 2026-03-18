# Collections API — Kategori Filtreleme Guncellemesi

> Bu dokuman, collection endpoint'lerine eklenen `mainCategory` ve `subCategory` alanlarini aciklar.
> Etkilenen endpoint'ler: **EP-01, EP-03, EP-04, EP-05**

---

## Yeni Alanlar

Tum collection donen endpoint'lerin response'una asagidaki iki alan eklendi:

```json
{
  "mainCategory": {
    "id": "cat_main_001",
    "name": "Teknoloji"
  },
  "subCategory": {
    "id": "cat_sub_001",
    "name": "Elektronik"
  }
}
```

| Field | Type | Aciklama |
|-------|------|----------|
| `mainCategory` | `{ id: string, name: string } \| null` | Ana kategori bilgisi |
| `subCategory` | `{ id: string, name: string } \| null` | Alt kategori bilgisi |

---

## Kategori Hiyerarsisi Mantigi

Kategoriler nested (ic ice) yapidadir. Backend, collection'in bagli oldugu kategorinin seviyesine gore hiyerarsiyi cozer:

| Durum | mainCategory | subCategory |
|-------|-------------|-------------|
| Kategori bir **alt kategoriyse** (parent'i var) | Parent kategori | Collection'in bagli oldugu kategori |
| Kategori bir **ana kategoriyse** (parent'i yok) | Collection'in bagli oldugu kategori | `null` |
| Collection'a **kategori atanmamissa** | `null` | `null` |

### Ornek Senaryolar

**Senaryo 1:** Collection "Cep Telefonu Aksesuarlari" kategorisine bagli, bu kategorinin parent'i "Elektronik":
```json
{
  "mainCategory": { "id": "cat_elektronik", "name": "Elektronik" },
  "subCategory": { "id": "cat_cep_aksesuar", "name": "Cep Telefonu Aksesuarlari" }
}
```

**Senaryo 2:** Collection dogrudan "Kozmetik" ana kategorisine bagli (alt kategorisi yok):
```json
{
  "mainCategory": { "id": "cat_kozmetik", "name": "Kozmetik" },
  "subCategory": null
}
```

**Senaryo 3:** Collection'a kategori atanmamis:
```json
{
  "mainCategory": null,
  "subCategory": null
}
```

---

## Bottom Sheet Filtreleme Kullanimi

EP-01 (`GET /api/events/collections`) uzerinde bu alanlari kullanarak filtreleme yapilir:

| Kullanici Aksiyonu | Gonderilecek Query Params |
|--------------------|--------------------------|
| Ana kategori secti | `mainCategoryId={mainCategory.id}` |
| Alt kategori secti | `mainCategoryId={mainCategory.id}&subCategoryId={subCategory.id}` |
| Filtre temizlendi | Parametre gondermeyin |

### Ornek Istekler

```
# Sadece "Elektronik" ana kategorisi
GET /api/events/collections?mainCategoryId=cat_elektronik

# "Elektronik" > "Cep Telefonu Aksesuarlari" alt kategorisi
GET /api/events/collections?mainCategoryId=cat_elektronik&subCategoryId=cat_cep_aksesuar
```

---

## Etkilenen Endpoint'ler

### EP-01: Collections List
`GET /api/events/collections`

Response'daki her collection item'a `mainCategory` ve `subCategory` eklendi.

### EP-03: Collection Detail
`GET /api/events/collections/:collectionId`

`collection` objesine `mainCategory` ve `subCategory` eklendi.

### EP-04: Completed Collections
`GET /api/events/collections/completed`

Response'daki her collection item'a `mainCategory` ve `subCategory` eklendi.

### EP-05: User Collection Progress
`GET /api/events/collections/user-progress`

Response'daki her collection item'a `mainCategory` ve `subCategory` eklendi.

---

## Not

- `category` (string) alani geriye uyumluluk icin korunmustur. Yeni implementasyonlarda `mainCategory` / `subCategory` tercih edilmelidir.
- `productGroupId` filtresi henuz aktif degildir, ileride eklenecektir.
