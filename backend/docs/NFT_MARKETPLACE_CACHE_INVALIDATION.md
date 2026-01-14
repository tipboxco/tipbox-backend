# NFT Marketplace Cache Invalidation

## 📊 Genel Bakış

NFT marketplace işlemlerinde cache'in otomatik olarak temizlenmesi için cache invalidation sistemi eklendi.

### 🎯 Problem

NFT işlemlerinde (listing, buy, cancel) cache güncel kalmıyordu:
- ❌ Yeni listing marketplace'de görünmüyordu
- ❌ Satılan NFT hala satışta görünüyordu
- ❌ User'ın my-nfts listesi güncel değildi
- ❌ NFT detail bilgileri eski kalıyordu

### ✅ Çözüm

Otomatik cache invalidation sistemi:
- ✅ NFT listelendiğinde cache temizleniyor
- ✅ NFT satıldığında buyer/seller cache'leri temizleniyor
- ✅ Listing iptal edildiğinde cache temizleniyor
- ✅ Asenkron çalışıyor (performans kaybı yok)

---

## 🗂️ Yeni Cache Keys

### NFT & Marketplace Keys

```typescript
// NFT related
NFT_MY_NFTS: (userId: string, limit?: number) => 
  limit ? `nft:${userId}:my-nfts:${limit}` : `nft:${userId}:my-nfts`,
NFT_LISTING: (listingId: string) => `nft:listing:${listingId}`,
NFT_DETAIL: (nftId: string) => `nft:${nftId}:detail`,
NFT_PRICE_HISTORY: (nftId: string) => `nft:${nftId}:price-history`,

// Marketplace related
MARKETPLACE_LISTINGS: (params?: string) => 
  params ? `marketplace:listings:${params}` : `marketplace:listings`,
MARKETPLACE_NFT_DETAIL: (nftId: string) => `marketplace:nft:${nftId}`,
```

### Cache Patterns

```typescript
MARKETPLACE_ALL: () => `marketplace:*`,
NFT_USER: (userId: string) => `nft:${userId}:*`,
NFT_ALL: (nftId: string) => `nft:${nftId}:*`,
```

---

## 🔄 Cache Invalidation Fonksiyonları

### 1. **invalidateMarketplaceListings()**
Marketplace listing cache'lerini temizler.

**Kullanım**: Yeni NFT listelendiğinde

```typescript
await invalidateMarketplaceListings();
```

