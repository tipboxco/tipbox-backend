# Thirdweb Engine Webhook Integration

Bu dokümantasyon, TipBox Backend'e Thirdweb Engine webhook entegrasyonunun nasıl yapılacağını ve mevcut `Wallet` / `Transaction` yapılarıyla nasıl entegre edileceğini açıklar.

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [İki Farklı Webhook Türü](#i̇ki-farklı-webhook-türü)
- [Contract Event Subscriptions](#contract-event-subscriptions)
- [Transaction Webhooks](#transaction-webhooks)
- [Güvenlik - Signature Doğrulama](#güvenlik---signature-doğrulama)
- [Prisma Şema](#prisma-şema)
- [API Endpoints](#api-endpoints)
- [Kullanım Örnekleri](#kullanım-örnekleri)
- [Ortam Değişkenleri](#ortam-değişkenleri)

---

## İki Farklı Webhook Türü

Bu sistem iki farklı Thirdweb webhook türünü destekler:

### 1. Transaction Webhooks (`POST /api/webhooks/thirdweb`)
Bizim gönderdiğimiz transaction'ların durumunu takip eder.
- `sent`: Transaction RPC'ye gönderildi
- `mined`: Transaction blockchain'de onaylandı
- `errored`: Transaction başarısız oldu

### 2. Contract Event Subscriptions (`POST /api/webhooks/thirdweb/events`)
Blockchain'deki contract event'lerini dinler.
- `Transfer`: NFT veya token transferi
- `Approval`: Token onayı
- `Mint`: Yeni token oluşturma (Transfer from 0x0)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THIRDWEB WEBHOOK SYSTEM                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Transaction Webhooks          Contract Event Subscriptions         │
│   ────────────────────         ─────────────────────────────         │
│   POST /webhooks/thirdweb      POST /webhooks/thirdweb/events        │
│                                                                      │
│   ┌─────────────────┐          ┌─────────────────┐                   │
│   │ sent            │          │ Transfer        │                   │
│   │ mined           │          │ Approval        │                   │
│   │ errored         │          │ Mint/Burn       │                   │
│   │ cancelled       │          │ Custom Events   │                   │
│   └─────────────────┘          └─────────────────┘                   │
│           │                            │                             │
│           ▼                            ▼                             │
│   ThirdwebWebhookLog           ContractEventLog                      │
│   (thirdweb_webhook_logs)      (contract_event_logs)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Contract Event Subscriptions

### Payload Yapısı - Event Log

```json
{
  "type": "event-log",
  "data": {
    "chainId": 11155111,
    "contractAddress": "0xB7b9dfdB0291510e4677aADD2b03a39B9d46d235",
    "blockNumber": 14306496,
    "transactionHash": "0xdd73fc70754b6cb5238c33657b382e397aae635a8f9a3b26abe5f336059d0a40",
    "topics": ["0xddf252ad..."],
    "data": "0x...",
    "eventName": "Transfer",
    "decodedLog": {
      "from": { "type": "address", "value": "0x0000000000000000000000000000000000000000" },
      "to": { "type": "address", "value": "0x1234567890123456789012345678901234567890" },
      "tokenId": { "type": "uint256", "value": "1" }
    },
    "timestamp": 1715402339000,
    "transactionIndex": 33,
    "logIndex": 91
  }
}
```

### Payload Yapısı - Transaction Receipt

```json
{
  "type": "transaction-receipt",
  "data": {
    "chainId": 11155111,
    "blockNumber": 14306498,
    "contractAddress": "0xB7b9dfdB...",
    "transactionHash": "0xa2cef7ca...",
    "from": "0xAdmin...",
    "to": "0xContract...",
    "status": 1,
    "gasUsed": "77523"
  }
}
```

### Transfer Event Türleri

| Event | from | to | Açıklama |
|-------|------|-----|----------|
| **Mint** | `0x0000...0000` | User Address | Yeni NFT oluşturuldu |
| **Transfer** | User A | User B | NFT transfer edildi |
| **Burn** | User Address | `0x0000...0000` | NFT yakıldı |

---

## Genel Bakış

Thirdweb Engine, blockchain transaction'larının durumunu webhook'lar aracılığıyla bildirir. Bu sayede:

- NFT mint işlemlerinin durumu takip edilebilir
- Token transfer işlemlerinin onaylanması sağlanabilir
- Wallet bakiyeleri güncellenebilir
- Hata durumları yönetilebilir

### Akış Diyagramı

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  TipBox Backend │───>│  Thirdweb Engine │───>│   Blockchain    │
│  (Mint Request) │    │  (Transaction)   │    │   (Sepolia)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              │ Webhook Callback
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TipBox Webhook Endpoint                       │
│                 POST /api/webhooks/thirdweb                      │
│                                                                  │
│  ┌─────────────────┐   ┌───────────────────┐   ┌──────────────┐ │
│  │ Signature Check │──>│ ThirdwebWebhook   │──>│ Transaction  │ │
│  │                 │   │ Service           │   │ Service      │ │
│  └─────────────────┘   └───────────────────┘   └──────────────┘ │
│                              │                        │          │
│                              ▼                        ▼          │
│                    ┌─────────────────┐      ┌─────────────────┐ │
│                    │ ThirdwebWebhook │      │ Wallet Balance  │ │
│                    │ Log (DB)        │      │ Update          │ │
│                    └─────────────────┘      └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Thirdweb Webhook Payload Yapısı

### HTTP Headers

| Header | Açıklama |
|--------|----------|
| `Content-Type` | `application/json` |
| `X-Engine-Signature` | Payload imzası (HMAC-SHA256) |
| `X-Engine-Timestamp` | Unix timestamp (saniye cinsinden) |

### Payload Örneği - Sent Transaction

```json
{
  "queueId": "1411246e-b1c8-4f5d-9a25-8c1f40b54e55",
  "status": "sent",
  "onchainStatus": null,
  "queuedAt": "2023-09-29T22:01:31.031Z",
  "sentAt": "2023-09-29T22:01:41.580Z",
  "minedAt": null,
  "errorMessage": null,
  "cancelledAt": null,
  "retryCount": 0,
  
  "chainId": 11155111,
  "fromAddress": "0x3ecdbf3b911d0e9052b64850693888b008e18373",
  "toAddress": "0x365b83d67d5539c6583b9c0266a548926bf216f4",
  "data": "0xa9059cbb...",
  "value": "0x00",
  "nonce": 1786,
  "gasLimit": "39580",
  "maxFeePerGas": "2063100466",
  "maxPriorityFeePerGas": "1875545856",
  "gasPrice": "1875545871",
  "transactionType": null,
  "transactionHash": "0xc3ffa42dd4734b017d483e1158a2e936c8a97dd1aa4e4ce11df80ac8e81d2c7e",
  "sentAtBlockNumber": 40660021,
  "blockNumber": null,
  
  "signerAddress": null,
  "accountAddress": null,
  "target": null,
  "sender": null,
  "initCode": null,
  "callData": null,
  "callGasLimit": null,
  "verificationGasLimit": null,
  "preVerificationGas": null,
  "paymasterAndData": null,
  "userOpHash": null,
  
  "functionName": "safeMint",
  "functionArgs": "0x1234567890...,tokenURI",
  "extension": "none",
  "deployedContractAddress": null,
  "deployedContractType": null
}
```

### Payload Örneği - Mined Transaction

```json
{
  "queueId": "1411246e-b1c8-4f5d-9a25-8c1f40b54e55",
  "status": "mined",
  "onchainStatus": "success",
  "queuedAt": "2023-09-29T22:01:31.031Z",
  "sentAt": "2023-09-29T22:01:41.580Z",
  "minedAt": "2023-09-29T22:01:44.000Z",
  "errorMessage": null,
  "cancelledAt": null,
  "retryCount": 0,
  
  "chainId": 11155111,
  "fromAddress": "0x3ecdbf3b911d0e9052b64850693888b008e18373",
  "toAddress": "0xB7b9dfdB0291510e4677aADD2b03a39B9d46d235",
  "transactionHash": "0xc3ffa42dd4734b017d483e1158a2e936c8a97dd1aa4e4ce11df80ac8e81d2c7e",
  "blockNumber": 40660026,
  
  "functionName": "safeMint",
  "functionArgs": "0x1234567890...,tokenURI"
}
```

---

## Desteklenen Event Türleri

### Transaction Events

| Event | Açıklama |
|-------|----------|
| `sent_transaction` | Transaction RPC'ye gönderildi. Hash mevcut ama henüz onaylanmadı. |
| `mined_transaction` | Transaction blockchain'de onaylandı. `onchainStatus` kontrol edilmeli! |
| `errored_transaction` | Transaction gönderilemedi. Hata detayları `errorMessage` alanında. |
| `all_transaction` | Tüm transaction event'lerini kapsar. |

### Wallet Events

| Event | Açıklama |
|-------|----------|
| `backend_wallet_balance` | Backend wallet bakiyesi `minWalletBalance` altına düştü. |

---

## Webhook Yaşam Döngüsü

### Normal Akış

```
sent → mined (onchainStatus: "success")
```

### Hata Senaryoları

| Senaryo | Açıklama |
|---------|----------|
| `errored` | Simülasyon başarısız, yetersiz bakiye, ağ hatası |
| `sent → errored` | Mempool'dan düşürüldü veya nonce çakışması |
| `cancelled` | Kuyrukta beklerken iptal edildi |
| `sent → cancelled` | Gönderildi ama iptal edildi |

> **ÖNEMLİ:** Webhook'lar sırasız gelebilir! `mined` geldikten sonra `sent` gelebilir. Son durum öncelikli kabul edilmelidir.

---

## Güvenlik - Signature Doğrulama

### Signature Oluşturma

```typescript
import crypto from 'crypto';

function generateSignature(
  body: string,
  timestamp: string,
  secret: string
): string {
  const payload = `${timestamp}.${body}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}
```

### Signature Doğrulama

```typescript
function isValidSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(body, timestamp, secret);
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}
```

### Timestamp Kontrolü (Replay Attack Önleme)

```typescript
function isExpired(
  timestamp: string,
  expirationInSeconds: number = 300 // 5 dakika
): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - parseInt(timestamp) > expirationInSeconds;
}
```

---

## Prisma Şema Entegrasyonu

### Mevcut Modeller

#### Wallet Model

```prisma
model Wallet {
  id            String         @id @default(uuid()) @db.Uuid
  userId        String         @map("user_id") @db.Uuid
  publicAddress String         @map("public_address")
  provider      WalletProvider
  isConnected   Boolean        @map("is_connected")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")
  balance       Float          @default(0)
  lockedBalance Float          @default(0) @map("locked_balance")
  transactions  Transaction[]
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
  @@index([balance])
  @@map("wallets")
}
```

#### Transaction Model

```prisma
model Transaction {
  id           String                @id @default(uuid()) @db.Uuid
  walletId     String                @map("wallet_id") @db.Uuid
  actionType   TransactionActionType @map("action_type")
  status       TransactionStatus     @default(created)
  amount       Float?
  fromAddress  String?               @map("from_address")
  toAddress    String?               @map("to_address")
  metadata     Json?
  txHash       String?               @map("tx_hash")
  provider     String                @default("backend")
  errorMessage String?               @map("error_message")
  createdAt    DateTime              @default(now()) @map("created_at")
  confirmedAt  DateTime?             @map("confirmed_at")
  failedAt     DateTime?             @map("failed_at")
  rewardClaims RewardClaim[]
  wallet       Wallet                @relation(fields: [walletId], references: [id], onDelete: Cascade)

  @@index([walletId])
  @@index([status])
  @@index([actionType])
  @@index([createdAt])
  @@index([walletId, status])
  @@map("transactions")
}
```

#### TransactionStatus Enum

```prisma
enum TransactionStatus {
  created
  pending
  confirmed
  failed

  @@map("transaction_status")
}
```

### Yeni Model: ThirdwebWebhookLog

Webhook eventlerini kaydetmek için yeni bir model eklenmeli:

```prisma
model ThirdwebWebhookLog {
  id               String    @id @default(uuid()) @db.Uuid
  queueId          String    @unique @map("queue_id")
  status           String    // sent, mined, errored, cancelled
  onchainStatus    String?   @map("onchain_status") // success, reverted
  chainId          Int       @map("chain_id")
  fromAddress      String    @map("from_address")
  toAddress        String    @map("to_address")
  transactionHash  String?   @map("transaction_hash")
  blockNumber      Int?      @map("block_number")
  functionName     String?   @map("function_name")
  functionArgs     String?   @map("function_args")
  errorMessage     String?   @map("error_message")
  rawPayload       Json      @map("raw_payload")
  transactionId    String?   @map("transaction_id") @db.Uuid
  processedAt      DateTime  @default(now()) @map("processed_at")
  createdAt        DateTime  @default(now()) @map("created_at")

  @@index([queueId])
  @@index([transactionHash])
  @@index([status])
  @@index([processedAt])
  @@map("thirdweb_webhook_logs")
}
```

---

## Service Yapısı

### thirdweb-webhook.service.ts

```typescript
// backend/src/application/thirdweb-webhook/thirdweb-webhook.service.ts

import crypto from 'crypto';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import logger from '../../infrastructure/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ThirdwebWebhookPayload {
  // Queue details
  queueId: string;
  status: 'sent' | 'mined' | 'errored' | 'cancelled';
  onchainStatus: 'success' | 'reverted' | null;
  queuedAt: string;
  sentAt: string | null;
  minedAt: string | null;
  errorMessage: string | null;
  cancelledAt: string | null;
  retryCount: number;

  // Onchain details
  chainId: number;
  fromAddress: string;
  toAddress: string;
  data: string;
  value: string;
  nonce: number;
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasPrice: string;
  transactionType: number | null;
  transactionHash: string | null;
  sentAtBlockNumber: number | null;
  blockNumber: number | null;

  // User operation (account abstraction) details
  signerAddress: string | null;
  accountAddress: string | null;
  target: string | null;
  sender: string | null;
  initCode: string | null;
  callData: string | null;
  callGasLimit: string | null;
  verificationGasLimit: string | null;
  preVerificationGas: string | null;
  paymasterAndData: string | null;
  userOpHash: string | null;

  // Off-chain details
  functionName: string | null;
  functionArgs: string | null;
  extension: string | null;
  deployedContractAddress: string | null;
  deployedContractType: string | null;
}

export interface WebhookProcessResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped';
  message: string;
  transactionId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ThirdwebWebhookService {
  private webhookSecret: string;
  private expirationSeconds: number;

  constructor(
    private transactionService = new TransactionService()
  ) {
    this.webhookSecret = process.env.THIRDWEB_WEBHOOK_SECRET || '';
    this.expirationSeconds = parseInt(process.env.THIRDWEB_WEBHOOK_EXPIRATION_SECONDS || '300', 10);

    if (!this.webhookSecret) {
      logger.warn('THIRDWEB_WEBHOOK_SECRET is not set. Webhook signature verification will fail.');
    }
  }

  // ==========================================================================
  // SIGNATURE VERIFICATION
  // ==========================================================================

  /**
   * HMAC-SHA256 ile signature oluşturur
   */
  private generateSignature(body: string, timestamp: string): string {
    const payload = `${timestamp}.${body}`;
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Webhook signature'ını doğrular
   */
  verifySignature(body: string, timestamp: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.error('Webhook secret is not configured');
      return false;
    }

    try {
      const expectedSignature = this.generateSignature(body, timestamp);
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Timestamp'in geçerli olup olmadığını kontrol eder (replay attack önleme)
   */
  isExpired(timestamp: string): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    return currentTime - webhookTime > this.expirationSeconds;
  }

  // ==========================================================================
  // WEBHOOK PROCESSING
  // ==========================================================================

  /**
   * Gelen webhook'u işler ve database'i günceller
   */
  async processWebhook(payload: ThirdwebWebhookPayload): Promise<WebhookProcessResult> {
    const prisma = getPrisma();

    try {
      // Daha önce işlenmiş mi kontrol et
      const existingLog = await prisma.thirdwebWebhookLog?.findUnique({
        where: { queueId: payload.queueId }
      });

      // Status priority: mined > sent > cancelled > errored
      const statusPriority: Record<string, number> = {
        'mined': 4,
        'cancelled': 3,
        'sent': 2,
        'errored': 1
      };

      if (existingLog) {
        // Daha düşük öncelikli status gelirse skip et
        if (statusPriority[payload.status] <= statusPriority[existingLog.status]) {
          logger.info({
            queueId: payload.queueId,
            existingStatus: existingLog.status,
            newStatus: payload.status,
            message: 'Skipping lower priority webhook status'
          });
          
          return {
            success: true,
            action: 'skipped',
            message: `Lower priority status ignored. Current: ${existingLog.status}, Received: ${payload.status}`
          };
        }
      }

      // Transaction'ı bul veya oluştur
      let transactionId: string | undefined;

      // Metadata'dan internal transaction ID'yi al
      if (payload.functionArgs) {
        const internalTxId = this.extractInternalTransactionId(payload.functionArgs);
        if (internalTxId) {
          transactionId = internalTxId;
        }
      }

      // Status'a göre işlem yap
      switch (payload.status) {
        case 'sent':
          await this.handleSentTransaction(payload, transactionId);
          break;

        case 'mined':
          await this.handleMinedTransaction(payload, transactionId);
          break;

        case 'errored':
          await this.handleErroredTransaction(payload, transactionId);
          break;

        case 'cancelled':
          await this.handleCancelledTransaction(payload, transactionId);
          break;
      }

      // Webhook log'u kaydet veya güncelle
      await prisma.thirdwebWebhookLog?.upsert({
        where: { queueId: payload.queueId },
        create: {
          queueId: payload.queueId,
          status: payload.status,
          onchainStatus: payload.onchainStatus,
          chainId: payload.chainId,
          fromAddress: payload.fromAddress,
          toAddress: payload.toAddress,
          transactionHash: payload.transactionHash,
          blockNumber: payload.blockNumber,
          functionName: payload.functionName,
          functionArgs: payload.functionArgs,
          errorMessage: payload.errorMessage,
          rawPayload: payload as any,
          transactionId: transactionId,
          processedAt: new Date()
        },
        update: {
          status: payload.status,
          onchainStatus: payload.onchainStatus,
          transactionHash: payload.transactionHash,
          blockNumber: payload.blockNumber,
          errorMessage: payload.errorMessage,
          rawPayload: payload as any,
          processedAt: new Date()
        }
      });

      logger.info({
        queueId: payload.queueId,
        status: payload.status,
        onchainStatus: payload.onchainStatus,
        transactionHash: payload.transactionHash,
        transactionId,
        message: 'Webhook processed successfully'
      });

      return {
        success: true,
        action: existingLog ? 'updated' : 'created',
        message: `Webhook ${payload.status} processed`,
        transactionId
      };

    } catch (error) {
      logger.error({
        queueId: payload.queueId,
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to process webhook'
      });

      throw error;
    }
  }

  // ==========================================================================
  // STATUS HANDLERS
  // ==========================================================================

  /**
   * Sent transaction handler - Transaction pending olarak işaretlenir
   */
  private async handleSentTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    if (!transactionId) {
      logger.warn({
        queueId: payload.queueId,
        message: 'No internal transaction ID found for sent webhook'
      });
      return;
    }

    const prisma = getPrisma();

    // Transaction'ı pending olarak güncelle
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'pending',
        txHash: payload.transactionHash,
        metadata: {
          ...(await this.getExistingMetadata(transactionId)),
          thirdweb: {
            queueId: payload.queueId,
            sentAt: payload.sentAt,
            sentAtBlockNumber: payload.sentAtBlockNumber
          }
        }
      }
    });
  }

  /**
   * Mined transaction handler - Transaction confirmed veya failed olarak işaretlenir
   */
  private async handleMinedTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    if (!transactionId) {
      logger.warn({
        queueId: payload.queueId,
        message: 'No internal transaction ID found for mined webhook'
      });
      return;
    }

    // onchainStatus'a göre confirm veya fail
    if (payload.onchainStatus === 'success') {
      await this.transactionService.confirmTransaction(
        transactionId,
        payload.transactionHash || undefined
      );
      
      logger.info({
        transactionId,
        txHash: payload.transactionHash,
        message: 'Transaction confirmed via thirdweb webhook'
      });
    } else if (payload.onchainStatus === 'reverted') {
      await this.transactionService.failTransaction(
        transactionId,
        `Transaction reverted on-chain. Block: ${payload.blockNumber}`
      );

      logger.warn({
        transactionId,
        txHash: payload.transactionHash,
        blockNumber: payload.blockNumber,
        message: 'Transaction reverted via thirdweb webhook'
      });
    }
  }

  /**
   * Errored transaction handler - Transaction failed olarak işaretlenir
   */
  private async handleErroredTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    if (!transactionId) {
      logger.warn({
        queueId: payload.queueId,
        errorMessage: payload.errorMessage,
        message: 'No internal transaction ID found for errored webhook'
      });
      return;
    }

    await this.transactionService.failTransaction(
      transactionId,
      payload.errorMessage || 'Transaction failed (thirdweb engine error)'
    );
  }

  /**
   * Cancelled transaction handler - Transaction failed olarak işaretlenir
   */
  private async handleCancelledTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    if (!transactionId) {
      logger.warn({
        queueId: payload.queueId,
        message: 'No internal transaction ID found for cancelled webhook'
      });
      return;
    }

    await this.transactionService.failTransaction(
      transactionId,
      `Transaction cancelled at ${payload.cancelledAt || 'unknown time'}`
    );
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Function args'dan internal transaction ID'yi çıkarır
   * Bu, mint işlemi sırasında metadata'ya eklenen ID'dir
   */
  private extractInternalTransactionId(functionArgs: string): string | null {
    try {
      // functionArgs format: "address,tokenURI"
      // tokenURI içinde base64 encoded metadata olabilir
      const parts = functionArgs.split(',');
      if (parts.length < 2) return null;

      const tokenUri = parts.slice(1).join(','); // Virgül içeren URI'ları birleştir
      
      // data:application/json;base64, formatını parse et
      if (tokenUri.startsWith('data:application/json;base64,')) {
        const base64Data = tokenUri.replace('data:application/json;base64,', '');
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        const metadata = JSON.parse(jsonString);
        
        // internal_transaction_id veya tipbox_transaction_id alanını ara
        return metadata.internal_transaction_id || 
               metadata.tipbox_transaction_id || 
               null;
      }

      return null;
    } catch (error) {
      logger.debug({
        functionArgs,
        error: error instanceof Error ? error.message : String(error),
        message: 'Could not extract internal transaction ID'
      });
      return null;
    }
  }

  /**
   * Mevcut transaction metadata'sını getirir
   */
  private async getExistingMetadata(transactionId: string): Promise<Record<string, any>> {
    const prisma = getPrisma();
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { metadata: true }
    });
    return (tx?.metadata as Record<string, any>) || {};
  }

  // ==========================================================================
  // WALLET BALANCE EVENT HANDLER
  // ==========================================================================

  /**
   * Backend wallet balance düşük uyarısını işler
   */
  async handleLowBalanceAlert(walletAddress: string, balance: string): Promise<void> {
    logger.warn({
      walletAddress,
      balance,
      message: 'Backend wallet balance is low! Please top up.'
    });

    // Burada Slack, Discord, email vb. bildirim gönderilebilir
    // await this.notificationService.sendAdminAlert(...)
  }
}
```

---

## Router Yapısı

### thirdweb-webhook.router.ts

```typescript
// backend/src/interfaces/thirdweb-webhook/thirdweb-webhook.router.ts

