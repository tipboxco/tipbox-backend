# AdminMintService - NFT Mint İşlemleri Dokümantasyonu

NFT contract'ının owner'ı tarafından NFT mint işlemlerini gerçekleştirmek için kullanılan servis.
Private key kullanarak server-side mint işlemleri yapar.

> ⚠️ **GÜVENLİK UYARISI**: Bu servis SADECE server-side (API routes) kullanılmalıdır!
> Private key'i asla client-side'da kullanmayın!

---

## İçindekiler

1. [Kurulum ve Yapılandırma](#kurulum-ve-yapılandırma)
2. [Hızlı Başlangıç](#hızlı-başlangıç)
3. [Config Parametreleri](#config-parametreleri)
4. [API Referansı](#api-referansı)
5. [Kullanım Örnekleri](#kullanım-örnekleri)
6. [API Route Entegrasyonu](#api-route-entegrasyonu)
7. [Gas Fee Limiter](#gas-fee-limiter)
8. [Hata Kodları](#hata-kodları)
9. [Tip Tanımları](#tip-tanımları)

---

## Kurulum ve Yapılandırma

### 1. Environment Variables

`.env` dosyasına ekleyin:

```env
# NFT contract owner'ının private key'i (zorunlu)
ADMIN_PRIVATE_KEY=0x...

# Thirdweb dashboard'dan alınır (opsiyonel)
THIRDWEB_SECRET_KEY=...
```

### 2. Private Key Nasıl Alınır

**MetaMask:**
1. MetaMask açın
2. Hesap > Hesap Detayları
3. "Özel Anahtarı Dışa Aktar" butonuna tıklayın
4. Şifrenizi girin

**Önemli Notlar:**
- Bu cüzdan NFT contract'ının **owner**'ı olmalı
- Testnet için ETH bakiyesi olmalı (gas için)

### 3. Sepolia Testnet ETH Alma

- https://sepoliafaucet.com
- https://faucet.sepolia.dev
- https://sepolia-faucet.pk910.de

---

## Hızlı Başlangıç

### Temel Kullanım

```typescript
import { AdminMintService } from "@/services/admin-mint";
import { sepoliaChain, ERC721_ABI } from "@/config";

// Service oluştur
const service = new AdminMintService({
  privateKey: process.env.ADMIN_PRIVATE_KEY,
  secretKey: process.env.THIRDWEB_SECRET_KEY,
  contractAddress: "0xB7b9dfdB0291510e4677aADD2b03a39B9d46d235",
  chain: sepoliaChain,
  abi: ERC721_ABI,
  maxGasFeeEth: 0.01 // 0.01 ETH üzeri işlemler reddedilir
});

// NFT mint et
const result = await service.mintWithMetadata(
  "0x1234567890123456789012345678901234567890",
  {
    name: "TipBox Badge #1",
    description: "TipBox topluluk rozeti",
    image: "ipfs://QmXxx...",
    attributes: [
      { trait_type: "Tier", value: "Gold" },
      { trait_type: "Level", value: 5 }
    ]
  }
);

if (result.success) {
  console.log("NFT mint edildi:", result.transactionHash);
} else {
  console.error("Hata:", result.error);
}
```

### Factory Function ile Kullanım

```typescript
import { createAdminMintService } from "@/services/admin-mint";

// Environment variables'dan otomatik oluşturur
const service = createAdminMintService();

// Admin adresini kontrol et
console.log("Admin:", service.getAdminAddress());
```

---

## Config Parametreleri

### AdminMintConfig Interface

```typescript
interface AdminMintConfig {
  // NFT contract owner'ının private key'i (0x... formatında)
  privateKey?: string;
  
  // Thirdweb secret key (dashboard'dan alınır, opsiyonel)
  secretKey?: string;
  
  // NFT contract adresi
  contractAddress?: string;
  
  // Blockchain network (Chain objesi)
  chain?: Chain;
  
  // Contract ABI (safeMint fonksiyonunu içermeli)
  abi?: ContractAbi;
  
  // Maksimum gas fee limiti (ETH cinsinden)
  // Bu değerin üzerindeki işlemler reddedilir
  maxGasFeeEth?: number;
}
```

### Varsayılan Değerler

| Parametre | Varsayılan | Açıklama |
|-----------|------------|----------|
| `privateKey` | `undefined` | Env'den alınabilir |
| `secretKey` | `process.env.THIRDWEB_SECRET_KEY` | Thirdweb secret |
| `contractAddress` | `CONTRACT_ADDRESSES.tipboxBadge` | Config'den alınır |
| `chain` | `sepoliaChain` | Sepolia testnet |
| `abi` | `ERC721_ABI` | Config'den alınır |
| `maxGasFeeEth` | `null` | Limit yok |

---

## API Referansı

### Constructor

```typescript
new AdminMintService(config: AdminMintConfig)
// veya geriye uyumluluk için:
new AdminMintService(privateKey?: string, secretKey?: string, nftAddress?: string)
```

### Yapılandırma Fonksiyonları

| Fonksiyon | Döndürdüğü | Açıklama |
|-----------|------------|----------|
| `setPrivateKey(key)` | `void` | Private key'i sonradan ayarlar |
| `getAdminAddress()` | `string \| null` | Admin wallet adresini döndürür |
| `getChain()` | `Chain` | Kullanılan chain'i döndürür |
| `getContractAddress()` | `string` | Contract adresini döndürür |
| `getContractAbi()` | `ContractAbi` | ABI'yi döndürür |
| `getMaxGasFee()` | `number \| null` | Gas limitini döndürür |
| `setMaxGasFee(eth)` | `void` | Gas limitini ayarlar |

### Mint Fonksiyonları

| Fonksiyon | Döndürdüğü | Açıklama |
|-----------|------------|----------|
| `mintWithMetadata(to, metadata)` | `Promise<AdminMintResult>` | Metadata objesi ile mint |
| `safeMint(to, tokenURI)` | `Promise<AdminMintResult>` | Token URI ile mint |
| `mintTo(to, metadata)` | `Promise<AdminMintResult>` | mintWithMetadata alias |
| `mintWithIPFS(to, ipfsURI)` | `Promise<AdminMintResult>` | IPFS URI ile mint |
| `batchMint(recipients)` | `Promise<AdminMintResult[]>` | Toplu mint |

### Yardımcı Fonksiyonlar

| Fonksiyon | Döndürdüğü | Açıklama |
|-----------|------------|----------|
| `getAdminBalance()` | `Promise<{balance, balanceEth}>` | Admin cüzdan bakiyesi |
| `estimateGasFee(to, metadata)` | `Promise<GasEstimate \| null>` | Gas tahmini |
| `checkGasLimit(estimatedEth)` | `{withinLimit, limit, estimated, message}` | Gas limit kontrolü |

---

## Kullanım Örnekleri

### Örnek 1: Metadata ile Mint

```typescript
const result = await service.mintWithMetadata(
  "0x1234567890123456789012345678901234567890",
  {
    name: "TipBox Badge #1",
    description: "TipBox topluluk rozeti",
    image: "ipfs://QmXxxYyyZzz...",
    external_url: "https://tipbox.app/badge/1",
    attributes: [
      { trait_type: "Tier", value: "Gold" },
      { trait_type: "Points", value: 100 }
    ]
  }
);
```

### Örnek 2: IPFS URI ile Mint

```typescript
// Metadata'yı önceden IPFS'e yüklediyseniz:
const result = await service.mintWithIPFS(
  "0x1234567890123456789012345678901234567890",
  "ipfs://QmXxxYyyZzz..."
);
```

### Örnek 3: Toplu Mint (Batch)

```typescript
const recipients = [
  { address: "0xAAA...", metadata: { name: "Badge #1" } },
  { address: "0xBBB...", metadata: { name: "Badge #2" } },
  { address: "0xCCC...", metadata: { name: "Badge #3" } },
];

const results = await service.batchMint(recipients);

const successful = results.filter(r => r.success).length;
console.log(`${successful}/${results.length} başarılı`);
```

### Örnek 4: Gas Tahmini

```typescript
const estimate = await service.estimateGasFee(
  "0x1234567890123456789012345678901234567890",
  { name: "Test NFT" }
);

if (estimate) {
  console.log("Tahmini gas:", estimate.estimatedCostEth, "ETH");
  console.log("Admin bakiye:", estimate.adminBalanceEth, "ETH");
  console.log("Yeterli bakiye:", estimate.hasEnoughBalance);
}
```

---

## API Route Entegrasyonu

### Mevcut Endpoint

**POST /api/admin/mint**

### Request Body

```json
{
  "toAddress": "0x1234567890123456789012345678901234567890",
  "metadata": {
    "name": "TipBox Badge",
    "description": "Açıklama",
    "image": "ipfs://... veya https://...",
    "attributes": [
      { "trait_type": "Tier", "value": "Gold" }
    ]
  }
}
```

### Sadece Gas Tahmini

```json
{
  "estimateOnly": true,
  "toAddress": "0x...",
  "metadata": { "name": "Test" }
}
```

### Response (Başarılı)

```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "adminAddress": "0x...",
  "message": "NFT başarıyla mint edildi"
}
```

### Response (Hata)

```json
{
  "success": false,
  "error": "Hata mesajı",
  "adminAddress": "0x..."
}
```

### Frontend'den API Çağrısı

```typescript
const response = await fetch("/api/admin/mint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    toAddress: "0x...",
    metadata: {
      name: "NFT Adı",
      description: "Açıklama",
      image: "https://...",
    }
  })
});

const data = await response.json();

if (data.success) {
  console.log("Tx:", data.transactionHash);
} else {
  console.error("Hata:", data.error);
}
```

---

## Gas Fee Limiter

Gas fee limiter, belirli bir gas ücreti eşiğinin üzerindeki mint işlemlerini otomatik olarak reddeder.

### Yapılandırma

```typescript
// Constructor'da ayarlama
const service = new AdminMintService({
  privateKey: "0x...",
  maxGasFeeEth: 0.01 // 0.01 ETH = ~$25 (varsayılan ETH fiyatıyla)
});

// Sonradan ayarlama
service.setMaxGasFee(0.005); // 0.005 ETH

// Limit kaldırma
service.setMaxGasFee(null);
```

### Davranış

1. Her `safeMint` çağrısında gas tahmini yapılır
2. Tahmini gas > limit ise işlem **reddedilir**
3. Hata mesajı döndürülür: `"Gas fee limiti aşıldı! Limit: X ETH, Tahmini: Y ETH"`

### Manuel Kontrol

```typescript
// Gas tahmini al
const estimate = await service.estimateGasFee("0x...", metadata);
const estimatedEth = parseFloat(estimate.estimatedCostEth);

// Limit kontrolü
const check = service.checkGasLimit(estimatedEth);

if (!check.withinLimit) {
  console.error(check.message);
  // İşlemi iptal et veya kullanıcıyı bilgilendir
}
```

### Önerilen Limitler

| Network | Önerilen Limit | Açıklama |
|---------|----------------|----------|
| Sepolia Testnet | 0.01 ETH | Test için yeterli |
| Ethereum Mainnet | 0.005 ETH | Normal işlem |
| Yüksek trafik zamanı | 0.02 ETH | Gerekirse artırın |

---

## Hata Kodları

| Hata Mesajı | Sebep | Çözüm |
|-------------|-------|-------|
| "Admin private key ayarlanmamış" | Private key yok | `.env`'e `ADMIN_PRIVATE_KEY` ekle |
| "Yetersiz bakiye" | Gas için ETH yok | Faucet'ten ETH al |
| "Contract owner yetkisi gerekli" | Yanlış private key | Doğru key kullan |
| "Geçersiz private key formatı" | Format hatası | 0x ile başlayan 64 hex |
| "Geçersiz alıcı adresi" | Adres formatı yanlış | 0x ile başlayan 40 hex |
| "Gas fee limiti aşıldı!" | Gas çok yüksek | Limiti artır veya bekle |
| "Bu NFT soulbound" | Transfer denemesi | Transfer edilemez |
| "İşlem sırası hatası" | Nonce problemi | Bekleyip tekrar dene |

---

## Tip Tanımları

### AdminMintResult

```typescript
interface AdminMintResult {
  success: boolean;           // İşlem başarılı mı?
  transactionHash?: string;   // Blockchain tx hash
  tokenId?: string;           // Mint edilen token ID
  error?: string;             // Hata mesajı
}
```

### NFTMetadata

```typescript
interface NFTMetadata {
  name: string;               // NFT adı (zorunlu)
  description?: string;       // Açıklama
  image?: string;             // Görsel URL (IPFS/HTTPS)
  animation_url?: string;     // Video/animasyon URL
  external_url?: string;      // Harici link
  attributes?: Array<{        // Özellikler
    trait_type: string;
    value: string | number;
  }>;
}
```

### GasEstimate

```typescript
interface GasEstimate {
  gasLimit: string;           // Gas limit (wei)
  gasPrice: string;           // Gas price (wei)
  estimatedCostWei: string;   // Toplam maliyet (wei)
  estimatedCostEth: string;   // Toplam maliyet (ETH)
  adminBalance: string;       // Admin bakiye (wei)
  adminBalanceEth: string;    // Admin bakiye (ETH)
  hasEnoughBalance: boolean;  // Bakiye yeterli mi?
}
```

---

## Minimum ABI Gereksinimi

Service'in çalışması için ABI'da şu fonksiyon olmalı:

```typescript
{
  inputs: [
    { name: "to", type: "address" },
    { name: "uri", type: "string" }
  ],
  name: "safeMint",
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "nonpayable",
  type: "function"
}
```

---

## Örnek API Route

```typescript
// app/api/admin/mint/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AdminMintService } from "@/services/admin-mint";
import { sepoliaChain, ERC721_ABI, CONTRACT_ADDRESSES } from "@/config";

export async function POST(request: NextRequest) {
  try {
    const { toAddress, metadata } = await request.json();

    const service = new AdminMintService({
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      secretKey: process.env.THIRDWEB_SECRET_KEY,
      contractAddress: CONTRACT_ADDRESSES.tipboxBadge,
      chain: sepoliaChain,
      abi: ERC721_ABI,
      maxGasFeeEth: 0.01, // Gas limiti
    });

    const result = await service.mintWithMetadata(toAddress, metadata);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Beklenmeyen hata" },
      { status: 500 }
    );
  }
}
```

---

## Dosya Yapısı

```
src/services/admin-mint/
├── index.ts          # Ana export dosyası
├── web3.nft.service.ts        # AdminMintService class
├── types.ts          # Tip tanımları
└── README.md         # Bu dokümantasyon
```

---

## Değişiklik Geçmişi

| Tarih | Değişiklik |
|-------|------------|
| 2026-01-27 | Modüler klasör yapısına taşındı |
| 2026-01-27 | Gas fee limiter eklendi |
| 2026-01-27 | Chain, ABI, contractAddress constructor'a eklendi |
| 2026-01-27 | Dokümantasyon ayrı .md dosyasına taşındı |
