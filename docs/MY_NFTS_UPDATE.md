# My NFTs Endpoint Güncelleme

## 🎯 Değişiklik Özeti

`GET /marketplace/my-nfts` endpoint'ine `description`, `type` ve `rarity` alanları eklendi. Frontend bu alanları kullanarak filtreleme yapabilir.

---

## 📍 Endpoint

```
GET /marketplace/my-nfts
```

### 🔐 Authentication
```
Authorization: Bearer {JWT_TOKEN}
```

### 📥 Query Parameters (Opsiyonel)
```typescript
{
  limit?: number;    // Default: 50, Max: 100
  cursor?: string;   // Pagination için (son item'ın ID'si)
}
```

---

## 📤 Updated Response Format

### Önceki Format ❌
```typescript
{
  items: [
    {
      id: string;
      title: string;
      username: string;
      image: string;
    }
  ],
  pagination: { ... }
}
```

### Yeni Format ✅
```typescript
{
  items: [
    {
      id: string;
      title: string;
      username: string;
      image: string;
      description?: string;    // ← YENİ
      type: string;            // ← YENİ (örn: "Badge", "Cosmetic", "Lootbox")
      rarity: string;          // ← YENİ (örn: "Common", "Rare", "Epic")
    }
  ],
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  }
}
```

---

## 📋 Örnek Response

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Golden Achievement Badge",
      "username": "omerfaruk",
      "image": "https://storage.tipbox.co/nfts/golden-badge.png",
      "description": "Awarded for completing 100 expert reviews",
      "type": "Badge",
      "rarity": "Epic"
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "title": "Rare Cosmetic Item",
      "username": "omerfaruk",
      "image": "https://storage.tipbox.co/nfts/rare-cosmetic.png",
      "description": "Limited edition winter cosmetic",
      "type": "Cosmetic",
      "rarity": "Rare"
    },
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "title": "Mystery Lootbox",
      "username": "omerfaruk",
      "image": "https://storage.tipbox.co/nfts/lootbox.png",
      "type": "Lootbox",
      "rarity": "Common"
    }
  ],
  "pagination": {
    "cursor": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "hasMore": false,
    "limit": 50
  }
}
```

---

## 🔧 NFT Type Values

```typescript
type NFTType = 
  | "Badge"      // Başarı rozetleri
  | "Cosmetic"   // Kozmetik itemler
  | "Lootbox"    // Ödül kutuları
```

---

## 🎨 NFT Rarity Values

```typescript
type NFTRarity = 
  | "Common"     // Yaygın
  | "Rare"       // Nadir
  | "Epic"       // Epik
  | "Legendary"  // Efsanevi