import express, { Request, Response } from 'express';
import { ThirdwebWebhookService, ThirdwebWebhookPayload } from '../../application/thirdweb-webhook/thirdweb-webhook.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import logger from '../../infrastructure/logger/logger';

const router = express.Router();
const webhookService = new ThirdwebWebhookService();

/**
 * @openapi
 * /webhooks/thirdweb:
 *   post:
 *     summary: Thirdweb Engine webhook endpoint
 *     description: |
 *       Thirdweb Engine'den gelen transaction event'lerini işler.
 *       
 *       **Security:**
 *       - X-Engine-Signature header ile HMAC-SHA256 doğrulaması yapılır
 *       - X-Engine-Timestamp ile replay attack önlenir (5 dakika timeout)
 *       
 *       **Supported Events:**
 *       - sent_transaction: Transaction gönderildi
 *       - mined_transaction: Transaction onaylandı
 *       - errored_transaction: Transaction başarısız
 *       - backend_wallet_balance: Wallet bakiyesi düşük
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - queueId
 *               - status
 *               - chainId
 *               - fromAddress
 *               - toAddress
 *             properties:
 *               queueId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [sent, mined, errored, cancelled]
 *               onchainStatus:
 *                 type: string
 *                 enum: [success, reverted]
 *               transactionHash:
 *                 type: string
 *               errorMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook başarıyla işlendi
 *       401:
 *         description: Geçersiz signature veya süresi dolmuş timestamp
 *       500:
 *         description: İşleme hatası
 */
