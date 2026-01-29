# Thirdweb Engine Webhook Integration

TipBox Backend için Thirdweb Engine webhook entegrasyonu - ERC20 Token ve ERC721 NFT desteği.

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Tek URL ve Payload Ayrımı](#tek-url-ve-payload-ayrımı)
- [Desteklenen Token Türleri](#desteklenen-token-türleri)
- [Sistem Mimarisi](#sistem-mimarisi)
  - [Veri akışı: Wallet, Transaction ve log tabloları](#veri-akışı-wallet-transaction-ve-log-tabloları)
- [Contract Event Subscriptions (v1.events)](#contract-event-subscriptions-v1events)
- [Transaction Webhooks](#transaction-webhooks)
- [İmza Doğrulama ve Ortam Değişkenleri](#i̇mza-doğrulama-ve-ortam-değişkenleri)
- [Token Türü Tespiti](#token-türü-tespiti)
- [Event İşleme Akışı](#event-i̇şleme-akışı)
- [API Endpoints](#api-endpoints)
- [Prisma Şema](#prisma-şema)
- [Güvenlik](#güvenlik)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Debug ve Loglama](#debug-ve-loglama)
- [Kullanım Örnekleri](#kullanım-örnekleri)
- [Test Etme](#test-etme)
- [Referanslar](#referanslar)

---

## Genel Bakış

Bu sistem Thirdweb Engine üzerinden blockchain event'lerini dinler ve işler:

- **ERC20 Token** transferleri (TIPS, USDT vb.)
- **ERC721 NFT** mint/transfer işlemleri
- **Approval** event'leri
- **Mint/Burn** işlemleri
- **Transaction lifecycle** (sent, mined, errored, cancelled)

---

## Tek URL ve Payload Ayrımı

Thirdweb hem **Transaction Webhooks** hem **Contract Subscriptions (v1.events)** için aynı webhook URL'ini kullanabilir. Backend gelen body'ye göre türü ayırır:

| Gelen body | Tür | İşleyen servis |
|------------|-----|-----------------|
| `topic === "v1.events"` ve `data` array | Contract Subscription (v1.events) | ContractEventService |
| `type` = `engine.transaction.sent/mined/errored/cancelled` veya `data.queueId` | Transaction webhook | ThirdwebWebhookService |

- **Endpoint:** `POST /api/webhooks/thirdweb` (tek URL).
- **Routing:** Body parse edilir; `topic === 'v1.events'` ve `Array.isArray(data)` ise v1.events dalına, değilse transaction dalına gider.
- **Alternatif:** Contract events için ayrı endpoint `POST /api/webhooks/thirdweb/events` da desteklenir; Thirdweb Dashboard'da tek URL (`/api/webhooks/thirdweb`) kullanılırsa her iki tip de burada toplanır.

### Payload formatları özeti

| Tür | Üst seviye alanlar | İşlenen veri |
|-----|--------------------|--------------|
| **Transaction** | `id`, `type` (örn. `engine.transaction.sent`), `triggered_at`, `object`, **`data`** (obje) | `data.queueId`, `data.status`, `data.chainId`, `data.fromAddress`, `data.toAddress`, … (normalizer ile düzleştirilir) |
| **v1.events** | `timestamp`, **`topic`** (`"v1.events"`), **`data`** (array) | `data[]` içindeki her öğe: `data.decoded.name` (Transfer/Approval), `data.decoded.indexed_params.from/to`, … |

---

## Desteklenen Token Türleri

| Token Türü | Transfer | Mint | Burn | Approval | Balance Güncelleme |
|------------|:--------:|:----:|:----:|:--------:|:------------------:|
| **ERC20** (TIPS vb.) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ERC721** (NFT) | ✅ | ✅ | ✅ | ✅ | - |

### ERC20 Token İşlemleri

- **Deposit**: External wallet'tan (Metamask vb.) TipBox wallet'a gelen token
- **Withdraw**: TipBox wallet'tan external wallet'a gönderilen token
- **Internal Transfer**: TipBox wallet'lar arası transfer
- **Mint** (from = 0x0): Alıcı wallet'a token eklenir
- **Burn** (to = 0x0): Gönderen wallet'tan token düşülür
- **Approval**: Log kaydı tutulur

### ERC721 NFT İşlemleri

- **Mint**: Transaction confirm edilir, NFT ownership güncellenir
- **Transfer**: Wallet eşleştirmesi yapılır
- **Approval**: Log kaydı tutulur

### TransactionActionType Enum

| Action Type | Açıklama | Provider |
|-------------|----------|----------|
| `TIP_SEND` | Kullanıcıdan kullanıcıya tip gönderimi | thirdweb |
| `TIP_RECEIVE` | Kullanıcıdan tip alımı | thirdweb |
| `DEPOSIT` | External wallet'tan (Metamask) gelen token | external |
| `WITHDRAW` | External wallet'a gönderilen token | external |
| `CLAIM_REWARD` | Ödül claim işlemi | thirdweb |
| `CLAIM_BADGE` | NFT badge claim işlemi | thirdweb |
| `AIRDROP` | Airdrop token dağıtımı | thirdweb |
| `NFT_BUY` | NFT satın alma | thirdweb |
| `NFT_SELL` | NFT satış | thirdweb |
| `SWAP_TIP_TO_SOL` | TIP → SOL swap | thirdweb |
| `SWAP_SOL_TO_TIP` | SOL → TIP swap | thirdweb |
| `FEE` | İşlem ücreti | system |

---

## Sistem Mimarisi

### Üst seviye akış (tek URL)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THIRDWEB WEBHOOK SYSTEM (Tek URL)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│              POST /api/webhooks/thirdweb                                    │
│              (body'ye göre routing: topic vs queueId)                       │
│                              │                                              │
│              ┌───────────────┴───────────────┐                              │
│              ▼                               ▼                              │
│   topic === "v1.events"              engine.transaction.*                    │
│   ┌─────────────────────────┐      ┌─────────────────────────┐              │
│   │  ContractEventService   │      │ ThirdwebWebhookService  │              │
│   │  • Transfer (ERC20/721) │      │ • sent / mined          │              │
│   │  • Approval             │      │ • errored / cancelled   │              │
│   │  • Mint / Burn          │      │                         │              │
│   └───────────┬─────────────┘      └───────────┬─────────────┘              │
│               │                                │                             │
│               ▼                                ▼                             │
│   ┌─────────────────────────┐      ┌─────────────────────────┐              │
│   │   ContractEventLog       │      │  ThirdwebWebhookLog      │              │
│   │   (DB)                   │      │  (DB)                    │              │
│   └───────────┬─────────────┘      └───────────┬─────────────┘              │
│               │                                │                             │
│               └────────────────┬───────────────┘                             │
│                                ▼                                             │
│                    ┌─────────────────────────┐                              │
│                    │ TransactionService      │  WalletService                │
│                    │ confirmTransaction()    │  updateBalance()              │
│                    └─────────────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Veri akışı: Wallet, Transaction ve log tabloları

Webhook’lar hangi **DB tablolarını** okuyup yazıyor, **Wallet** ve **Transaction** ile nasıl eşleşiyor — aşağıdaki diyagram ve tablo bunu gösterir.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  TRANSACTION WEBHOOK (engine.transaction.sent / mined / errored / cancelled)              │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                           │
│   Payload (data.toAddress, data.queueId, data.transactionHash, data.status)               │
│        │                                                                                  │
│        ├──► Wallet tablosu        : findByPublicAddress(toAddress)  → walletId           │
│        │                            (eşleşme: publicAddress, case-insensitive)            │
│        │                                                                                  │
│        ├──► Transaction tablosu  : queueId / txHash / pending ile bulunur                │
│        │                            • sent   → status = PENDING, txHash güncelleme        │
│        │                            • mined  → confirmTransaction() veya failTransaction() │
│        │                            • errored/cancelled → failTransaction()                │
│        │                                                                                  │
│        └──► ThirdwebWebhookLog    : Her webhook isteği için upsert (queueId unique)       │
│                                     transactionId ile Transaction’a FK                    │
│                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  CONTRACT EVENTS (v1.events – Transfer / Approval)                                        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                           │
│   Payload (data[].data.decoded.indexed_params.from / .to, amount, eventName)             │
│        │                                                                                  │
│        ├──► Wallet tablosu        : findByPublicAddress(from) / findByPublicAddress(to)   │
│        │                            Sadece from veya to DB’de kayıtlıysa event işlenir    │
│        │                            (relevance check)                                      │
│        │                                                                                  │
│        ├──► Transaction tablosu   : DEPOSIT/WITHDRAW → create; pending varsa confirm     │
│        │                            TIP_SEND/TIP_RECEIVE (internal) → confirmTransaction  │
│        │                            Mint/Claim → confirmTransaction                        │
│        │                                                                                  │
│        ├──► WalletService         : updateBalance(walletId, ±amount) — balance güncelleme │
│        │                                                                                  │
│        └──► ContractEventLog      : Her işlenen event için insert (txHash + logIndex      │
│                                     unique); walletId, transactionId FK                   │
│                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tablo kullanım özeti

| Tablo / Yapı | Transaction webhook | v1.events (Contract) |
|--------------|---------------------|----------------------|
| **Wallet** | Okuma: `toAddress` ile eşleşen wallet bulunur. | Okuma: `from` / `to` ile eşleşen wallet’lar bulunur; sadece biri varsa işlem yapılır. |
| **Transaction** | Okuma: queueId, txHash veya pending tx ile bulunur. Güncelleme: status (PENDING → confirmed/failed), txHash. | Okuma: Pending DEPOSIT/WITHDRAW/TIP_* ile eşleşme. Oluşturma: Yeni DEPOSIT/WITHDRAW. Güncelleme: confirmTransaction(). |
| **ThirdwebWebhookLog** | Yazma: Her transaction webhook için upsert (queueId); transactionId FK. | Kullanılmaz. |
| **ContractEventLog** | Kullanılmaz. | Yazma: Her işlenen event için insert; walletId, transactionId FK. |
| **WalletService (balance)** | Dolaylı (Transaction üzerinden). | Doğrudan: updateBalance(walletId, ±amount) (DEPOSIT/WITHDRAW/Mint/Burn). |

---

## Contract Event Subscriptions (v1.events)

### Desteklenen Event'ler

| Event | Token Türü | Açıklama |
|-------|------------|----------|
| `Transfer` | ERC20/ERC721 | Token veya NFT transferi |
| `Approval` | ERC20/ERC721 | Token onayı |

### Thirdweb v1.events Payload Formatı (Yeni)

```json
{
  "timestamp": 1769530718,
  "topic": "v1.events",
  "data": [
    {
      "data": {
        "chain_id": "1",
        "block_number": 22140383,
        "block_hash": "0x...",
        "block_timestamp": 1743104207,
        "transaction_hash": "0x...",
        "transaction_index": 93,
        "log_index": 230,
        "address": "0x...",
        "data": "0x...",
        "topics": ["0xddf252ad..."],
        "decoded": {
          "name": "Transfer",
          "indexed_params": {
            "from": "0x...",
            "to": "0x..."
          },
          "non_indexed_params": {
            "amount": "41729516213800138"
          }
        }
      },
      "status": "new",
      "type": "event",
      "id": "..."
    }
  ]
}
```

> **Not:** Sistem hem yeni `v1.events` formatını hem de legacy `event-log` formatını destekler.

### Payload Yapısı - ERC20 Transfer

```json
{
  "type": "event-log",
  "data": {
    "chainId": 11155111,
    "contractAddress": "0xYourTokenContract",
    "blockNumber": 14306496,
    "transactionHash": "0xabc123...",
    "eventName": "Transfer",
    "decodedLog": {
      "from": { "type": "address", "value": "0x0000000000000000000000000000000000000000" },
      "to": { "type": "address", "value": "0xRecipientAddress" },
      "value": { "type": "uint256", "value": "1000000000000000000" }
    },
    "timestamp": 1715402339000,
    "transactionIndex": 33,
    "logIndex": 91
  }
}
```

### Payload Yapısı - ERC721 Transfer (NFT)

```json
{
  "type": "event-log",
  "data": {
    "chainId": 11155111,
    "contractAddress": "0xYourNFTContract",
    "blockNumber": 14306496,
    "transactionHash": "0xdef456...",
    "eventName": "Transfer",
    "decodedLog": {
      "from": { "type": "address", "value": "0x0000000000000000000000000000000000000000" },
      "to": { "type": "address", "value": "0xRecipientAddress" },
      "tokenId": { "type": "uint256", "value": "1" }
    },
    "timestamp": 1715402339000,
    "transactionIndex": 33,
    "logIndex": 91
  }
}
```

### Payload Yapısı - Approval

```json
{
  "type": "event-log",
  "data": {
    "chainId": 11155111,
    "contractAddress": "0xYourTokenContract",
    "eventName": "Approval",
    "decodedLog": {
      "owner": { "type": "address", "value": "0xOwnerAddress" },
      "spender": { "type": "address", "value": "0xSpenderAddress" },
      "value": { "type": "uint256", "value": "1000000000000000000" }
    }
  }
}
```

---

## Token Türü Tespiti

Sistem gelen event'in `decodedLog` içeriğine bakarak **otomatik olarak** token türünü belirler:

```typescript
// contract-event.dto.ts

if (tokenId && !value) {
  tokenType = TokenType.ERC721;  // NFT - tokenId var, value yok
} else if (value && !tokenId) {
  tokenType = TokenType.ERC20;   // Token - value var, tokenId yok
} else if (value) {
  tokenType = TokenType.ERC20;   // Varsayılan: value varsa ERC20
}
```

### Token Türü Enum

```typescript
enum TokenType {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  UNKNOWN = 'UNKNOWN'
}
```

---

## Event İşleme Akışı

### Wallet Relevance Check (İlgililik Kontrolü)

Contract üzerindeki her aktivite sistemimizle ilgili olmayabilir. **Sadece tanımlı wallet'lar** için event işlenir:

```
Event Geldi
    │
    ▼
checkEventRelevance()
    │
    ├─── Transfer Event?
    │         │
    │         ├─── from veya to adresi sistemde tanımlı mı?
    │         │         │
    │         │         ├── EVET → İşleme devam et
    │         │         │
    │         │         └── HAYIR → Event atla (log kaydedilmez)
    │         │
    │         └─── Mint/Burn özel durumu:
    │                   • Mint: Sadece to adresi kontrol edilir
    │                   • Burn: Sadece from adresi kontrol edilir
    │
    └─── Approval Event?
              │
              └─── owner adresi sistemde tanımlı mı?
                        │
                        ├── EVET → İşleme devam et
                        │
                        └── HAYIR → Event atla
```

> **Önemli:** Tanımsız adresler arasındaki transferler işlenmez ve database'e kaydedilmez. Bu gereksiz log yükünü önler.

### ERC20 Token Transfer Akışı

```
Transfer Event Geldi
        │
        ▼
parseTransferEvent() → TokenType.ERC20
        │
        ├─── isMint (from = 0x0)
        │         │
        │         └── toWallet? → confirmTransaction() veya updateBalance(+amount)
        │
        ├─── isBurn (to = 0x0)
        │         │
        │         └── fromWallet? → updateBalance(-amount)
        │
        └─── Normal Transfer
                  │
                  ├─── DEPOSIT (External → TipBox)
                  │    toWallet var, fromWallet YOK
                  │         │
                  │         ├── Pending transaction var?
                  │         │         ├── Evet → confirmTransaction()
                  │         │         └── Hayır → Yeni DEPOSIT transaction oluştur
                  │         │
                  │         └── Balance += amount
                  │
                  ├─── WITHDRAW (TipBox → External)
                  │    fromWallet var, toWallet YOK
                  │         │
                  │         ├── Pending transaction var?
                  │         │         ├── Evet → confirmTransaction()
                  │         │         └── Hayır → Yeni WITHDRAW transaction oluştur
                  │         │
                  │         └── Balance -= amount
                  │
                  └─── INTERNAL (TipBox → TipBox)
                       İkisi de sistemde kayıtlı
                             │
                             └── İlgili pending transaction'ları onayla
```

### Deposit/Withdraw Senaryoları

| Senaryo | from | to | İşlem |
|---------|------|-----|-------|
| **Deposit** | Metamask (external) | TipBox wallet | `DEPOSIT` transaction oluştur, balance += amount |
| **Withdraw** | TipBox wallet | Metamask (external) | `WITHDRAW` transaction oluştur, balance -= amount |
| **Internal** | TipBox wallet A | TipBox wallet B | `TIP_SEND` + `TIP_RECEIVE` confirm |

### ERC721 NFT Transfer Akışı

```
Transfer Event Geldi
        │
        ▼
parseTransferEvent() → TokenType.ERC721
        │
        ├─── isMint (from = 0x0)
        │         │
        │         ▼
        │    toWallet bulundu?
        │         │
        │         └── Pending CLAIM_BADGE/CLAIM_REWARD transaction?
        │                   │
        │                   └── confirmTransaction()
        │
        └─── Normal Transfer
                  │
                  └── Wallet eşleştir, log kaydet
```

---

## API Endpoints

### Transaction Webhooks

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| `POST` | `/api/webhooks/thirdweb` | Signature | Transaction **ve** v1.events (tek URL; body'ye göre ayrılır) |
| `GET` | `/api/webhooks/thirdweb/health` | - | Health check |
| `GET` | `/api/webhooks/thirdweb/logs` | JWT | Son webhook logları |
| `GET` | `/api/webhooks/thirdweb/logs/:queueId` | JWT | Queue ID ile log detayı |
| `GET` | `/api/webhooks/thirdweb/stats` | JWT | Webhook istatistikleri |
| `GET` | `/api/webhooks/thirdweb/transaction/:transactionId` | JWT | Transaction logları |

### Contract Event Subscriptions

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| `POST` | `/api/webhooks/thirdweb/events` | Signature | Contract event receiver (alternatif; ana URL `/api/webhooks/thirdweb` da kabul eder) |
| `GET` | `/api/webhooks/thirdweb/events/logs` | JWT | Son event logları |
| `GET` | `/api/webhooks/thirdweb/events/stats` | JWT | Event istatistikleri |
| `GET` | `/api/webhooks/thirdweb/events/by-hash/:txHash` | JWT | TxHash ile loglar |
| `GET` | `/api/webhooks/thirdweb/events/by-wallet/:walletId` | JWT | Wallet ile loglar |
| `POST` | `/api/webhooks/thirdweb/events/reprocess` | JWT | Yeniden işle |

---

## Prisma Şema

### ThirdwebWebhookLog (Transaction Webhooks)

```prisma
model ThirdwebWebhookLog {
  id              String                    @id @default(uuid()) @db.Uuid
  queueId         String                    @unique @map("queue_id")
  status          ThirdwebWebhookStatus
  onchainStatus   ThirdwebOnchainStatus?    @map("onchain_status")
  chainId         Int                       @map("chain_id")
  fromAddress     String                    @map("from_address")
  toAddress       String                    @map("to_address")
  transactionHash String?                   @map("transaction_hash")
  blockNumber     Int?                      @map("block_number")
  functionName    String?                   @map("function_name")
  functionArgs    String?                   @map("function_args")
  errorMessage    String?                   @map("error_message")
  rawPayload      Json                      @map("raw_payload")
  transactionId   String?                   @map("transaction_id") @db.Uuid
  processedAt     DateTime                  @default(now()) @map("processed_at")
  createdAt       DateTime                  @default(now()) @map("created_at")
  transaction     Transaction?              @relation(...)

  @@map("thirdweb_webhook_logs")
}
```

### ContractEventLog (Contract Events)

```prisma
model ContractEventLog {
  id               String    @id @default(uuid()) @db.Uuid
  chainId          Int       @map("chain_id")
  contractAddress  String    @map("contract_address")
  blockNumber      Int       @map("block_number")
  transactionHash  String    @map("transaction_hash")
  transactionIndex Int       @map("transaction_index")
  logIndex         Int       @map("log_index")
  eventName        String    @map("event_name")
  decodedLog       Json      @map("decoded_log")
  topics           String[]
  data             String?
  timestamp        DateTime
  rawPayload       Json      @map("raw_payload")
  transactionId    String?   @map("transaction_id") @db.Uuid
  walletId         String?   @map("wallet_id") @db.Uuid
  processed        Boolean   @default(false)
  processedAt      DateTime? @map("processed_at")
  createdAt        DateTime  @default(now()) @map("created_at")

  @@unique([transactionHash, logIndex])
  @@map("contract_event_logs")
}
```

### Enum'lar

```prisma
enum ThirdwebWebhookStatus {
  sent
  mined
  errored
  cancelled
  @@map("thirdweb_webhook_status")
}

enum ThirdwebOnchainStatus {
  success
  reverted
  @@map("thirdweb_onchain_status")
}
```

---

## Güvenlik

### HTTP Headers

Thirdweb farklı header isimleri kullanabilir, sistem her ikisini de destekler:

| Header (Yeni) | Header (Eski) | Açıklama |
|---------------|---------------|----------|
| `X-Webhook-Signature` | `X-Engine-Signature` | HMAC-SHA256 imza |
| `X-Webhook-Timestamp` | `X-Engine-Timestamp` | Unix timestamp (saniye) |

### Thirdweb Örnek Webhook Kodu

```typescript
import express from "express";
import bodyParser from "body-parser";
import { isValidSignature, isExpired } from "./webhookHelper";

const app = express();
const WEBHOOK_SECRET = "<your_webhook_auth_secret>";

app.use(bodyParser.text());

app.post("/webhook", (req, res) => {
  const signatureFromHeader = req.header("X-Engine-Signature");
  const timestampFromHeader = req.header("X-Engine-Timestamp");

  if (!signatureFromHeader || !timestampFromHeader) {
    return res.status(401).send("Missing signature or timestamp header");
  }

  if (!isValidSignature(req.body, timestampFromHeader, signatureFromHeader, WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid signature");
  }

  if (isExpired(timestampFromHeader, 300)) {
    return res.status(401).send("Request has expired");
  }

  // Process the request
  res.status(200).send("Webhook received!");
});
```

### Signature Doğrulama

```typescript
function generateSignature(body: string, timestamp: string, secret: string): string {
  const payload = `${timestamp}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifySignature(body: string, timestamp: string, signature: string, secret: string): boolean {
  const expected = generateSignature(body, timestamp, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

### Replay Attack Önleme

```typescript
function isExpired(timestamp: string, expirationSeconds: number = 300): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - parseInt(timestamp) > expirationSeconds;
}
```

### HTTP Response Kodları

Thirdweb webhook standartlarına uygun response kodları:

| Status | Durum | Thirdweb Davranışı |
|--------|-------|-------------------|
| **200** | Başarılı işlem | ✅ Retry yok |
| **401** | Missing headers | ❌ Retry yok |
| **401** | Invalid signature | ❌ Retry yok |
| **401** | Expired timestamp | ❌ Retry yok |
| **400** | Invalid JSON payload | ❌ Retry yok |
| **400** | Missing required fields | ❌ Retry yok |
| **400** | Unknown payload format | ❌ Retry yok |
| **500** | Internal server error | 🔄 **Retry yapar** |

### Örnek Response'lar

**Başarılı (200):**
```json
{
  "success": true,
  "action": "created",
  "message": "Event Transfer logged",
  "eventLogId": "uuid-here"
}
```

**Missing Headers (401):**
```json
{
  "success": false,
  "error": "Missing signature or timestamp header"
}
```

**Invalid Signature (401):**
```json
{
  "success": false,
  "error": "Invalid signature"
}
```

**Expired (401):**
```json
{
  "success": false,
  "error": "Request has expired"
}
```

**Invalid Payload (400):**
```json
{
  "success": false,
  "error": "Invalid JSON payload"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "error": "Internal server error while processing webhook"
}
```

---

## Kurulum

### 1. Prisma Migration

```bash
cd backend
npx prisma migrate dev --name add_thirdweb_webhook_system
npx prisma generate
```

### 2. Thirdweb Dashboard - Transaction Webhooks

1. [Thirdweb Dashboard](https://thirdweb.com/dashboard) > Engine > Configuration > **Webhooks**
2. **Create Webhook**
3. URL: `https://your-domain.com/api/webhooks/thirdweb`
4. Events: `all_transaction` (veya ilgili transaction topic’leri)
5. Webhook Secret’ı kopyalayıp `THIRDWEB_WEBHOOK_SECRET` olarak kullanın

### 3. Thirdweb Dashboard - Contract Subscriptions

- **Tek URL (önerilen):** Hem Transaction hem Contract Subscriptions için aynı URL kullanılabilir.
1. [Thirdweb Dashboard](https://thirdweb.com/dashboard) > Engine > **Contract Subscriptions**
2. **Add Contract Subscription**
3. Contract Address: Token veya NFT contract adresi
4. Chain: Sepolia (11155111) veya ilgili chain
5. **Webhook URL:** `https://your-domain.com/api/webhooks/thirdweb` (transaction ile aynı URL)
- Backend gelen body’de `topic === "v1.events"` görünce otomatik olarak event işleme dalına gider.
- İsteğe bağlı: Contract Subscriptions için ayrı webhook tanımlayıp URL’i `https://your-domain.com/api/webhooks/thirdweb/events` yapabilirsiniz.

---

## İmza Doğrulama ve Ortam Değişkenleri

### Transaction webhook

- **Zorunlu:** `X-Webhook-Signature` (veya `X-Engine-Signature`) ve `X-Webhook-Timestamp` (veya `X-Engine-Timestamp`).
- **Secret:** Sadece `THIRDWEB_WEBHOOK_SECRET` kullanılır. İmza geçersizse **401**.

### v1.events (Contract Subscription)

- **Timestamp:** Önce header, yoksa payload içindeki `timestamp` kullanılır.
- **Secret sırası:** Önce `THIRDWEB_WEBHOOK_SECRET`, sonra (tanımlıysa) `THIRDWEB_EVENTS_WEBHOOK_SECRET` denenir. İkisi de header ve payload timestamp ile denenebilir.
- **Development’ta imza atlama:** `THIRDWEB_WEBHOOK_SKIP_SIGNATURE_IN_DEV=true` ve `NODE_ENV !== 'production'` iken imza geçersiz olsa bile v1.events kabul edilir (test için). Varsayılan: `false` (imza zorunlu).

| Ortam | İmza geçersiz v1.events |
|-------|--------------------------|
| Production | Her zaman **401** |
| Development + `SKIP_SIGNATURE_IN_DEV=false` veya unset | **401** |
| Development + `SKIP_SIGNATURE_IN_DEV=true` | Kabul edilir (log uyarısı) |

---

## Ortam Değişkenleri

```env
# ============================================================================
# THIRDWEB WEBHOOK CONFIGURATION
# ============================================================================

# Transaction webhook + (opsiyonel) v1.events için ana secret (Thirdweb Dashboard)
THIRDWEB_WEBHOOK_SECRET=your_webhook_secret_here

# Contract Subscriptions (v1.events) için ayrı secret; Dashboard'da farklı olabilir
THIRDWEB_EVENTS_WEBHOOK_SECRET=

# v1.events: development'ta imza geçersiz olsa bile kabul et (sadece true iken). false/unset = imza zorunlu
THIRDWEB_WEBHOOK_SKIP_SIGNATURE_IN_DEV=false

# Webhook timestamp expiration (saniye, default: 300 = 5 dakika)
THIRDWEB_WEBHOOK_EXPIRATION_SECONDS=300

# Token decimals (default: 18)
TIPS_TOKEN_DECIMALS=18

# İzlenen contract adresleri (opsiyonel, virgülle ayrılmış)
THIRDWEB_WATCHED_CONTRACTS=0xTokenContract,0xNFTContract
```

---

## Dosya Yapısı

```
backend/
├── prisma/
│   └── schema.prisma
│       ├── ThirdwebWebhookLog
│       ├── ContractEventLog
│       ├── ThirdwebWebhookStatus
│       └── ThirdwebOnchainStatus
│
├── src/
│   ├── application/
│   │   └── thirdweb-webhook/
│   │       ├── thirdweb-webhook.service.ts    # Transaction webhook işleme
│   │       └── contract-event.service.ts      # Contract event işleme
│   │
│   ├── interfaces/
│   │   └── thirdweb-webhook/
│   │       ├── THIRDWEB_WEBHOOK_INTEGRATION.md
│   │       ├── thirdweb-webhook.router.ts
│   │       ├── thirdweb-webhook.dto.ts
│   │       └── contract-event.dto.ts
│   │
│   └── infrastructure/
│       └── repositories/
│           ├── thirdweb-webhook-log-prisma.repository.ts
│           ├── contract-event-log-prisma.repository.ts
│           └── wallet-prisma.repository.ts
```

---

## Debug ve Loglama

### Son gelen payload (dosya)

Her başarılı webhook isteğinde (transaction veya v1.events) gelen **ham body** aşağıdaki dosyaya yazılır (üzerine yazar):

- **Dosya:** `logs/last-thirdweb-webhook-payload.json`
- **İçerik:** Son işlenen isteğin `JSON.parse(body)` çıktısı (pretty-print).
- **Amaç:** Thirdweb’in gerçek payload formatını incelemek ve normalizer’ı buna göre güncellemek.

### Log mesajları

| Mesaj | Anlamı |
|-------|--------|
| `Thirdweb webhook incoming (transaction)` | Transaction webhook body’si alındı; topLevelKeys, dataKeys, bodyLength loglanır. |
| `Thirdweb webhook incoming` | (Eski log; artık transaction için yukarıdaki mesaj kullanılıyor.) |
| `v1.events signature invalid, accepting (THIRDWEB_WEBHOOK_SKIP_SIGNATURE_IN_DEV=true)` | Development’ta imza geçersiz ama SKIP_SIGNATURE_IN_DEV=true nedeniyle kabul edildi. |
| `v1.events webhook signature invalid` | v1.events imzası geçersiz; 401 döndü. |
| `v1.events processed on /api/webhooks/thirdweb` | v1.events başarıyla işlendi; eventsReceived, eventsProcessed, eventsSkipped. |
| `Webhook processed successfully` | Transaction webhook işlendi; queueId, status, webhookLogId. |
| `Event skipped - no registered wallet involved` | Contract event’te from/to adresleri DB’deki hiçbir wallet ile eşleşmedi; işlem yapılmadı. |

### Wallet eşleştirme (DB)

- **Transaction webhook:** `payload.toAddress` ile `Wallet.publicAddress` (case-insensitive) eşleştirilir; transaction queueId/txHash/pending ile bulunur.
- **v1.events (Transfer):** `decoded.indexed_params.from` ve `to` adresleri `Wallet.publicAddress` ile (case-insensitive) aranır. Sadece en az biri DB’de kayıtlıysa event işlenir; DEPOSIT/WITHDRAW/Internal/Mint/Burn akışları uygulanır.

---

## Kullanım Örnekleri

### 1. ERC20 Token Transfer Dinleme

Contract subscription oluşturulduktan sonra sistem otomatik olarak:

```typescript
// Transfer event geldiğinde (contract-event.service.ts)

// 1. Token türü tespit edilir
const transferEvent = parseTransferEvent(data.decodedLog, TOKEN_DECIMALS);
// transferEvent.tokenType = TokenType.ERC20

// 2. Alıcı wallet bulunur
const toWallet = await this.walletRepo.findByPublicAddress(transferEvent.to);

// 3. Balance güncellenir
if (toWallet) {
  const amount = weiToToken(transferEvent.value, TOKEN_DECIMALS);
  await this.walletService.updateBalance(toWallet.id, amount, {
    reason: `Token received from ${transferEvent.from}`,
    txHash: data.transactionHash
  });
}
```

### 2. NFT Mint Confirm

```typescript
// NFT mint event geldiğinde

// 1. Token türü tespit edilir
const transferEvent = parseTransferEvent(data.decodedLog);
// transferEvent.tokenType = TokenType.ERC721
// transferEvent.isMint = true (from = 0x0)

// 2. Pending transaction bulunur
const pendingTx = await prisma.transaction.findFirst({
  where: {
    walletId: toWallet.id,
    status: 'pending',
    actionType: { in: ['CLAIM_BADGE', 'CLAIM_REWARD'] }
  }
});

// 3. Transaction confirm edilir
if (pendingTx) {
  await this.transactionService.confirmTransaction(pendingTx.id, txHash);
}
```

### 3. Manuel Token Gönderimi

```typescript
// Backend'den token gönderimi başlatıldığında

// 1. Transaction oluştur
const transaction = await transactionRepo.create({
  walletId: senderWallet.id,
  actionType: TransactionActionType.TIP_SEND,
  amount: amount,
  toAddress: recipientAddress,
  provider: 'thirdweb',
  status: 'pending'
});

// 2. Thirdweb Engine ile gönder
const result = await thirdwebEngine.transfer(tokenContract, recipientAddress, amount);

// 3. Contract event geldiğinde otomatik confirm olur
// ContractEventService.handleTransferEvent() çağrılır
```

---

## Test Etme

### Local Development

```bash
# Tunnel ile local endpoint'i expose edin (ngrok, Cloudflare Tunnel vb.)
# Örnek: cloudflare tunnel → https://xxx.trycloudflare.com

# Thirdweb Dashboard'da tek URL kullanın:
# - Webhook URL: https://xxx.trycloudflare.com/api/webhooks/thirdweb
# Hem Transaction hem Contract Subscriptions bu URL'e gönderilebilir.
```

- **v1.events imza uyuşmazlığı:** Thirdweb Contract Subscriptions farklı secret kullanıyorsa development’ta 401 alabilirsiniz. İmza zorunluluğunu geçici kaldırmak için `.env` içinde `THIRDWEB_WEBHOOK_SKIP_SIGNATURE_IN_DEV=true` yapın (sadece development ortamında).
- **Gelen veriyi incelemek:** Sunucu çalışırken webhook tetikleyin; ardından `logs/last-thirdweb-webhook-payload.json` dosyasını kontrol edin.

### Manuel Event Test

```bash
# ERC20 Transfer event simülasyonu
curl -X POST http://localhost:3000/api/webhooks/thirdweb/events \
  -H "Content-Type: application/json" \
  -H "X-Engine-Signature: test_signature" \
  -H "X-Engine-Timestamp: $(date +%s)" \
  -d '{
    "type": "event-log",
    "data": {
      "chainId": 11155111,
      "contractAddress": "0xTokenContract",
      "blockNumber": 14306496,
      "transactionHash": "0xabc123...",
      "transactionIndex": 33,
      "logIndex": 91,
      "eventName": "Transfer",
      "decodedLog": {
        "from": { "type": "address", "value": "0x0000000000000000000000000000000000000000" },
        "to": { "type": "address", "value": "0xRecipientAddress" },
        "value": { "type": "uint256", "value": "1000000000000000000" }
      },
      "topics": [],
      "data": "0x",
      "timestamp": 1715402339000
    }
  }'
```

---

## Referanslar

- [Thirdweb Engine Webhooks](https://portal.thirdweb.com/engine/v2/features/webhooks)
- [Thirdweb Contract Subscriptions](https://portal.thirdweb.com/engine/v2/features/contract-subscriptions)
- [ERC20 Standard](https://eips.ethereum.org/EIPS/eip-20)
- [ERC721 Standard](https://eips.ethereum.org/EIPS/eip-721)