```

---

## 🚀 Frontend Kullanımı

### Basic Fetch
```typescript
const response = await fetch('/marketplace/my-nfts', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log('My NFTs:', data.items);
```

### Filtreleme Örneği (Frontend)
```typescript
// Type'a göre filtreleme
const badges = nfts.items.filter(nft => nft.type === 'Badge');
const cosmetics = nfts.items.filter(nft => nft.type === 'Cosmetic');

// Rarity'e göre filtreleme
const epicNFTs = nfts.items.filter(nft => nft.rarity === 'Epic');
const rareNFTs = nfts.items.filter(nft => nft.rarity === 'Rare');

// Birden fazla filtre
const epicBadges = nfts.items.filter(
  nft => nft.type === 'Badge' && nft.rarity === 'Epic'
);
```

### React Component Örneği
```tsx
function MyNFTsList() {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  
  const { data } = useQuery(['myNFTs'], fetchMyNFTs);
  
  const filteredNFTs = useMemo(() => {
    if (!data?.items) return [];
    
    return data.items.filter(nft => {
      const typeMatch = selectedType === 'all' || nft.type === selectedType;
      const rarityMatch = selectedRarity === 'all' || nft.rarity === selectedRarity;
      return typeMatch && rarityMatch;
    });
  }, [data, selectedType, selectedRarity]);
  
  return (
    <div>
      {/* Filter Controls */}
      <select onChange={(e) => setSelectedType(e.target.value)}>
        <option value="all">All Types</option>
        <option value="Badge">Badges</option>
        <option value="Cosmetic">Cosmetics</option>
        <option value="Lootbox">Lootboxes</option>
      </select>
      
      <select onChange={(e) => setSelectedRarity(e.target.value)}>
        <option value="all">All Rarities</option>
        <option value="Common">Common</option>
        <option value="Rare">Rare</option>
        <option value="Epic">Epic</option>
        <option value="Legendary">Legendary</option>
      </select>
      
      {/* NFT Grid */}
      <div className="nft-grid">
        {filteredNFTs.map(nft => (
          <NFTCard key={nft.id} nft={nft} />
        ))}
      </div>
    </div>
  );
}
```

---

## 🧪 Test

```bash
# Basic test
curl http://localhost:5001/marketplace/my-nfts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# With pagination
curl "http://localhost:5001/marketplace/my-nfts?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📁 Güncellenen Dosyalar

1. ✅ `src/interfaces/marketplace/marketplace.dto.ts`
   - `UserNFTResponse` interface'ine `description`, `type`, `rarity` eklendi

2. ✅ `src/application/marketplace/marketplace.service.ts`
   - `listUserNFTs` metodunda response mapping güncellendi
   - `nft.getTypeDisplayName()` ve `nft.getRarityDisplayName()` kullanıldı

3. ✅ `src/interfaces/marketplace/marketplace.router.ts`
   - Swagger dokümantasyonu güncellendi
   - Response schema'ya yeni alanlar eklendi

---

## 🎯 Use Cases

### 1. NFT Gallery with Filters
```typescript
// Rarity bazlı renk kodlaması
const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'Common': return 'gray';
    case 'Rare': return 'blue';
    case 'Epic': return 'purple';
    case 'Legendary': return 'gold';
    default: return 'gray';
  }
};
```

### 2. Type-based Sections
```typescript
// NFT'leri type'a göre gruplama
const groupedNFTs = {
  badges: nfts.filter(n => n.type === 'Badge'),
  cosmetics: nfts.filter(n => n.type === 'Cosmetic'),
  lootboxes: nfts.filter(n => n.type === 'Lootbox'),
};
```

### 3. Rarity-based Sorting
```typescript
const rarityOrder = { Common: 1, Rare: 2, Epic: 3, Legendary: 4 };

const sortedByRarity = [...nfts].sort((a, b) => 
  rarityOrder[b.rarity] - rarityOrder[a.rarity]
);
```

---

## ✨ Benefits

- ✅ **Filtering**: Frontend artık type ve rarity'e göre filtreleme yapabilir
- ✅ **Sorting**: Rarity bazlı sıralama mümkün
- ✅ **Grouping**: Type'a göre gruplama yapılabilir
- ✅ **UI Enhancement**: Rarity'e göre görsel efektler eklenebilir
- ✅ **Better UX**: Kullanıcılar NFT'lerini daha kolay organize edebilir

---

## 📊 Backend Implementation Details

### Entity Methods
```typescript
// NFT Entity (nft.entity.ts)
class NFT {
  getTypeDisplayName(): string {
    // BADGE -> "Badge"
    // COSMETIC -> "Cosmetic"
    // LOOTBOX -> "Lootbox"
  }
  
  getRarityDisplayName(): string {
    // COMMON -> "Common"
    // RARE -> "Rare"
    // EPIC -> "Epic"
    // LEGENDARY -> "Legendary"
  }
}
```

### Service Logic
```typescript
const results = paginated.map(nft => ({
  id: nft.id,
  title: nft.name,
  username,
  image: nft.imageUrl,
  description: nft.description || undefined,
  type: nft.getTypeDisplayName(),
  rarity: nft.getRarityDisplayName(),
}));
```

---

## ⚠️ Breaking Changes

**YOK** - Response'a yeni alanlar eklendi, mevcut alanlar değişmedi. Backward compatible.

---

## 🚀 Deployment Notes

- **Migration**: Gerekli değil
- **Database**: Değişiklik yok
- **Backward Compatibility**: ✅ Evet
- **Frontend Update Required**: Hayır (opsiyonel filtreleme için önerilir)

---

## 📝 Changelog

### [v1.1.0] - 2026-01-12

#### Added
- `description` field to UserNFTResponse
- `type` field to UserNFTResponse (Badge, Cosmetic, Lootbox)
- `rarity` field to UserNFTResponse (Common, Rare, Epic, Legendary)
- Updated Swagger documentation

#### Changed
- Enhanced `/marketplace/my-nfts` response structure

---

## 🔗 Related Endpoints

- `GET /marketplace/listings` - Satışta olan NFT'leri listele
- `POST /marketplace/listings` - NFT'yi satışa koy
- `GET /marketplace/listings/:id` - Listing detayı

Frontend artık NFT'leri type ve rarity'e göre filtreleyip gruplayabilir! 🎉
