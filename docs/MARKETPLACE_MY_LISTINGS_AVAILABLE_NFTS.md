# Marketplace My Listings & Available NFTs Endpoints

## 📊 Genel Bakış

Marketplace'e iki yeni endpoint eklendi:
1. **My Listings** - Kullanıcının oluşturduğu tüm listing'ler
2. **Available NFTs** - Satışa koyulabilecek NFT'ler (listing'i olmayan)

---

## 🎯 Endpoint 1: My Listings

### API

```
GET /marketplace/my-listings?limit=50&cursor=xyz
Authorization: Bearer {token}
```

### Açıklama

Kullanıcının oluşturduğu **ACTIVE listing'leri** getirir.

**Önemli**: Sadece `status: ACTIVE` olan listing'ler döner. SOLD veya CANCELLED listing'ler dahil değil.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Sayfa başına item sayısı (max: 100) |
| `cursor` | string | - | Pagination için cursor |

### Response Format

```json
{
  "items": [
    {
      "id": "409476bd-246a-4cc2-8df6-9f91e67034fc",
      "title": "User2 Collector Badge",
      "username": "burakcan",
      "image": "https://...",
      "description": "Special collector badge for user #2",
      "type": "BADGE",
      "rarity": "RARE",
      "listing": {
        "id": "a2067ebe-0b59-4a1c-baac-d758bb77da3f",
        "price": 75,
        "listedAt": "2026-01-13T19:06:15.457Z",
        "status": "CANCELLED"
      }
    },
    {
      "id": "509576bd-246a-4cc2-8df6-9f91e67034fd",
      "title": "Golden Frame",
      "username": "burakcan",
      "image": "https://...",
      "description": "Exclusive golden frame",
      "type": "COSMETIC",
      "rarity": "EPIC",
      "listing": {
        "id": "b3178ebe-0b59-4a1c-baac-d758bb77da3g",
        "price": 250,
        "listedAt": "2026-01-14T10:30:00.000Z",
        "status": "ACTIVE"
      }
    }
  ],
  "pagination": {
    "cursor": "509576bd-246a-4cc2-8df6-9f91e67034fd",
    "hasMore": false,
    "limit": 50
  }
}
```

**Not**: Tüm listing'lerin `status` değeri **ACTIVE** olur. SOLD veya CANCELLED listing'ler bu endpoint'te görünmez.

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | NFT ID |
| `title` | string | NFT adı |
| `username` | string | Kullanıcı adı |
| `image` | string | NFT görseli |
| `description` | string? | NFT açıklaması |
| `type` | string | BADGE \| COSMETIC \| LOOTBOX |
| `rarity` | string | COMMON \| RARE \| EPIC |
| `listing` | object | **Her zaman dolu** (listing bilgisi) |
| `listing.id` | string | Listing ID |
| `listing.price` | number | Fiyat (TIPS) |
| `listing.listedAt` | string | Listeleme tarihi (ISO) |
| `listing.status` | string | **Always ACTIVE** |

### Use Cases

#### 1. Active Listings (Tek Durum)
```json
{
  "listing": {
    "status": "ACTIVE",
    "price": 150
  }
}
```
**UI**: "On Sale - 150 TIPS" badge, "Cancel" veya "Update Price" butonları

**Not**: SOLD ve CANCELLED listing'ler bu endpoint'te görünmez.

---

## 🎯 Endpoint 2: Available NFTs

### API

```
GET /marketplace/available-nfts?limit=50&cursor=xyz
Authorization: Bearer {token}
```

### Açıklama

Kullanıcının satışa koyabileceği NFT'leri getirir. **Sadece ACTIVE listing'i olmayan NFT'ler döner.**

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Sayfa başına item sayısı (max: 100) |
| `cursor` | string | - | Pagination için cursor |

### Response Format

