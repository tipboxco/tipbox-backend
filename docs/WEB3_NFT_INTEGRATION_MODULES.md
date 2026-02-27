# feat/web3-nft-integration – Geliştirilen Modüller Dokümantasyonu

Bu dokümanda `feat/web3-nft-integration` branch'inde geliştirilen Web3 ve NFT ile ilgili tüm modüller liste formatında özetlenmiştir.

---

## 1. Domain Katmanı (Entities & Enums)

- **NFT Entity** (`backend/src/domain/crypto/nft.entity.ts`)
  - NFT modeli: `id`, `name`, `description`, `imageUrl`, `type`, `rarity`, `isTransferable`, `currentOwnerId`, `tokenId`, `contractAddress`, `viewCount`
  - `tokenId` ve `contractAddress` ile chain üzerindeki NFT ile senkronizasyon

- **NFT Type Enum** (`backend/src/domain/crypto/nft-type.enum.ts`)
  - BADGE, COSMETIC vb. NFT türleri

- **NFT Rarity Enum** (`backend/src/domain/crypto/nft-rarity.enum.ts`)
  - NFT nadirlik seviyeleri

- **NFT Attribute Entity** (`backend/src/domain/crypto/nft-attribute.entity.ts`)
  - NFT özellikleri: `key`, `value`

- **NFT Transaction Entity** (`backend/src/domain/crypto/nft-transaction.entity.ts`)
  - NFT transfer/kullanım geçmişi

- **NFT Transaction Type Enum** (`backend/src/domain/crypto/nft-transaction-type.enum.ts`)
  - MINT, TRANSFER, SALE vb. işlem türleri

- **NFT Market Listing Entity** (`backend/src/domain/crypto/nft-market-listing.entity.ts`)
  - Marketplace ilan modeli

- **NFT Market Listing Status Enum** (`backend/src/domain/crypto/nft-market-listing-status.enum.ts`)
  - ACTIVE, SOLD, CANCELLED

- **NFT Claim Entity** (`backend/src/domain/crypto/nft-claim.entity.ts`)
  - NFT claim işlemleri (lootbox vb.)

- **Transaction Action Type Enum** (`backend/src/domain/transaction/transaction-action-type.enum.ts`)
  - TIP_SEND, TIP_RECEIVE, DEPOSIT, WITHDRAW, CLAIM_REWARD, CLAIM_BADGE, NFT_BUY, NFT_SELL, SWAP_TIP_TO_SOL, SWAP_SOL_TO_TIP, AIRDROP, FEE

---

## 2. Application Katmanı (Services)

### 2.1 Web3 / Thirdweb

- **Web3 NFT Service** (`backend/src/application/wallet/web3-nft-service/web3.nft.service.ts`)
  - ERC721 badge mint (safeMint)
  - Thirdweb SDK ile Sepolia ağında mint
  - `mintWithMetadata()`, batch mint, lazy mint
  - Kullanıcı cüzdanındaki NFT’leri listeleme (`getWalletNFTs`)

- **Thirdweb SDK Service** (`backend/src/application/wallet/thirdweb-sdk/thirdweb-sdk.service.ts`)
  - Thirdweb Engine ile token transfer
  - Tip gönderimi, ERC20 işlemleri

- **Thirdweb Core** (`backend/src/application/wallet/thirdweb-sdk/thirdweb.core.ts`)
  - Thirdweb client ve contract yapılandırması

- **Wallet Service** (`backend/src/application/wallet/wallet.service.ts`)
  - Kullanıcı wallet oluşturma/bulma
  - Thirdweb Smart Account (ERC-4337) entegrasyonu
  - `getThirdwebWallet()`, `createOrGetWallet()`

- **Wallet Config** (`backend/src/application/wallet/config/`)
  - Chain, RPC, contract adresleri
  - ABI yapılandırması

### 2.2 Webhook & Event İşleme

- **Thirdweb Webhook Service** (`backend/src/application/thirdweb-webhook/thirdweb-webhook.service.ts`)
  - Transaction webhook (sent, mined, errored, cancelled)
  - Event routing ve işleme

- **Contract Event Service** (`backend/src/application/thirdweb-webhook/contract-event.service.ts`)
  - v1.events Contract Subscription
  - ERC20 Transfer, ERC721 Mint/Transfer
  - DEPOSIT, WITHDRAW, internal transfer işleme

