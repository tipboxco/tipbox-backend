# Web2 Wallet Sistemi - Frontend İmplementasyon Raporu

## ✅ Tamamlanan İşler

### 1. WalletService Güncelleme
**Dosya:** `/src/services/WalletService/index.ts`

**Yapılan değişiklikler:**
- ✅ `createWallet(userId)` - Backend'e POST /wallets/create
- ✅ `getWalletInfo()` - AsyncStorage'dan wallet bilgilerini okuma
- ✅ `clearWallet()` - Logout'ta wallet temizleme
- ✅ Backward compatibility metodları (deprecated olarak işaretlendi)

**Web3 Hazırlığı:**
- createWallet şimdi backend API çağırıyor
- İleride aynı metod Thirdweb embedded wallet çağıracak
- Metodların signature'ları değişmeyecek

---

### 2. AppStore Wallet State Ekleme
**Dosya:** `/src/store/appStore.ts`

**Eklenen state alanları:**
```typescript
walletId: string | null;
walletIdentifier: string | null;
walletBalance: number | null;
```

**Persistence:**
- Wallet bilgileri Zustand persist ile AsyncStorage'da saklanıyor
- Kullanıcı logout yaptığında temizleniyor

---

### 3. Auth Flow Wallet Entegrasyonu
**Dosya:** `/src/store/appStore.ts`

**Login fonksiyonu:**
- ✅ Token kaydedildikten sonra `WalletService.createWallet()` çağrılıyor
- ✅ Wallet oluşturulamazsa login devam ediyor (graceful failure)
- ✅ Wallet bilgileri AppStore'a kaydediliyor

**Logout fonksiyonu:**
- ✅ State'ten wallet bilgileri temizleniyor
- ✅ `WalletService.clearWallet()` arka planda çağrılıyor
- ✅ Kullanıcı anında çıkış görüyor (non-blocking)

---

### 4. Transaction Status Hook
**Dosya:** `/src/hooks/useTransactionStatus.ts`