```json
{
  "items": [
    {
      "id": "609676bd-246a-4cc2-8df6-9f91e67034fe",
      "title": "Early Adopter Badge",
      "username": "burakcan",
      "image": "https://...",
      "description": "Awarded to early platform members",
      "type": "BADGE",
      "rarity": "COMMON",
      "listing": null
    },
    {
      "id": "709776bd-246a-4cc2-8df6-9f91e67034ff",
      "title": "Blue Avatar Frame",
      "username": "burakcan",
      "image": "https://...",
      "description": "A cool blue frame",
      "type": "COSMETIC",
      "rarity": "RARE",
      "listing": null
    }
  ],
  "pagination": {
    "cursor": "709776bd-246a-4cc2-8df6-9f91e67034ff",
    "hasMore": true,
    "limit": 50
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | NFT ID |
| `title` | string | NFT adı |
| `username` | string | Kullanıcı adı |
| `image` | string | NFT görseli |
| `description` | string? | NFT açıklaması |
| `type` | string | BADGE \| COSMETIC \| LOOTBOX |
| `rarity` | string | COMMON \| RARE \| EPIC |
| `listing` | null | **Her zaman null** (listing yok) |

### Filtreleme Mantığı

```typescript
// Available NFTs = Tüm NFT'ler - ACTIVE listing'i olanlar
const allNFTs = await nftRepo.findByOwnerId(userId);
const activeListings = await listingRepo.findActive(userId);
const availableNFTs = allNFTs.filter(nft => 
  !activeListings.some(listing => listing.nftId === nft.id)
);
```

**Önemli**: 
- ✅ SOLD listing'i olan NFT → Available (tekrar satışa konabilir)
- ✅ CANCELLED listing'i olan NFT → Available (tekrar satışa konabilir)
- ❌ ACTIVE listing'i olan NFT → Not Available (zaten satışta)

---

## 🔄 Endpoint Karşılaştırması

| Feature | my-nfts | my-listings | available-nfts |
|---------|---------|-------------|----------------|
| **Purpose** | Sahip olduğum tüm NFT'ler | ACTIVE listing'lerim | Satışa koyabileceğim NFT'ler |
| **Listing Field** | Optional | Always present (ACTIVE) | Always null |
| **Listing Status** | Any (ACTIVE/SOLD/CANCELLED) | Only ACTIVE | N/A |
| **Filter** | Ownership | Created by user + ACTIVE | No active listing |
| **Use Case** | NFT inventory | Manage active listings | Create new listing |

---

## 📱 Frontend Kullanımı

### My Listings Ekranı

```typescript
// Fetch my listings
const response = await fetch('/marketplace/my-listings?limit=50', {
  headers: { 'Authorization': `Bearer ${token}` },
});
const { items, pagination } = await response.json();

// Render
items.forEach(nft => {
  const { listing } = nft;
  
  // listing.status her zaman ACTIVE
  <View>
    <Badge color="green">On Sale - {listing.price} TIPS</Badge>
    <Button onPress={() => cancelListing(listing.id)}>Cancel</Button>
    <Button onPress={() => updatePrice(listing.id)}>Update Price</Button>
  </View>
});
```

### Create Listing Ekranı

```typescript
// Fetch available NFTs (to list)
const response = await fetch('/marketplace/available-nfts?limit=50', {
  headers: { 'Authorization': `Bearer ${token}` },
});
const { items } = await response.json();

// Render NFT selection
items.forEach(nft => {
  // nft.listing is always null
  <NFTCard 
    nft={nft}
    onSelect={() => showPriceInput(nft.id)}
  >
    <Text>Select to List</Text>
  </NFTCard>
});

// Create listing
const createListing = async (nftId, price) => {
  await fetch('/marketplace/listing', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ nftId, amount: price }),
  });
};
```

---

## 🎨 UI Flow Examples

### Flow 1: View My Listings

```
1. User opens "My Listings" screen
   ↓
2. GET /marketplace/my-listings
   ↓
3. Show list with ACTIVE status:
   - Green "On Sale" badge
   - "Cancel" button
   - "Update Price" button
```

### Flow 2: Create New Listing

```
1. User opens "Create Listing" screen
   ↓
2. GET /marketplace/available-nfts
   ↓
3. Show NFTs without active listing
   ↓
4. User selects NFT → enters price
   ↓
5. POST /marketplace/listing
   ↓
6. NFT moves from available-nfts to my-listings
```

### Flow 3: Cancel Listing

```
1. User opens "My Listings"
   ↓
2. User taps "Cancel" on ACTIVE listing
   ↓
3. DELETE /marketplace/listing/{id}
   ↓
4. Listing status → CANCELLED
   ↓