**Temizlenen Cache'ler**:
- `marketplace:listings:*` (tüm listing query'leri)
- `marketplace:featured` (featured NFT'ler)

---

### 2. **invalidateNFTCache(nftId)**
Belirli bir NFT'nin cache'ini temizler.

**Kullanım**: NFT bilgileri değiştiğinde

```typescript
await invalidateNFTCache(nftId);
```

**Temizlenen Cache'ler**:
- `nft:${nftId}:detail`
- `nft:${nftId}:price-history`
- `marketplace:nft:${nftId}`

---

### 3. **invalidateUserNFTCache(userId)**
User'ın NFT cache'lerini temizler.

**Kullanım**: User NFT aldığında/sattığında

```typescript
await invalidateUserNFTCache(userId);
```

**Temizlenen Cache'ler**:
- `nft:${userId}:*` (tüm my-nfts cache'leri)

---

### 4. **invalidateNFTListingCache(params)** ⭐
NFT listing oluşturma/iptal sonrası cache temizleme.

**Kullanım**: NFT listelendiğinde veya listing iptal edildiğinde

```typescript
await invalidateNFTListingCache({
  nftId: nft.id,
  userId: userId,
});
```

**Temizlenen Cache'ler**:
- NFT detail cache
- User NFT cache
- Marketplace listings cache

---

### 5. **invalidateNFTTransactionCache(params)** ⭐⭐
NFT alış-satış sonrası komple cache temizleme.

**Kullanım**: NFT satın alındığında

```typescript
await invalidateNFTTransactionCache({
  nftId: nft.id,
  sellerId: seller.id,
  buyerId: buyer.id,
});
```

**Temizlenen Cache'ler**:
- NFT detail cache
- Seller'ın NFT cache'i
- Buyer'ın NFT cache'i
- Marketplace listings cache

---

## 🎯 Marketplace Service Entegrasyonu

### 1. Create Listing

**Dosya**: `marketplace.service.ts`

```typescript
async createListing(userId: string, request: CreateListingRequest) {
  // ... listing oluştur
  
  // Cache invalidation (async, non-blocking)
  invalidateNFTListingCache({
    nftId: nft.id,
    userId,
  }).catch(error => {
    logger.error('Error invalidating NFT listing cache:', error);
  });
  
  return listing;
}
```

**Ne Zaman**: NFT marketplace'e listelendiğinde
**Temizlenen**: User's my-nfts, NFT detail, marketplace listings

---

### 2. Cancel Listing

```typescript
async cancelListing(userId: string, listingId: string) {
  // ... listing iptal et
  
  // Cache invalidation
  invalidateNFTListingCache({
    nftId: listing.nftId,
    userId,
  }).catch(error => {
    logger.error('Error invalidating NFT listing cache:', error);
  });
}
```

**Ne Zaman**: Listing iptal edildiğinde
**Temizlenen**: User's my-nfts, NFT detail, marketplace listings

---

### 3. Buy NFT

```typescript
async buyNFT(userId: string, request: BuyNFTRequest) {
  // ... NFT satın al
  // ... ownership transfer
  // ... listing SOLD yap
  
  // Cache invalidation
  invalidateNFTTransactionCache({
    nftId: nft.id,
    sellerId: listing.listedByUserId,
    buyerId: userId,
  }).catch(error => {
    logger.error('Error invalidating NFT transaction cache:', error);
  });
  
  return result;
}
```

**Ne Zaman**: NFT satın alındığında
**Temizlenen**: 
- Buyer's my-nfts
- Seller's my-nfts
- NFT detail
- Marketplace listings

---

## 🔍 Cache Flow Örnekleri

### Örnek 1: NFT Listing

```
User -> POST /marketplace/listing
  ↓
createListing()
  ↓
Database: NFTMarketListing created
  ↓
invalidateNFTListingCache() [async]
  ├─ Delete: nft:${userId}:my-nfts:*
  ├─ Delete: nft:${nftId}:detail
  ├─ Delete: nft:${nftId}:price-history
  ├─ Delete: marketplace:nft:${nftId}
  └─ Delete: marketplace:listings:*
  ↓
Response: listing created ✅
```

**Sonuç**:
- ✅ User tekrar my-nfts çağırınca fresh data
- ✅ Marketplace listings fresh data
- ✅ NFT detail fresh data

---

### Örnek 2: NFT Buy

```
User -> POST /marketplace/buy
  ↓
buyNFT()
  ↓
TransactionService.buyNFT()
  ├─ Wallet balance check
  ├─ Create transactions (buyer/seller)
  ├─ Update balances
  ├─ Transfer NFT ownership
  └─ NFT transaction record
  ↓
Mark listing as SOLD
  ↓
invalidateNFTTransactionCache() [async]
  ├─ Delete: nft:${sellerId}:my-nfts:*
  ├─ Delete: nft:${buyerId}:my-nfts:*
  ├─ Delete: nft:${nftId}:detail
  ├─ Delete: nft:${nftId}:price-history
  ├─ Delete: marketplace:nft:${nftId}
  └─ Delete: marketplace:listings:*
  ↓
Response: purchase successful ✅
```

**Sonuç**:
- ✅ Seller my-nfts'de artık NFT yok
- ✅ Buyer my-nfts'de NFT görünüyor
- ✅ NFT detail'de yeni owner
- ✅ Marketplace'de listing yok

---

### Örnek 3: Cancel Listing

```
User -> DELETE /marketplace/listing/{id}
  ↓
cancelListing()
  ↓
Database: listing status = CANCELLED
  ↓
invalidateNFTListingCache() [async]
  ├─ Delete: nft:${userId}:my-nfts:*
  ├─ Delete: nft:${nftId}:detail
  ├─ Delete: nft:${nftId}:price-history
  ├─ Delete: marketplace:nft:${nftId}
  └─ Delete: marketplace:listings:*
  ↓
Response: listing cancelled ✅
```

**Sonuç**:
- ✅ User my-nfts'de NFT artık listing yok
- ✅ Marketplace'de listing görünmüyor
- ✅ NFT detail güncellendi

---

## ⚡ Performance Considerations

### Asenkron Çalışma

Cache invalidation **asenkron** çalışır, response'u bloklamaz:

```typescript
// ❌ Senkron (response'u bekletir)
await invalidateNFTListingCache({ nftId, userId });
return response;

// ✅ Asenkron (response hemen döner)
invalidateNFTListingCache({ nftId, userId })
  .catch(error => logger.error('Cache invalidation error:', error));
return response;
```

**Avantajlar**:
- ⚡ API response süresi etkilenmez
- ✅ Cache hatası API'yi etkilemez
- 🔄 Background'da temizlik yapılır

### Error Handling

Cache invalidation hataları **log**lanır ama **throw edilmez**:

```typescript
.catch(error => {
  logger.error('Error invalidating cache:', error);
  // ❌ throw etmiyoruz - API devam eder
});
```

**Sebep**: Cache sorunu business logic'i etkilememeli.

---

## 🧪 Test Scenarios

### Test 1: List NFT

```bash
# 1. NFT listele
POST /marketplace/listing
{
  "nftId": "nft-123",
  "amount": 150
}

# 2. My NFTs çağır (cache boş, DB'den gelir)
GET /marketplace/my-nfts
# ✅ Listing bilgisi görünür

# 3. Marketplace listings çağır
GET /marketplace/listings
# ✅ Yeni listing görünür
```

### Test 2: Buy NFT

```bash
# 1. NFT satın al
POST /marketplace/buy
{
  "listingId": "listing-456"
}

# 2. Seller my-nfts çağır
GET /marketplace/my-nfts (seller)
# ✅ NFT artık yok

# 3. Buyer my-nfts çağır
GET /marketplace/my-nfts (buyer)
# ✅ NFT görünür, listing=null

# 4. Marketplace listings çağır
GET /marketplace/listings
# ✅ Listing artık yok (SOLD)
```

### Test 3: Cancel Listing

```bash
# 1. Listing iptal et
DELETE /marketplace/listing/{id}

# 2. My NFTs çağır
GET /marketplace/my-nfts
# ✅ Listing artık yok

# 3. Marketplace listings çağır
GET /marketplace/listings
# ✅ Listing görünmüyor
```

---

## 📝 Files Changed

1. ✅ **`cache-keys.ts`**
   - NFT cache keys eklendi
   - Marketplace cache keys genişletildi
   - Cache patterns eklendi

2. ✅ **`cache-invalidation.ts`**
   - `invalidateMarketplaceListings()`
   - `invalidateNFTCache(nftId)`
   - `invalidateUserNFTCache(userId)`
   - `invalidateNFTListingCache(params)`
   - `invalidateNFTTransactionCache(params)`

3. ✅ **`marketplace.service.ts`**
   - `createListing()` - cache invalidation eklendi
   - `cancelListing()` - cache invalidation eklendi
   - `buyNFT()` - cache invalidation eklendi

---

## ✅ Benefits

1. **Tutarlılık**: Cache her zaman güncel
2. **Performance**: Asenkron, response'u yavaşlatmaz
3. **Reliability**: Cache hatası business logic'i etkilemez
4. **Granular**: Sadece gerekli cache'ler temizlenir
5. **Maintainability**: Merkezi cache yönetimi

---

## 🎉 Sonuç

NFT marketplace artık cache-aware:
- ✅ Listing oluşturma → cache temizlenir
- ✅ NFT satın alma → buyer/seller cache temizlenir
- ✅ Listing iptal → cache temizlenir
- ✅ Asenkron, performans kaybı yok
- ✅ Error tolerant

**Frontend artık her zaman fresh data görür!** 🚀

---

**Hazırlayan**: Backend Team  
**Tarih**: 14 Ocak 2026  
**Durum**: ✅ Production Ready