**Özellikler:**
- ✅ Transaction status'ünü poll eder (her 2 saniyede)
- ✅ Pending durumda otomatik polling
- ✅ Confirmed/Failed durumunda polling durur
- ✅ Helper fonksiyon: `getTransactionStatusMessage()` - UI için mesaj ve emoji döner
- ✅ Retry stratejisi (404'te retry yok, diğer hatalarda 3 retry)

**Kullanım:**
```tsx
const { data: tx } = useTransactionStatus(transactionId);

if (tx?.status === 'pending') {
  return <Text>⏳ İşlem işleniyor...</Text>;
}
```

---

### 5. Transaction Error Handling
**Dosya:** `/src/utils/transaction-errors.ts`

**Özellikler:**
- ✅ 20+ error code tanımı (INSUFFICIENT_BALANCE, INVALID_RECIPIENT, etc.)
- ✅ Türkçe kullanıcı dostu hata mesajları
- ✅ `handleTransactionError()` - Axios error'u parse eder
- ✅ `getErrorColor()` - Hata tipine göre renk döner
- ✅ `isRetryableError()` - Retry edilebilir mi kontrol eder

**Error Kategorileri:**
- Generic (balance, recipient, amount)
- NFT (not found, not owned, already listed)
- Swap (liquidity, slippage, pair)
- Rewards (no pending, already claimed)

---

### 6. Wallet API Endpoints (Web2-Ready)
**Dosya:** `/src/features/wallet/api/walletApi.ts`

**Yeni endpoint'ler:**
```typescript
// Wallet
getWalletInfo() → GET /api/wallet/info
getWalletBalance() → GET /api/wallet/balance

// Transactions
sendTips() → POST /api/transactions/send-tip
getTransactionById() → GET /api/transactions/:id
getWalletTransactions() → GET /api/transactions/history
```

**Response formatları:**
- ✅ Web3 uyumlu (actionType, status, txHash, provider)
- ✅ Transaction lifecycle: created → pending → confirmed/failed
- ✅ Grouped transactions (today, yesterday, lastWeek, lastMonth)

**Backward Compatibility:**
- Eski endpoint'ler deprecated olarak işaretlendi
- Kod kırılmaması için korunuyor

---

### 7. Wallet React Query Hooks
**Dosya:** `/src/features/wallet/api/hooks.ts`

**Yeni hook'lar:**
```typescript
useWalletInfo()           // Wallet bilgileri
useWalletBalance()        // Balance (10 saniyede refetch)
useWalletTransactions()   // Transaction history
useSendTips()             // TIPS gönderme mutation
```

**Query stratejileri:**
- **Balance:** Her 10 saniyede refetch (backend 10sn cache kullanır)
- **Transactions:** 30 saniye stale time
- **WalletInfo:** 5 dakika stale time

**Mutation stratejileri:**
- `useSendTips` success'te balance ve transactions invalidate edilir
- Optimistic update yok (pending status backend'den gelir)

---

## 🎯 Mimari Kararlar

### Transaction Lifecycle (Web3 Uyumlu)
```
created → pending → confirmed/failed
```

- **Web2 Aşaması:** Backend timer ile 2-3 saniyede confirmed oluyor
- **Web3 Aşaması:** Blockchain event listener ile confirmed olacak
- **Frontend:** İkisinde de aynı polling mekanizması

### Ledger-Based Balance
```
Balance = Σ(confirmed RECEIVE + CLAIM) - Σ(confirmed SEND + SWAP)
```

- **Web2 Aşaması:** Backend transaction tablosundan hesaplanıyor
- **Web3 Aşaması:** Blockchain events'lerinden hesaplanacak
- **Frontend:** İkisinde de sadece balance'ı gösteriyor

### Wallet Identifier
```
Şimdi:  "0xTIPBOX_userId_123456"  (fake address)
Sonra:  "0x742d35Cc6634C0532925a3b..."  (real blockchain address)
```

- Frontend için hiçbir şey değişmeyecek
- Sadece format farklı olacak

---

## 📊 Değişmeyen vs Değişecek

### ✅ Değişmeyecekler (Motor Swap)
- Tüm ekranlar
- Endpoint isimleri (/wallet/info, /transactions/send-tip)
- Hook isimleri (useWalletBalance, useSendTips)
- Transaction model (actionType, status, txHash)
- UI state'leri (pending, confirmed, failed)
- Error handling
- Polling mekanizması

### 🔄 Sadece Değişecekler
- `WalletService.createWallet()` içeriği (Backend → Thirdweb)
- Backend transaction processor (Timer → Blockchain event)
- `walletIdentifier` formatı (Fake → Real)
- `txHash` değeri (null → Real tx hash)
- `provider` değeri ('backend' → 'thirdweb')

---

## 🚀 Backend İhtiyaçları

### Implementasyon Gerekli Endpoint'ler

**Kritik (Şimdi Yapılmalı):**
1. `POST /api/wallet/create` - Wallet oluşturma
2. `GET /api/wallet/info` - Wallet bilgileri
3. `GET /api/wallet/balance` - Balance hesaplama (ledger-based)
4. `POST /api/transactions/send-tip` - Tip gönderme
5. `GET /api/transactions/:id` - Transaction status
6. `GET /api/transactions/history` - Transaction geçmişi (grouped)

**Database Schema:**
```sql
-- wallet tablosu
CREATE TABLE wallet (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  wallet_identifier VARCHAR(255) NOT NULL UNIQUE,
  provider VARCHAR(50) DEFAULT 'tipbox_ledger',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- transaction tablosu (en kritik)
CREATE TABLE transaction (
  id UUID PRIMARY KEY,
  wallet_id UUID REFERENCES wallet(id),
  action_type VARCHAR(50) NOT NULL,  -- TIP_SEND, TIP_RECEIVE, CLAIM, etc.
  status VARCHAR(20) NOT NULL,       -- created, pending, confirmed, failed
  amount DECIMAL(20, 8),
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  metadata JSONB,
  tx_hash VARCHAR(255),              -- null for now
  provider VARCHAR(50) DEFAULT 'backend',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  failed_at TIMESTAMP
);
```

**Backend Logic:**
- Transaction yaratma → status: pending
- 2-3 saniye sonra → status: confirmed
- SEND transaction yaratınca karşı tarafa RECEIVE transaction yarat
- Balance her zaman transaction'lardan hesapla (asla direkt tutma)

---

## 📝 Sonraki Adımlar

### Backend Todo (Öncelikli):
1. ✅ Database schema oluşturma
2. ✅ Wallet CRUD endpoints
3. ✅ Transaction endpoints
4. ✅ Balance calculation service
5. ✅ Transaction processor (async pending → confirmed)

### Frontend Todo (Backend Hazır Olduktan Sonra):
6. ⏳ WalletScreen'i backend'e bağlama
7. ⏳ SendBottomSheet transaction flow
8. ⏳ ClaimBottomSheet implementation
9. ⏳ SwapScreen implementation
10. ⏳ NFT display ve marketplace

### Test Todo:
11. ⏳ End-to-end flow test
12. ⏳ Error handling test
13. ⏳ Edge case'ler

---

## 💡 Önemli Notlar

### 1. Backward Compatibility
Mevcut kodları kırmamak için eski endpoint'ler ve hook'lar korunuyor:
- `getWallets()`, `useWallets()` → deprecated
- `connectWallet()` → deprecated
- Zamanla temizlenecek

### 2. Transaction Status Mesajları
```tsx
created   → ⏱️ "İşlem oluşturuluyor..." (gri)
pending   → ⏳ "İşlem işleniyor..." (turuncu)
confirmed → ✅ "İşlem tamamlandı" (yeşil)
failed    → ❌ "İşlem başarısız" (kırmızı)
```

### 3. Balance Refetch Strategy
- Her 10 saniyede refetch
- Backend 10 saniye cache kullanır
- Mutation sonrası invalidate
- Mount'ta refetch, window focus'ta refetch

### 4. Error Handling Strategy
- Backend error code → Türkçe mesaj
- HTTP status → Generic mesaj
- Network error → "Ağ hatası"
- Timeout → "Zaman aşımı"
- Retry edilebilir hatalar otomatik retry

---

## 🎉 Sonuç

Frontend tarafı **Web2 motor ile çalışmaya hazır** şekilde implement edildi.

**Anahtar Başarı:**
- Ekranlar Web3 UX davranışları gösterecek (pending, confirmed, failed)
- Ama arka planda şimdilik backend ledger sistemi çalışacak
- İleride tek motor değişimi (Backend → Thirdweb) ile Web3'e geçilecek
- Kullanıcı hiçbir fark etmeyecek

**Sırada:**
Backend endpoint'lerin implementasyonu ve frontend'in bu endpoint'lere bağlanması.

