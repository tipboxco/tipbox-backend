# Mobile Response Format Migration Guide

**Tarih:** 2026-02-28
**Durum:** Backward-compatible wrapper eklendi, flat field'lar hala mevcut

---

## Ozet

Backend response format'i standardize edildi. Tum endpoint'ler artik `{ success: true/false, ... }` formatini kullaniyor. Bazi endpoint'ler daha once flat data donuyordu (wrapper olmadan). Bu endpoint'lere backward-compatible wrapper eklendi: hem eski flat field'lar hem de yeni `data` objesi ayni anda doner.

## Standart Response Format

```typescript
// Basarili response
{
  "success": true,
  "data": { ... }     // Asil veri buraya tasinacak
}

// Hata response
{
  "success": false,
  "message": "Hata mesaji"
}
```

---

## Etkilenen Endpoint'ler

### 1. POST /auth/login

**Eski format (deprecated):**
```json
{
  "id": 1,
  "fullName": "Omer Faruk",
  "email": "omer@tipbox.co",
  "avatar": "http://...",
  "token": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Yeni format (su an her ikisi de doner):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "fullName": "Omer Faruk",
    "email": "omer@tipbox.co",
    "avatar": "http://...",
    "token": "eyJ...",
    "refreshToken": "eyJ..."
  },
  "id": 1,
  "fullName": "Omer Faruk",
  "email": "omer@tipbox.co",
  "avatar": "http://...",
  "token": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Migration:** `response.data.token` kullanin, `response.token` yerine.

---

### 2. GET /auth/me

**Eski format (deprecated):**
```json
{
  "id": 1,
  "email": "omer@tipbox.co",
  "name": "Omer Faruk",
  "status": "ACTIVE",
  "auth0Id": null,
  "walletAddress": null,
  "kycStatus": "",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Yeni format:** Ayni yapiyla `success: true, data: { ... }` + flat field'lar.

**Migration:** `response.data.id` kullanin, `response.id` yerine.

---

### 3. POST /transactions/send-tip

**Eski format (deprecated):**
```json
{
  "id": "uuid",
  "actionType": "TIP_SEND",
  "status": "created",
  "amount": 10,
  "toAddress": "0x...",
  "toUserId": "uuid",
  "txHash": null,
  "metadata": {},
  "provider": "thirdweb",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Yeni format:** `success: true, data: { ... }` + flat field'lar.

---

### 4. POST /transactions/:transactionId/cancel

**Eski format (deprecated):**
```json
{
  "id": "uuid",
  "status": "cancelled",
  "errorMessage": null,
  "message": "Transaction cancelled"
}
```

**Yeni format:** `success: true, data: { ... }` + flat field'lar.

---

### 5. GET /transactions/history

**Eski format (deprecated):**
```json
{
  "items": [...],
  "pagination": { "cursor": null, "hasMore": false, "limit": 20 }
}
```

**Yeni format:** `success: true, data: { items, pagination }` + flat field'lar.

---

### 6. GET /transactions/history/grouped

**Eski format (deprecated):**
```json
{
  "today": [...],
  "yesterday": [...],
  "lastWeek": [...],
  "lastMonth": [...],
  "older": [...]
}
```

**Yeni format:** `success: true, data: { today, yesterday, ... }` + flat field'lar.

---

### 7. GET /transactions/:id

**Eski format (deprecated):**
```json
{
  "id": "uuid",
  "actionType": "TIP_SEND",
  "status": "confirmed",
  "amount": 10,
  ...
}
```

**Yeni format:** `success: true, data: { ... }` + flat field'lar.

---

## Migration Adimlari (Mobile)

1. **Hemen:** Tum endpoint response'larinda `success` field'ini kontrol edin
2. **Kademeli:** Her endpoint icin `response.data` objesinden veri okumaya gecin
3. **Test:** Hem eski hem yeni format'i destekleyen bir parser yazin:
   ```typescript
   function parseResponse<T>(response: any): T {
     if (response.data && response.success) {
       return response.data as T;
     }
     return response as T; // Eski format fallback
   }
   ```
4. **Son adim:** Flat field'lar kaldirildiginda `response.data` uzerinden okuma yapilmali

## Hata Response'lari

Tum hata response'lari artik `success: false` iceriyor:

```json
{
  "success": false,
  "message": "Error description"
}
```

Mobil tarafta hata kontrolu:
```typescript
if (!response.success) {
  showError(response.message);
}
```

---

## Timeline

| Adim | Tarih | Durum |
|------|-------|-------|
| Backend: Backward-compatible wrapper ekleme | 2026-02-28 | Tamamlandi |
| Mobile: `response.data` formatina gecis | TBD | Bekliyor |
| Backend: Flat field'lari kaldirma | Mobile gecis sonrasi | Bekliyor |