- **Alchemy Webhook Service** (`backend/src/application/alchemy-webhook/alchemy-webhook.service.ts`)
  - Alchemy webhook entegrasyonu

### 2.3 İş Mantığı Servisleri

- **Transaction Service** (`backend/src/application/transaction/transaction.service.ts`)
  - `sendTip()`, `claimReward()`, `claimAchievementBadge` sonrası transaction
  - `buyNFT()`, `getUserBalance()`
  - Ledger tabanlı bakiye hesaplama

- **Transaction Notification Service** (`backend/src/application/transaction/transaction-notification.service.ts`)
  - Transaction bildirimleri (tip, NFT vb.)

- **Marketplace Service** (`backend/src/application/marketplace/marketplace.service.ts`)
  - NFT satış listeleme, satın alma
  - `myListings`, `availableNFTs`
  - Contract ile listing senkronizasyonu

- **User Service – Badge Claim** (`backend/src/application/user/user.service.ts`)
  - `claimAchievementBadge()` – Achievement/Bridge badge claim
  - Badge DB → NFT mint → UserBadge kaydı

---

## 3. Infrastructure Katmanı

### 3.1 Repositories

- **NFT Prisma Repository** (`backend/src/infrastructure/repositories/nft-prisma.repository.ts`)
- **NFT Transaction Prisma Repository** (`backend/src/infrastructure/repositories/nft-transaction-prisma.repository.ts`)
- **NFT Market Listing Prisma Repository** (`backend/src/infrastructure/repositories/nft-market-listing-prisma.repository.ts`)
- **Transaction Prisma Repository** (`backend/src/infrastructure/repositories/transaction-prisma.repository.ts`)
- **Thirdweb Webhook Log Prisma Repository** (`backend/src/infrastructure/repositories/thirdweb-webhook-log-prisma.repository.ts`)

### 3.2 Config

- **Web3 Config** (`backend/src/infrastructure/config/web3-config/`)
  - `chain.config.ts` – Sepolia chain
  - `abi.config.ts` – ERC721/ERC20 ABI
  - `contracts.config.ts` – Contract adresleri

### 3.3 Workers

- **Transaction Processor** (`backend/src/infrastructure/workers/transaction-processor.ts`)
  - CREATED → PENDING → CONFIRMED akışı
  - Simüle blockchain gecikmesi

- **Tip Send Worker** (`backend/src/infrastructure/workers/tip-send.worker.ts`)
  - Tip gönderimi worker’ı

### 3.4 Cache

- **Cache Invalidation** (`backend/src/infrastructure/cache/cache-invalidation.ts`)
  - NFT/marketplace cache invalidasyonu

- **Cache Keys** (`backend/src/infrastructure/cache/cache-keys.ts`)
  - NFT ilgili cache key’leri

---

## 4. Interface Katmanı (API Endpoints)

### 4.1 User Router – Badge Claim

- `POST /users/collections/achievements/claim` – badgeId query ile claim
- `POST /users/collections/achievements/:badgeId/claim` – path ile achievement badge claim (NFT mint)
- `POST /users/collections/bridges/:badgeId/claim` – bridge badge claim
  - Badge DB’den okunur, Thirdweb wallet’a NFT mint edilir

### 4.2 Wallet Router

- `POST /wallet/create` – Wallet oluşturma
- `GET /wallet/info` – Wallet bilgisi
- `GET /wallet/balance` – Bakiye

### 4.3 Transaction Router

- `POST /transactions/send-tip` – Tip gönderme
- `GET /transactions/:id` – Transaction detay
- `GET /transactions/history` – Kullanıcı transaction geçmişi
- `GET /transactions/balance` – Kullanıcı bakiyesi
- `POST /transactions/claim-reward` – Ödül claim
- `POST /transactions/buy-nft` – NFT satın alma

### 4.4 Marketplace Router

- `GET /marketplace` – Marketplace listing listesi
- `GET /marketplace/my-listings` – Kullanıcının listing’leri
- `GET /marketplace/available-nfts` – Satışa koyulabilecek NFT’ler
- `POST /marketplace/list` – NFT listeleme
- `POST /marketplace/buy` – NFT satın alma
- `DELETE /marketplace/cancel/:listingId` – Listing iptal

