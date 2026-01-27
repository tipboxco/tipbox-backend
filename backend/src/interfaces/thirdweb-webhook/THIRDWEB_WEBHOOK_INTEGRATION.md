# Thirdweb Engine Webhook Integration

TipBox Backend için Thirdweb Engine webhook entegrasyonu - ERC20 Token ve ERC721 NFT desteği.

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Desteklenen Token Türleri](#desteklenen-token-türleri)
- [Sistem Mimarisi](#sistem-mimarisi)
- [Contract Event Subscriptions](#contract-event-subscriptions)
- [Transaction Webhooks](#transaction-webhooks)
- [Token Türü Tespiti](#token-türü-tespiti)
- [Event İşleme Akışı](#event-i̇şleme-akışı)
- [API Endpoints](#api-endpoints)
- [Prisma Şema](#prisma-şema)
- [Güvenlik](#güvenlik)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Kullanım Örnekleri](#kullanım-örnekleri)
- [Test Etme](#test-etme)

---

## Genel Bakış

Bu sistem Thirdweb Engine üzerinden blockchain event'lerini dinler ve işler:

- **ERC20 Token** transferleri (TIPS, USDT vb.)
- **ERC721 NFT** mint/transfer işlemleri
- **Approval** event'leri
- **Mint/Burn** işlemleri

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

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THIRDWEB WEBHOOK SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────┐      ┌─────────────────────────┐              │
│   │  Transaction Webhooks   │      │  Contract Subscriptions  │              │
│   │  POST /webhooks/thirdweb│      │  POST /webhooks/thirdweb │              │
│   │                         │      │       /events            │              │
│   └───────────┬─────────────┘      └───────────┬─────────────┘              │
│               │                                │                             │
│               ▼                                ▼                             │
│   ┌─────────────────────────┐      ┌─────────────────────────┐              │
│   │ ThirdwebWebhookService  │      │  ContractEventService   │              │
│   │                         │      │                         │              │
│   │ • sent                  │      │ • Transfer (ERC20/721)  │              │
│   │ • mined                 │      │ • Approval              │              │
│   │ • errored               │      │ • Mint / Burn           │              │
│   │ • cancelled             │      │                         │              │
│   └───────────┬─────────────┘      └───────────┬─────────────┘              │
│               │                                │                             │
│               ▼                                ▼                             │
│   ┌─────────────────────────┐      ┌─────────────────────────┐              │
│   │  ThirdwebWebhookLog     │      │   ContractEventLog      │              │
│   │  (DB Table)             │      │   (DB Table)            │              │
│   └───────────┬─────────────┘      └───────────┬─────────────┘              │
│               │                                │                             │
│               └────────────────┬───────────────┘                             │
│                                ▼                                             │
│                    ┌─────────────────────────┐                              │
│                    │   TransactionService    │                              │
│                    │   WalletService         │                              │
│                    │                         │                              │
│                    │ • confirmTransaction()  │                              │
│                    │ • failTransaction()     │                              │
│                    │ • updateBalance()       │                              │
│                    └─────────────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Contract Event Subscriptions

### Desteklenen Event'ler

| Event | Token Türü | Açıklama |
|-------|------------|----------|
| `Transfer` | ERC20/ERC721 | Token veya NFT transferi |
| `Approval` | ERC20/ERC721 | Token onayı |

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
| `POST` | `/api/webhooks/thirdweb` | Signature | Transaction webhook receiver |
| `GET` | `/api/webhooks/thirdweb/health` | - | Health check |
| `GET` | `/api/webhooks/thirdweb/logs` | JWT | Son webhook logları |
| `GET` | `/api/webhooks/thirdweb/logs/:queueId` | JWT | Queue ID ile log detayı |
| `GET` | `/api/webhooks/thirdweb/stats` | JWT | Webhook istatistikleri |
| `GET` | `/api/webhooks/thirdweb/transaction/:transactionId` | JWT | Transaction logları |

### Contract Event Subscriptions

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| `POST` | `/api/webhooks/thirdweb/events` | Signature | Contract event receiver |
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

| Header | Açıklama |
|--------|----------|
| `X-Engine-Signature` | HMAC-SHA256 imza |
| `X-Engine-Timestamp` | Unix timestamp (saniye) |

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
4. Events: `all_transaction`
5. Webhook Secret'ı kopyalayın

### 3. Thirdweb Dashboard - Contract Subscriptions

1. [Thirdweb Dashboard](https://thirdweb.com/dashboard) > Engine > **Contract Subscriptions**
2. **Add Contract Subscription**
3. Contract Address: Token veya NFT contract adresi
4. Chain: Sepolia (11155111) veya ilgili chain
5. Webhook URL: `https://your-domain.com/api/webhooks/thirdweb/events`

---

## Ortam Değişkenleri

```env
# ============================================================================
# THIRDWEB WEBHOOK CONFIGURATION
# ============================================================================

# Thirdweb Dashboard'dan alınan webhook secret
THIRDWEB_WEBHOOK_SECRET=your_webhook_secret_here

# Webhook timestamp expiration (saniye, default: 300 = 5 dakika)
THIRDWEB_WEBHOOK_EXPIRATION_SECONDS=300

# Token decimals (default: 18)
TIPS_TOKEN_DECIMALS=18

# İzlenen contract adresleri (opsiyonel, virgülle ayrılmış)
# Boş bırakılırsa tüm contract'lar kabul edilir
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
# ngrok ile local endpoint'i expose edin
ngrok http 3000

# Thirdweb Dashboard'da URL'leri güncelleyin:
# - Transaction Webhooks: https://xxxxx.ngrok.io/api/webhooks/thirdweb
# - Contract Events: https://xxxxx.ngrok.io/api/webhooks/thirdweb/events
```

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
