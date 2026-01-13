# Test Kullanıcı Bilgileri

## Kullanıcı Detayları
- **User ID**: `44444444-4444-4444-a444-444444444444`
- **Email**: `burakcan@tipbox.co`
- **Wallet ID**: `384c741b-1cb8-46f4-a9b4-2f000c944531`
- **Balance**: `6179 TIPS`

## JWT Token (30 gün geçerli)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQ0NDQ0NDQ0LTQ0NDQtNDQ0NC1hNDQ0LTQ0NDQ0NDQ0NDQ0NCIsImVtYWlsIjoiYnVyYWtjYW5AdGlwYm94LmNvIiwiaWF0IjoxNzY4MjMxNzA4LCJleHAiOjE3NzA4MjM3MDh9.vETkUQw55ZVUS168jgzObuXsJdkq_Ul34GNQ1cYPPlI
```

## Oluşturulan Test Verileri

### Transaction Özeti
- **Total Confirmed**: 12 transactions
- **Pending**: 1 transaction
- **Failed**: 1 transaction
- **Balance**: 6179 TIPS

### Transaction Türleri
1. **TIP_RECEIVE** (5 adet - confirmed)
   - Farklı kullanıcılardan alınan tip'ler
   - 134-592 TIPS arası tutarlar
   - 1-7 gün önce tarihleri

2. **TIP_SEND** (3 adet - confirmed)
   - Farklı kullanıcılara gönderilen tip'ler
   - 132-225 TIPS arası tutarlar
   - Bugün içinde tarihleri

3. **CLAIM_REWARD** (2 adet - confirmed)
   - Event katılım ödülleri
   - Her biri 1000 TIPS
   - Event ID'leri ile

4. **CLAIM_BADGE** (1 adet - confirmed)
   - Expert Reviewer badge
   - 500 TIPS
   - Badge ID ve name ile

5. **AIRDROP** (1 adet - confirmed)
   - Welcome bonus
   - 2000 TIPS
   - 2 hafta önce

6. **PENDING** (1 adet)
   - Bekleyen tip
   - 250 TIPS
   - 5 dakika önce

7. **FAILED** (1 adet)
   - Başarısız tip
   - 100 TIPS
   - "Insufficient balance" hatası

## Test Endpoint'leri

### 1. Wallet Balance
```bash
curl -X GET "http://localhost:3000/wallets/balance" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "balance": 6179,
  "currency": "TIPS",
  "locked": 0,
  "available": 6179
}
```

### 2. Wallet Info
```bash
curl -X GET "http://localhost:3000/wallets/info" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "walletId": "384c741b-1cb8-46f4-a9b4-2f000c944531",
  "walletIdentifier": "0xTIPBOX_44444444-4444-4444-a444-444444444444_...",
  "provider": "CUSTOM",
  "isConnected": true,
  "balance": 6179,
  "createdAt": "2026-01-12T15:14:12.589Z"
}
```

### 3. Transaction History (Recent)
```bash
curl -X GET "http://localhost:3000/transactions/history?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:** Liste formatında transaction'lar (en yeniden eskiye)
- Her transaction için: id, type, actionType, amount, from/to user info, status, createdAt
- Pagination bilgisi: cursor, hasMore, limit

### 4. Transaction History (Grouped by Date)
```bash
curl -X GET "http://localhost:3000/transactions/history/grouped?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:** Tarihlere göre gruplu transaction'lar
- `today`: Bugünün transaction'ları
- `yesterday`: Dünün transaction'ları
- `lastWeek`: Son 7 günün transaction'ları
- `lastMonth`: Son 30 günün transaction'ları
- `older`: Daha eski transaction'lar

## Kullanım Notları

1. **Token Kullanımı**: Tüm endpoint'ler için `Authorization: Bearer TOKEN` header'ı gerekli
2. **Pagination**: History endpoint'leri cursor-based pagination kullanıyor
3. **Status Filtreleme**: `/transactions/history?status=confirmed` gibi filtreleme yapılabilir
4. **Date Grouping**: Mobil uygulamalarda grouped endpoint kullanılması önerilir

## Test Scripts

### Token Oluşturma
```bash
docker-compose exec -T backend npx ts-node scripts/generate-test-token.ts
```

### Test Transaction'ları Oluşturma
```bash
docker-compose exec -T backend npx ts-node scripts/seed-test-transactions.ts
```

### Endpoint'leri Test Etme
```bash
# scripts/test-wallet-endpoints.sh dosyasını çalıştır
./scripts/test-wallet-endpoints.sh
```

## Swagger Documentation
Tüm endpoint'lerin detaylı dokümantasyonu: http://localhost:3000/api-docs

