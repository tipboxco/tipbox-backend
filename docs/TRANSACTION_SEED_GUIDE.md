# Transaction Seed Dokümantasyonu

Bu dokümantasyon, yeni oluşturulan transaction ve wallet seed sisteminin kullanımını açıklar.

## 📋 İçerik

1. [Genel Bakış](#genel-bakış)
2. [Seed Fonksiyonları](#seed-fonksiyonları)
3. [Kullanım](#kullanım)
4. [Test Etme](#test-etme)
5. [Oluşturulan Veriler](#oluşturulan-veriler)

---

## Genel Bakış

Transaction seed sistemi, yeni wallet ve transaction endpoint'lerini test etmek için gerçekçi test verileri oluşturur. Sistem şu senaryoları kapsar:

- ✅ Wallet oluşturma
- ✅ Airdrop (başlangıç bakiyesi)
- ✅ TIPS transferleri (gönderme/alma)
- ✅ Reward claim'leri
- ✅ Badge claim'leri
- ✅ NFT alım/satım
- ✅ Pending transaction'lar
- ✅ Failed transaction'lar

## Seed Fonksiyonları

### Ana Fonksiyon: `seedTransactions()`

```typescript
interface TransactionSeedResult {
  totalWallets: number;
  totalTransactions: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

async function seedTransactions(): Promise<TransactionSeedResult>
```

### Alt Fonksiyonlar

#### 1. `seedWallets(userIds: string[])`
- Her kullanıcı için bir wallet oluşturur
- Eğer kullanıcının zaten connected wallet'i varsa, yeniden oluşturmaz
- Mock public address üretir: `0xTIPBOX_{userId}_{timestamp}`

#### 2. `seedAirdrops(users: any[], walletMap: Map<string, string>)`
- Her kullanıcıya 1000-5000 TIPS arasında başlangıç bakiyesi verir
- Status: `CONFIRMED`
- ActionType: `AIRDROP`
- Son 30 gün içinde rastgele tarih atar

#### 3. `seedTipTransfers(users: any[], walletMap: Map<string, string>)`
- Kullanıcılar arası TIPS transferleri oluşturur
- **Bugün:** 5 transfer (son 12 saat içinde)
- **Dün:** 3 transfer
- **Geçen hafta:** 4 transfer
- Her transfer için hem SEND hem RECEIVE transaction oluşturur
- Çeşitli nedenler ekler: "Great advice", "Birthday gift", "Coffee money" vb.

#### 4. `seedRewardClaims(users: any[], walletMap: Map<string, string>)`
- Ladder, Support, Event reward'ları oluşturur
- İlk 10 kullanıcı için 1-3 reward claim
- Miktarlar: 250-500 TIPS
- Son 7 gün içinde rastgele tarih

#### 5. `seedBadgeClaims(users: any[], walletMap: Map<string, string>)`
- Badge claim transaction'ları oluşturur
- İlk 8 kullanıcı için 1-2 badge claim
- Miktarlar: 50-250 TIPS
- Mevcut badge'lerden rastgele seçer

#### 6. `seedNFTTransactions(users: any[], walletMap: Map<string, string>)`
- NFT alım-satım transaction'ları oluşturur
- 3 NFT işlemi (hem alıcı hem satıcı için)
- Gas fee hesaplama (%5)
- Fiyatlar: 500-1500 TIPS

#### 7. `seedPendingTransactions(users: any[], walletMap: Map<string, string>)`
- Test için bekleyen transaction'lar oluşturur
- 2 pending TIPS transfer
- Status: `PENDING`

#### 8. `seedFailedTransactions(users: any[], walletMap: Map<string, string>)`
- Test için başarısız transaction'lar oluşturur
- 2 failed transaction
- Çeşitli hata mesajları: "Insufficient balance", "Network timeout", vb.

## Kullanım

### 1. Ana Seed Süreci ile Birlikte

Ana seed dosyası (`prisma/seed.ts`) artık transaction seed'i otomatik olarak çalıştırır:

```bash
npm run prisma:seed
# veya
npx ts-node prisma/seed.ts
```

Transaction seed süreci diğer tüm seed'lerden **SONRA** çalışır, böylece kullanıcılar, badge'ler ve NFT'ler zaten mevcut olur.

### 2. Sadece Transaction Seed

Sadece transaction verilerini oluşturmak için test scriptini kullanabilirsiniz:

```bash
npx ts-node scripts/test-transaction-seed.ts
```

Bu script:
- ✅ Mevcut durum kontrolü yapar
- ✅ Transaction seed'i çalıştırır
- ✅ Sonuçları detaylı gösterir
- ✅ Örnek transaction'ları listeler
- ✅ Wallet bakiyelerini hesaplar ve gösterir

## Test Etme

### Manuel API Testi

Transaction seed'den sonra şu endpoint'leri test edebilirsiniz:

#### 1. Wallet Bilgisi
```bash
curl -X GET http://localhost:5001/wallets/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Beklenen yanıt:
```json
{
  "id": "wallet_id",
  "userId": "user_id",
  "publicAddress": "0xTIPBOX_...",
  "provider": "CUSTOM",
  "isConnected": true,
  "shortAddress": "0xTIPB...1234"
}
```

#### 2. Bakiye Sorgulama
```bash
curl -X GET http://localhost:5001/wallets/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Beklenen yanıt:
```json
{
  "totalBalance": 2500.00,
  "availableBalance": 2500.00,
  "lockedBalance": 0,
  "currency": "TIPS"
}
```

#### 3. Transaction Geçmişi
```bash
curl -X GET http://localhost:5001/wallets/transactions?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Beklenen yanıt:
```json
{
  "items": [
    {
      "id": "tx_id",
      "actionType": "TIP_RECEIVE",
      "amount": 100,
      "status": "CONFIRMED",
      "fromAddress": "0xTIPBOX_...",
      "toAddress": "0xTIPBOX_...",
      "metadata": {
        "reason": "Great advice, thanks!",
        "senderUserId": "sender_id"
      },
      "confirmedAt": "2026-01-12T10:30:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "last_tx_id",
    "hasMore": true,
    "limit": 10
  }
}
```

#### 4. TIPS Gönderme
```bash
curl -X POST http://localhost:5001/wallets/send-tips \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "recipient_user_id",
    "amount": 50,
    "reason": "Thanks for your help!"
  }'
```

### Otomatik Test Scripti

Test scripti (`scripts/test-transaction-seed.ts`) şunları kontrol eder:

1. ✅ **Kullanıcı Kontrolü:** En az 2 kullanıcı olmalı
2. ✅ **Wallet Oluşturma:** Her kullanıcı için wallet oluşturulmalı
3. ✅ **Transaction Çeşitliliği:** Farklı tipte transaction'lar olmalı
4. ✅ **Bakiye Hesaplama:** Wallet bakiyeleri doğru hesaplanmalı
5. ✅ **İstatistikler:** Type ve status dağılımı gösterilmeli

## Oluşturulan Veriler

### Transaction Tipleri ve Miktarları

| Tip | Senaryo | Adet | Status | Miktar |
|-----|---------|------|--------|--------|
| `AIRDROP` | Başlangıç bakiyesi | ~20 | CONFIRMED | 1000-5000 TIPS |
| `TIP_SEND` | TIPS gönderme | ~12 | CONFIRMED | 25-500 TIPS |
| `TIP_RECEIVE` | TIPS alma | ~12 | CONFIRMED | 25-500 TIPS |
| `CLAIM_REWARD` | Ödül toplama | ~20 | CONFIRMED | 250-500 TIPS |
| `CLAIM_BADGE` | Badge toplama | ~8 | CONFIRMED | 50-250 TIPS |
| `NFT_BUY` | NFT satın alma | ~3 | CONFIRMED | 500-1500 TIPS |
| `NFT_SELL` | NFT satma | ~3 | CONFIRMED | 475-1425 TIPS (-%5 gas) |
| `TIP_SEND` | Bekleyen transfer | 2 | PENDING | 20-120 TIPS |
| `TIP_SEND` | Başarısız transfer | 2 | FAILED | 1000 TIPS |

**Toplam:** ~82 transaction (20 kullanıcı için)

### Wallet Yapısı

```typescript
{
  id: "uuid",
  userId: "uuid",
  publicAddress: "0xTIPBOX_{userId}_{timestamp}",
  provider: "CUSTOM",
  isConnected: true,
  createdAt: Date,
  updatedAt: Date
}
```

### Transaction Yapısı

```typescript
{
  id: "uuid",
  walletId: "uuid",
  actionType: TransactionActionType,
  status: TransactionStatus,
  amount: number,
  fromAddress: string | null,
  toAddress: string | null,
  metadata: {
    reason?: string,
    recipientUserId?: string,
    senderUserId?: string,
    nftId?: string,
    badgeId?: string,
    rewardType?: string,
    // ... diğer meta veriler
  },
  txHash: string | null,  // Mock: 0x + 64 hex karakter
  provider: "backend",
  errorMessage: string | null,
  createdAt: Date,
  confirmedAt: Date | null,
  failedAt: Date | null
}
```

### Örnek Senaryolar

#### Senaryo 1: Yeni Kullanıcı
1. Airdrop: 3000 TIPS (başlangıç)
2. TIPS Receive: +150 TIPS (hediye)
3. Badge Claim: +100 TIPS
4. **Toplam Bakiye:** 3250 TIPS

#### Senaryo 2: Aktif Kullanıcı
1. Airdrop: 2500 TIPS
2. TIPS Send: -200 TIPS (hediye gönderdi)
3. TIPS Receive: +50 TIPS
4. Reward Claim: +370 TIPS
5. NFT Buy: -800 TIPS
6. **Toplam Bakiye:** 1920 TIPS

#### Senaryo 3: NFT Trader
1. Airdrop: 4000 TIPS
2. NFT Buy: -1200 TIPS
3. NFT Sell: +1140 TIPS (-%5 gas)
4. TIPS Receive: +100 TIPS
5. **Toplam Bakiye:** 4040 TIPS

## Bakiye Hesaplama Mantığı

```typescript
// ARTTIRANLAR
+ AIRDROP
+ TIP_RECEIVE
+ CLAIM_REWARD
+ CLAIM_BADGE
+ NFT_SELL
+ SWAP_SOL_TO_TIP

// AZALTANLAR
- TIP_SEND
- NFT_BUY
- SWAP_TIP_TO_SOL
- FEE
```

## Zaman Dağılımı

- **Airdrop:** Son 30 gün içinde rastgele
- **Bugünkü Transferler:** Son 12 saat
- **Dünkü Transferler:** 24-48 saat önce
- **Geçen Hafta:** 2-7 gün önce
- **Reward Claims:** Son 7 gün
- **Badge Claims:** Son 14 gün
- **NFT Transactions:** Son 10 gün

## Notlar

1. **Idempotent değil:** Her çalıştırmada yeni veriler oluşturur
2. **Bakiye kontrolü yok:** Negatif bakiye oluşabilir (test amaçlı)
3. **Gerçek blockchain entegrasyonu yok:** Mock tx hash'ler kullanılır
4. **Provider:** Tüm transaction'lar "backend" provider ile oluşturulur
5. **Wallet unique constraint:** Her kullanıcı için provider başına 1 wallet

## Sorun Giderme

### "Not enough users to seed transactions"
```bash
# Önce ana seed'i çalıştırın
npm run prisma:seed
```

### "Wallet already exists"
- Normal bir durum, seed fonksiyonu mevcut wallet'ları kullanır

### "Database not reachable"
```bash
# Docker container'ları başlatın
docker-compose up -d
```

### Transaction sayısı beklenenden az
- Badge'ler veya NFT'ler eksik olabilir
- Ana seed'i önce çalıştırdığınızdan emin olun

## İleri Düzey Kullanım

### Sadece Belirli Senaryoları Çalıştırma

Transaction seed fonksiyonunu özelleştirerek sadece istediğiniz senaryoları çalıştırabilirsiniz:

```typescript
import { seedTransactions } from './prisma/seed/transaction-seed';

// Tüm senaryolar
await seedTransactions();

// Veya alt fonksiyonları direkt çağırabilirsiniz
import { seedAirdrops, seedTipTransfers } from './prisma/seed/transaction-seed';

const users = await prisma.user.findMany({ take: 10 });
const walletMap = await seedWallets(users.map(u => u.id));

await seedAirdrops(users, walletMap);
await seedTipTransfers(users, walletMap);
```

### Özel Miktarlar ve Tarihler

Fonksiyonları kopyalayıp özelleştirebilirsiniz:

```typescript
// Özel miktar ile airdrop
await prisma.transaction.create({
  data: {
    walletId,
    actionType: TransactionActionType.AIRDROP,
    status: TransactionStatus.CONFIRMED,
    amount: 10000, // Özel miktar
    // ...
  }
});
```

## Özet

Transaction seed sistemi:
- ✅ 20 kullanıcı için ~82 transaction oluşturur
- ✅ 9 farklı transaction tipi kapsar
- ✅ 4 farklı status durumu içerir
- ✅ Gerçekçi zaman dağılımı kullanır
- ✅ Metadata ile zenginleştirilmiş veriler sağlar
- ✅ Test ve geliştirme için hazırdır

---

**Son Güncelleme:** 12 Ocak 2026
**Versiyon:** 1.0.0