router.post('/', 
  // Raw body'yi preserve et (signature verification için)
  express.text({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.header('X-Engine-Signature');
    const timestamp = req.header('X-Engine-Timestamp');
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Header validation
    if (!signature || !timestamp) {
      logger.warn({
        ip: req.ip,
        message: 'Missing webhook signature or timestamp headers'
      });
      return res.status(401).json({
        error: 'Missing signature or timestamp header'
      });
    }

    // Signature verification
    if (!webhookService.verifySignature(rawBody, timestamp, signature)) {
      logger.warn({
        ip: req.ip,
        message: 'Invalid webhook signature'
      });
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    // Timestamp expiration check
    if (webhookService.isExpired(timestamp)) {
      logger.warn({
        ip: req.ip,
        timestamp,
        message: 'Webhook request has expired'
      });
      return res.status(401).json({
        error: 'Request has expired'
      });
    }

    // Parse payload
    let payload: ThirdwebWebhookPayload;
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to parse webhook payload'
      });
      return res.status(400).json({
        error: 'Invalid JSON payload'
      });
    }

    // Process webhook
    const result = await webhookService.processWebhook(payload);

    return res.status(200).json({
      success: result.success,
      action: result.action,
      message: result.message,
      transactionId: result.transactionId
    });
  })
);