### 4.5 Webhook Routers

- `POST /api/webhooks/thirdweb` – Thirdweb webhook (transaction + v1.events)
- `POST /api/webhooks/thirdweb/events` – Sadece contract events
- Alchemy webhook endpoint’i

---

## 5. Admin Panel

### 5.1 Crypto / NFT Sayfaları

- **NFTs** (`admin-panel/src/pages/crypto/NFTs.tsx`) – NFT listesi, CRUD
- **NFT Marketplace** (`admin-panel/src/pages/crypto/NFTMarketplace.tsx`) – Marketplace yönetimi
- **NFTCreateModal** – NFT oluşturma
- **NFTEditModal** – NFT düzenleme

### 5.2 Admin API

- **admin-crypto.ts** – Wallets, Transactions, Tips, NFT API client
- **admin-nft.router.ts** – Admin NFT CRUD endpoint’leri
- **admin-nft.dto.ts** / **admin-nft.schemas.ts** – DTO ve validasyon

---

## 6. Veritabanı (Prisma Schema)

- **Wallet** – `smartAccountAddress`, `balance`, `lockedBalance`
- **Transaction** – `walletId`, `actionType`, `amount`, `status`, `transactionHash`, `metadata`
- **NFT** – `tokenId`, `contractAddress`, `currentOwnerId`, `viewCount`
- **NFTAttribute** – NFT özellikleri
- **NFTTransaction** – Transfer/sale geçmişi
- **NFTMarketListing** – `nftId`, `listedByUserId`, `price`, `status`
- **NFTClaim** – Claim kayıtları
- **ThirdwebWebhookLog** – Webhook payload log, `queueId`, `transactionHash`, `status`

### Migrasyonlar

- `20260209120000_add_nft_token_id_contract_address` – NFT’ye `tokenId`, `contractAddress`
- `20260127152053_add_thirdweb_webhook_log` – ThirdwebWebhookLog tablosu

---

## 7. Dokümantasyon Dosyaları

- `BACKEND_WALLET_IMPLEMENTATION_REPORT.md` – Wallet implementasyon özeti
- `THIRDWEB_WEBHOOK_INTEGRATION.md` – Thirdweb webhook detaylı kılavuz
- `MARKETPLACE_MY_LISTINGS_AVAILABLE_NFTS.md` – Marketplace endpoint’leri
- `NFT_MARKETPLACE_CACHE_INVALIDATION.md` – Cache invalidasyon
- `MY_NFTS_UPDATE.md` – My NFTs güncellemeleri
- `WALLET_IMPLEMENTATION_COMPLETE.md` / `WALLET_BACKEND_SUMMARY.md`

---

## 8. Ortam Değişkenleri

- `OWNER_PRIVATE_KEY` / `ADMIN_PRIVATE_KEY` – Mint için private key
- `THIRDWEB_SECRET_KEY` – Thirdweb Engine API key
- `THIRDWEB_WEBHOOK_SECRET` – Webhook imza doğrulama
- Chain/RPC URL’leri (Sepolia vb.)

---

## 9. Özet Liste (Modül Adları)

| # | Modül | Konum |
|---|-------|-------|
| 1 | Web3 NFT Service | application/wallet/web3-nft-service |
| 2 | Thirdweb SDK Service | application/wallet/thirdweb-sdk |
| 3 | Wallet Service | application/wallet |
| 4 | Thirdweb Webhook Service | application/thirdweb-webhook |
| 5 | Contract Event Service | application/thirdweb-webhook |
| 6 | Transaction Service | application/transaction |
| 7 | Marketplace Service | application/marketplace |
| 8 | User Badge Claim | application/user (claimAchievementBadge) |
| 9 | Transaction Processor Worker | infrastructure/workers |
| 10 | NFT Repositories | infrastructure/repositories |
| 11 | Web3 Config | infrastructure/config/web3-config |
| 12 | User/Wallet/Transaction/Marketplace Routers | interfaces/ |
| 13 | Thirdweb Webhook Router | interfaces/thirdweb-webhook |
| 14 | Admin NFT Module | admin-panel + interfaces/admin |
| 15 | Prisma Models | NFT, Wallet, Transaction, NFTMarketListing, ThirdwebWebhookLog |