5. NFT appears in available-nfts again
```

---

## 💾 Implementation Details

### Service: listMyListings()

```typescript
async listMyListings(userId: string, query: ListUserNFTsQuery) {
  // 1. Fetch user's ACTIVE listings only
  const listings = await prisma.nFTMarketListing.findMany({
    where: { 
      listedByUserId: userId,
      status: 'ACTIVE',  // ✅ Sadece ACTIVE
    },
    orderBy: { listedAt: 'desc' },
    include: { nft: true },
  });

  // 2. Map to response format
  return listings.map(listing => ({
    ...listing.nft,
    listing: {
      id: listing.id,
      price: listing.price,
      listedAt: listing.listedAt,
      status: listing.status,
    },
  }));
}
```

**Key Points**:
- ✅ Includes NFT data via `include: { nft: true }`
- ✅ **Only ACTIVE status** listings
- ✅ Ordered by `listedAt DESC` (newest first)

### Service: listAvailableNFTs()

```typescript
async listAvailableNFTs(userId: string, query: ListUserNFTsQuery) {
  // 1. Fetch user's NFTs
  const nfts = await nftRepo.findByOwnerId(userId);

  // 2. Fetch ACTIVE listings
  const activeListings = await prisma.nFTMarketListing.findMany({
    where: { 
      listedByUserId: userId,
      status: 'ACTIVE',
    },
  });

  // 3. Filter out NFTs with active listings
  const listedNftIds = new Set(activeListings.map(l => l.nftId));
  const availableNfts = nfts.filter(nft => 
    !listedNftIds.has(nft.id)
  );

  // 4. Map to response (listing = null)
  return availableNfts.map(nft => ({
    ...nft,
    listing: null,
  }));
}
```

**Key Points**:
- ✅ Only filters ACTIVE listings
- ✅ SOLD/CANCELLED listings don't prevent re-listing
- ✅ `listing` field always `null`

---

## 🧪 Test Scenarios

### Test 1: My Listings

```bash
# User has 3 listings:
# 1. NFT-A: ACTIVE
# 2. NFT-B: SOLD
# 3. NFT-C: CANCELLED

GET /marketplace/my-listings

# Expected response: 1 item
# - NFT-A with listing.status = "ACTIVE"
# ❌ NFT-B ve NFT-C dahil değil (SOLD/CANCELLED)
```

### Test 2: Available NFTs

```bash
# User has 3 NFTs:
# - NFT-A: ACTIVE listing
# - NFT-B: SOLD listing (available for re-list)
# - NFT-C: No listing

GET /marketplace/available-nfts

# Expected response: 2 items
# - NFT-B (listing = null)
# - NFT-C (listing = null)
# ❌ NFT-A not included (has ACTIVE listing)
```

### Test 3: Create & Cancel Flow

```bash
# 1. Available NFTs
GET /marketplace/available-nfts
# Response: [NFT-X, NFT-Y]

# 2. Create listing for NFT-X
POST /marketplace/listing
{ "nftId": "NFT-X", "amount": 150 }

# 3. Available NFTs again
GET /marketplace/available-nfts
# Response: [NFT-Y] (NFT-X removed)

# 4. My listings
GET /marketplace/my-listings
# Response: [..., NFT-X with ACTIVE listing]

# 5. Cancel listing
DELETE /marketplace/listing/{id}

# 6. Available NFTs again
GET /marketplace/available-nfts
# Response: [NFT-X, NFT-Y] (NFT-X back)
```

---

## 📝 Files Changed

1. ✅ **marketplace.service.ts**
   - `listMyListings()` - Kullanıcının listing'leri
   - `listAvailableNFTs()` - Satışa koyulabilecek NFT'ler

2. ✅ **marketplace.router.ts**
   - `GET /marketplace/my-listings` - Endpoint eklendi
   - `GET /marketplace/available-nfts` - Endpoint eklendi
   - Swagger documentation

3. ✅ **marketplace.dto.ts**
   - `UserNFTResponse` (zaten var, kullanıldı)
   - `ListUserNFTsQuery` (zaten var, kullanıldı)

---

## ✅ Summary

### My Listings Endpoint
- ✅ URL: `GET /marketplace/my-listings`
- ✅ Purpose: Kullanıcının **ACTIVE** listing'leri
- ✅ Response: Her item'da `listing.status` = "ACTIVE"
- ✅ Use Case: Manage active listings (cancel, update price)

### Available NFTs Endpoint
- ✅ URL: `GET /marketplace/available-nfts`
- ✅ Purpose: Satışa koyulabilecek NFT'ler
- ✅ Response: Her item'da `listing` field null
- ✅ Use Case: Create new listing selection

---

**Hazırlayan**: Backend Team  
**Tarih**: 14 Ocak 2026  
**Durum**: ✅ Production Ready
