# Send Tip Endpoint Güncelleme - Herkes Herkese Gönderebilir

## 🎯 Değişiklik Özeti

`POST /transactions/send-tip` endpoint'i güncellendi. Artık:
- ✅ **recipientId** (user ID) ile gönderim
- ✅ **walletAddress** ile gönderim
- ✅ Arkadaş kontrolü YOK - herkes herkese gönderebilir

---

## 📋 API Endpoint

### POST /transactions/send-tip

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```typescript
{
  recipientId?: string;      // Kullanıcı ID (opsiyonel)
  walletAddress?: string;    // Wallet address (opsiyonel)
  amount: number;            // TIPS miktarı (zorunlu)
  message?: string;          // Mesaj (opsiyonel)
}
```

**Validation Kuralları:**
- ✅ `recipientId` VEYA `walletAddress` en az biri olmalı
- ❌ İkisi birden gönderilemez
- ✅ `amount` > 0 olmalı
- ✅ Gönderen bakiye yeterli olmalı
- ✅ WalletAddress `0x` ile başlamalı ve en az 20 karakter olmalı

---

## 📤 Kullanım Örnekleri

### 1. User ID ile Gönderim (Internal Transfer)

```bash
curl -X POST http://localhost:5001/transactions/send-tip \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "11111111-1111-1111-1111-111111111111",
    "amount": 100,
    "message": "Harika bir öneri için teşekkürler!"
  }'
```

**Response:**
```json
{
  "id": "tx_123456",
  "actionType": "TIP_SEND",
  "status": "PENDING",
  "amount": 100,
  "toAddress": "0xTIPBOX_11111111_1768238723693_ZVLUSX",
  "toUserId": "11111111-1111-1111-1111-111111111111",
  "metadata": {
    "reason": "Harika bir öneri için teşekkürler!",
    "recipientUserId": "11111111-1111-1111-1111-111111111111"
  },
  "provider": "backend",
  "createdAt": "2026-01-12T17:30:00.000Z"
}
```

---

### 2. Wallet Address ile Gönderim

```bash
curl -X POST http://localhost:5001/transactions/send-tip \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0xTIPBOX_22222222_1768238723700_N5FJDG",
    "amount": 50,
    "message": "Transfer"
  }'
```

**Response:**
```json
{
  "id": "tx_789012",
  "actionType": "TIP_SEND",
  "status": "PENDING",
  "amount": 50,
  "toAddress": "0xTIPBOX_22222222_1768238723700_N5FJDG",
  "toUserId": "22222222-2222-2222-2222-222222222222",
  "metadata": {
    "reason": "Transfer",
    "recipientUserId": "22222222-2222-2222-2222-222222222222"
  },
  "provider": "backend",
  "createdAt": "2026-01-12T17:35:00.000Z"
}
```

---

## ❌ Hata Durumları

### 1. Ne recipientId ne de walletAddress verilmemişse
```json
{
  "message": "Either recipientId or walletAddress is required"
}
```
**HTTP Status:** 400

---

### 2. Her ikisi de verilmişse
```json
{
  "message": "Cannot specify both recipientId and walletAddress"
}
```
**HTTP Status:** 400

---

### 3. Geçersiz wallet address formatı
```json
{
  "message": "Invalid wallet address format"
}
```
**HTTP Status:** 400

---

### 4. Wallet address sistemde bulunamadı
```json
{
  "message": "Wallet address not found in system"
}
```
**HTTP Status:** 404

---

### 5. Yetersiz bakiye
```json
{
  "message": "Insufficient balance. Available: 250 TIPS"
}
```
**HTTP Status:** 400

---

### 6. Amount geçersiz
```json
{
  "message": "Amount must be greater than 0"
}
```
**HTTP Status:** 400

---

## 🔄 Backend Logic Flow

### WalletAddress ile Gönderim:
1. Wallet address validasyonu (format kontrolü)
2. Database'de wallet address arama
3. Wallet'a bağlı user bulma
4. Internal transfer olarak işleme
5. İki transaction oluşturma:
   - `TIP_SEND` (gönderen için)
   - `TIP_RECEIVE` (alıcı için)
6. Transaction'ı `PENDING` durumuna alma

### RecipientId ile Gönderim:
1. RecipientId validasyonu
2. User wallet bulma
3. Internal transfer işleme (mevcut mantık)
4. İki transaction oluşturma
5. Transaction'ı `PENDING` durumuna alma

---

## 📊 Database Değişiklikleri

**Değişiklik Yok** - Mevcut `Transaction` ve `Wallet` tabloları kullanılıyor.

---

## 🎨 Frontend Entegrasyonu

Frontend'de yapılması gereken değişiklik:

```typescript
// SendBottomSheet'de
const sendTips = async () => {
  try {
    const payload: any = {
      amount: tipsAmount,
      message: 'TIPS transfer'
    };

    // RecipientId varsa ekle
    if (recipientId) {
      payload.recipientId = recipientId;
    }

    // WalletAddress varsa ekle
    if (walletAddress) {
      payload.walletAddress = walletAddress;
    }

    // API çağrısı
    await sendTipsMutation.mutateAsync(payload);
  } catch (error) {
    console.error('Transfer failed:', error);
  }
};
```

---

## ✅ Test Senaryoları

### 1. User ID ile gönderim
```bash
# Test kullanıcısı: Tuna (11111111-1111-1111-1111-111111111111)
POST /transactions/send-tip
{
  "recipientId": "11111111-1111-1111-1111-111111111111",
  "amount": 100
}
```

### 2. Wallet address ile gönderim
```bash
# Tuna'nın wallet'ı: 0xTIPBOX_11111111_1768238723693_ZVLUSX
POST /transactions/send-tip
{
  "walletAddress": "0xTIPBOX_11111111_1768238723693_ZVLUSX",
  "amount": 50
}
```

### 3. Her ikisini de gönderince (hata)
```bash
POST /transactions/send-tip
{
  "recipientId": "11111111-1111-1111-1111-111111111111",
  "walletAddress": "0xTIPBOX_11111111_1768238723693_ZVLUSX",
  "amount": 50
}
# Expected: 400 - Cannot specify both
```

### 4. Hiçbirini göndermeden (hata)
```bash
POST /transactions/send-tip
{
  "amount": 50
}
# Expected: 400 - Either recipientId or walletAddress is required
```

---

## 🚀 Deployment Notları

1. **Migration Yok** - Sadece kod değişikliği
2. **Backward Compatible** - Eski `toUserId` parametresi hala çalışıyor (deprecated)
3. **Breaking Change Yok** - Mevcut API çağrıları çalışmaya devam edecek

---

## 📝 Changelog

### [v1.1.0] - 2026-01-12

#### Added
- `walletAddress` parametresi desteği
- Wallet address validasyonu
- Wallet address'den user bulma logic'i
- `recipientId` ve `walletAddress` opsiyonel hale getirildi

#### Changed
- `SendTipRequest` DTO güncellendi
- `/transactions/send-tip` endpoint validation kuralları güncellendi
- Swagger dokümantasyonu güncellendi

#### Removed
- Arkadaş kontrolü kaldırıldı (herkes herkese gönderebilir)

---

## 🔗 İlgili Dosyalar

- `src/interfaces/transaction/transaction.dto.ts` - DTO tanımları
- `src/interfaces/transaction/transaction.router.ts` - Endpoint implementasyonu
- `src/application/transaction/transaction.service.ts` - Business logic
- `docs/SEND_TIP_UPDATE.md` - Bu dokümantasyon