/**
 * Health check endpoint for webhook verification
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'thirdweb-webhook',
    timestamp: new Date().toISOString()
  });
});

export default router;
```

### app.ts'e Router Ekleme

```typescript
// backend/src/interfaces/app.ts

// ... existing imports ...
import thirdwebWebhookRouter from './thirdweb-webhook/thirdweb-webhook.router';

// ... existing middleware ...

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/wallets', walletRouter);
app.use('/api/transactions', transactionRouter);
// ... other routes ...

// Webhook routes (no auth required - signature verified internally)
app.use('/api/webhooks/thirdweb', thirdwebWebhookRouter);
```

---

## Kullanım Örnekleri

### 1. NFT Mint ile Webhook Entegrasyonu

```typescript
// backend/src/application/web3-nft-service/web3.nft.service.ts

async mintWithMetadata(
  toAddress: string, 
  metadata: NFTMetadata,
  internalTransactionId: string // Internal DB transaction ID
): Promise<AdminMintResult> {
  // Metadata'ya internal transaction ID ekle
  const enrichedMetadata = {
    ...metadata,
    internal_transaction_id: internalTransactionId,
    tipbox_transaction_id: internalTransactionId
  };

  const tokenURI = this.metadataToURI(enrichedMetadata);
  return this.safeMint(toAddress, tokenURI);
}
```

### 2. Transaction Oluşturma ve Webhook Bekleme

```typescript
// Örnek: NFT Claim işlemi

async claimNFT(userId: string, nftData: any) {
  const wallet = await this.walletService.getActiveWallet(userId);
  
  // 1. Transaction oluştur (status: created)
  const transaction = await this.transactionRepo.create({
    walletId: wallet.id,
    actionType: TransactionActionType.CLAIM_BADGE,
    status: TransactionStatus.CREATED,
    provider: 'thirdweb',
    metadata: {
      nftData,
      claimType: 'badge'
    }
  });

  // 2. Thirdweb ile mint işlemi başlat
  const mintResult = await this.adminMintService.mintWithMetadata(
    wallet.publicAddress,
    {
      name: nftData.name,
      description: nftData.description,
      image: nftData.imageUrl,
      internal_transaction_id: transaction.id // Webhook'tan eşleştirme için
    }
  );

  if (!mintResult.success) {
    // Mint başarısız - transaction'ı fail olarak işaretle
    await this.transactionService.failTransaction(
      transaction.id,
      mintResult.error || 'Mint failed'
    );
    throw new Error(mintResult.error);
  }

  // 3. Transaction'ı pending olarak güncelle
  await this.transactionRepo.update(transaction.id, {
    status: TransactionStatus.PENDING,
    txHash: mintResult.transactionHash
  });

  // Webhook geldiğinde transaction otomatik olarak confirmed/failed olacak
  return { transactionId: transaction.id };
}
```

---

## Ortam Değişkenleri

`.env` dosyasına eklenecek değişkenler:

```env
# Thirdweb Webhook Configuration
# Thirdweb Dashboard > Engine > Configuration > Webhooks'tan alınır
THIRDWEB_WEBHOOK_SECRET=your_webhook_secret_here

# Webhook timestamp expiration (saniye cinsinden, default: 300 = 5 dakika)
THIRDWEB_WEBHOOK_EXPIRATION_SECONDS=300
```

---

## Thirdweb Dashboard Yapılandırması

1. [Thirdweb Dashboard](https://thirdweb.com/dashboard)'a gidin
2. Engine seçin
3. **Configuration** > **Webhooks** bölümüne gidin
4. **Create Webhook** butonuna tıklayın
5. Ayarları girin:
   - **URL:** `https://your-domain.com/api/webhooks/thirdweb`
   - **Events:** `all_transaction` veya spesifik eventler seçin
6. **Webhook Secret**'ı kopyalayın ve `.env` dosyasına ekleyin

---

## Test Etme

### Local Development

```bash
# ngrok ile local endpoint'i expose edin
ngrok http 3000

# Thirdweb Dashboard'da webhook URL'ini güncelleyin
# https://xxxxx.ngrok.io/api/webhooks/thirdweb
```

### Manuel Test

```bash
# Test webhook gönderimi
curl -X POST http://localhost:3000/api/webhooks/thirdweb \
  -H "Content-Type: application/json" \
  -H "X-Engine-Signature: test_signature" \
  -H "X-Engine-Timestamp: $(date +%s)" \
  -d '{
    "queueId": "test-123",
    "status": "mined",
    "onchainStatus": "success",
    "chainId": 11155111,
    "fromAddress": "0x...",
    "toAddress": "0x...",
    "transactionHash": "0x...",
    "functionName": "safeMint"
  }'
```

---

## Referanslar

- [Thirdweb Engine Webhooks Documentation](https://portal.thirdweb.com/engine/v2/features/webhooks)
- [Thirdweb Engine API Reference](https://portal.thirdweb.com/engine/v2/api-reference)
- [TipBox AdminMintService](./../../application/web3-nft-service/web3.nft.service.ts)

---

## Dosya Yapısı

```
backend/
├── prisma/
│   └── schema.prisma
│       ├── ThirdwebWebhookLog        # Transaction webhook logları
│       ├── ContractEventLog          # Contract event logları
│       ├── ThirdwebWebhookStatus     # sent, mined, errored, cancelled
│       └── ThirdwebOnchainStatus     # success, reverted
│
├── src/
│   ├── application/
│   │   └── thirdweb-webhook/
│   │       ├── thirdweb-webhook.service.ts   # Transaction webhook işleme
│   │       └── contract-event.service.ts     # Contract event işleme
│   │
│   ├── interfaces/
│   │   └── thirdweb-webhook/
│   │       ├── THIRDWEB_WEBHOOK_INTEGRATION.md  (bu dosya)
│   │       ├── thirdweb-webhook.router.ts       # Tüm endpoint'ler
│   │       ├── thirdweb-webhook.dto.ts          # Transaction webhook DTO'ları
│   │       └── contract-event.dto.ts            # Contract event DTO'ları
│   │
│   └── infrastructure/
│       └── repositories/
│           ├── thirdweb-webhook-log-prisma.repository.ts
│           ├── contract-event-log-prisma.repository.ts
│           └── wallet-prisma.repository.ts  # findByPublicAddress eklendi
```

## API Endpoints

### Transaction Webhooks

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/webhooks/thirdweb` | Signature | Transaction webhook receiver |
| GET | `/api/webhooks/thirdweb/health` | - | Health check |
| GET | `/api/webhooks/thirdweb/logs` | JWT | Son transaction webhook logları |
| GET | `/api/webhooks/thirdweb/logs/:queueId` | JWT | Queue ID ile log detayı |
| GET | `/api/webhooks/thirdweb/stats` | JWT | Webhook istatistikleri |

### Contract Event Subscriptions

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/api/webhooks/thirdweb/events` | Signature | Contract event receiver |
| GET | `/api/webhooks/thirdweb/events/logs` | JWT | Son contract event logları |
| GET | `/api/webhooks/thirdweb/events/stats` | JWT | Event istatistikleri |
| GET | `/api/webhooks/thirdweb/events/by-hash/:txHash` | JWT | TxHash ile event logları |
| GET | `/api/webhooks/thirdweb/events/by-wallet/:walletId` | JWT | Wallet ile event logları |
| POST | `/api/webhooks/thirdweb/events/reprocess` | JWT | İşlenmemiş event'leri yeniden işle |

## Kurulum Adımları

### 1. Prisma Migration

```bash
cd backend
npx prisma migrate dev --name add_thirdweb_webhook_and_events
npx prisma generate
```

### 2. Ortam Değişkenleri

`.env` dosyasına ekleyin:

```env
# Thirdweb Webhook Configuration
THIRDWEB_WEBHOOK_SECRET=your_webhook_secret_from_thirdweb_dashboard
THIRDWEB_WEBHOOK_EXPIRATION_SECONDS=300

# Contract Event Filtering (opsiyonel, virgülle ayrılmış)
THIRDWEB_WATCHED_CONTRACTS=0xB7b9dfdB0291510e4677aADD2b03a39B9d46d235
```

### 3. Thirdweb Dashboard Yapılandırması

#### Transaction Webhooks için:
1. [Thirdweb Dashboard](https://thirdweb.com/dashboard) > Engine > Configuration > **Webhooks**
2. **Create Webhook** butonuna tıklayın
3. URL: `https://your-domain.com/api/webhooks/thirdweb`
4. Events: `all_transaction` seçin
5. Webhook Secret'ı kopyalayın

#### Contract Event Subscriptions için:
1. [Thirdweb Dashboard](https://thirdweb.com/dashboard) > Engine > **Contract Subscriptions**
2. **Add Contract Subscription** butonuna tıklayın
3. Contract Address ve Chain seçin
4. Webhook URL: `https://your-domain.com/api/webhooks/thirdweb/events`
5. Aynı Webhook Secret'ı kullanın
