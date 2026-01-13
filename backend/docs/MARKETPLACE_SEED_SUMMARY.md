# Marketplace Seed Data - Etkilenen Tablolar

Son eklenen marketplace seed dataları aşağıdaki tablolara veri ekler:

## 1. **users** Tablosu
- **1 yeni kullanıcı** oluşturuldu:
  - ID: `248cc91f-b551-4ecc-a885-db1163571330`
  - Email: `markettest@tipbox.co`
  - Status: `ACTIVE`
  - EmailVerified: `true`

## 2. **profiles** Tablosu
- **1 profil** oluşturuldu/güncellendi:
  - userId: `248cc91f-b551-4ecc-a885-db1163571330`
  - displayName: `Market Test User`
  - userName: `markettest`
  - bio: `Aktif bir NFT koleksiyoneri ve trader`
  - country: `Turkey`

## 3. **user_avatars** Tablosu
- **1 avatar** oluşturuldu:
  - userId: `248cc91f-b551-4ecc-a885-db1163571330`
  - imageUrl: `https://cdn.tipbox.co/avatars/market-test.jpg`
  - isActive: `true`

## 4. **nfts** Tablosu
**Toplam ~25+ NFT** oluşturuldu:

### Belirtilen Kullanıcı İçin (248cc91f-b551-4ecc-a885-db1163571330):
- **4 NFT sahip** (currentOwnerId = TARGET_USER_ID, satışta değil):
  1. Tipbox Pioneer Badge (EPIC)
  2. Diamond Profile Frame (EPIC)
  3. Top Contributor Badge (RARE)
  4. Neon Pulse Avatar Border (RARE)

- **6 NFT satışta** (currentOwnerId = null, listing'li):
  1. Gold Star Badge (RARE)
  2. Platinum Crown Frame (EPIC)
  3. Rainbow Holographic Badge (EPIC)
  4. Cyber Neon Glow Effect (RARE)
  5. Mystery Treasure Box (EPIC)
  6. Silver Achievement Badge (COMMON)

### Test Kullanıcısı İçin (Ömer Faruk):
- Mevcut NFT'ler korundu (Premium Tipbox Badge, Early Adopter Badge, Golden Frame, vs.)

### Diğer Kullanıcılar İçin:
- **3 kullanıcı için toplam 9 NFT**:
  - Her kullanıcı için 3'er NFT (Collector Badge, Vintage Frame, Lucky Box)
  - Farklı rarity'ler (EPIC, RARE, COMMON)

## 5. **nft_market_listings** Tablosu
**Toplam ~15+ listing** oluşturuldu:

### Belirtilen Kullanıcı İçin:
- **6 aktif listing**:
  1. Gold Star Badge - 125 TIPS
  2. Platinum Crown Frame - 850 TIPS
  3. Rainbow Holographic Badge - 750 TIPS
  4. Cyber Neon Glow Effect - 425 TIPS
  5. Mystery Treasure Box - 1500 TIPS
  6. Silver Achievement Badge - 35 TIPS

### Diğer Kullanıcılar İçin:
- **~9 listing** (Vintage Frame ve Lucky Box NFT'leri için)
- Fiyatlar: 50-300 TIPS aralığında

### Test Kullanıcısı İçin:
- Mevcut listing'ler korundu

## 6. **nft_transactions** Tablosu
**Tüm NFT'ler için mint transaction'ları** oluşturuldu:
- **~25+ transaction** (MINT tipinde)
- Her NFT için bir transaction
- fromUserId: `null` (mint işlemi)
- toUserId: NFT'nin sahibi
- price: `null`

## 7. **nft_attributes** Tablosu
**~20+ NFT için attribute'lar** oluşturuldu:

### Oluşturulan Attribute Türleri:
1. **edition** - Edition bilgisi
   - EPIC: `Limited Edition X/100`
   - RARE: `Edition X/500`
   - COMMON: `Edition X/1000`

2. **special_feature** - Özel özellik
   - Değer: `Animated` (her 3 NFT'de bir)

3. **exclusive** - Özel NFT işareti
   - Değer: `true` (EPIC NFT'lerde, her 4'te bir)

4. **year** - Yıl bilgisi
   - Değer: `2024` (her 5 NFT'de bir)

## Özet İstatistikler

| Tablo | Yeni Kayıt Sayısı | Açıklama |
|-------|-------------------|----------|
| users | 1 | Target kullanıcı |
| profiles | 1 | Target kullanıcı profili |
| user_avatars | 1 | Target kullanıcı avatarı |
| nfts | ~25+ | Çeşitli NFT'ler |
| nft_market_listings | ~15+ | Aktif satış listing'leri |
| nft_transactions | ~25+ | Mint transaction'ları |
| nft_attributes | ~20+ | NFT özellikleri |

## İlişkiler

- **users** → **profiles** (1:1)
- **users** → **user_avatars** (1:N)
- **users** → **nfts** (1:N, currentOwnerId ile)
- **nfts** → **nft_market_listings** (1:N)
- **nfts** → **nft_transactions** (1:N)
- **nfts** → **nft_attributes** (1:N)

## Test Senaryoları

Bu seed verileri ile test edilebilecek endpoint'ler:

1. `GET /marketplace/listings` - Tüm listing'leri görüntüle
2. `GET /marketplace/my-nfts` - Target kullanıcının 4 sahip NFT'sini görüntüle
3. `GET /marketplace/listings?type=BADGE` - BADGE tipinde filtrele
4. `GET /marketplace/listings?rarity=EPIC` - EPIC rarity filtrele
5. `GET /marketplace/listings?minPrice=100&maxPrice=500` - Fiyat aralığı filtrele
6. `GET /marketplace/listings?search=badge` - Arama yap
7. `POST /marketplace/listings` - Yeni listing oluştur
8. `PUT /marketplace/listings/:id/price` - Fiyat güncelle
9. `DELETE /marketplace/listings/:id` - Listing iptal et

