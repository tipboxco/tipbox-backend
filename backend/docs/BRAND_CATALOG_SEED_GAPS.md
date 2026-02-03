# Brand Catalog EP'leri - Eksik Seed Verileri

Bu dosya, Brand Catalog endpoint'lerinin tam çalışabilmesi için oluşturulması gereken eksik seed verilerini listeler.

> **Not:** Brand'ler seed aşamasında oluşturulmaz - database'de önceden mevcut olan brand'ler kullanılır.
> Tüm seed fonksiyonları mevcut brand'leri sorgulayarak çalışır.

---

## Hedef Brand'ler

Seed verileri **tüm brand'ler için değil**, sadece **en çok ürünü olan 5 brand** için oluşturulacaktır:

```typescript
// En çok ürünü olan 5 brand'i bul
const topBrands = await prisma.brand.findMany({
  include: {
    _count: {
      select: { products: true }
    }
  },
  orderBy: {
    products: {
      _count: 'desc'
    }
  },
  take: 5
});
```

---

## Mevcut Seed Verileri (Oluşturuluyor)

| Tablo | Durum | Açıklama |
|-------|-------|----------|
| `Brand` | ⚠️ Önceden Mevcut | Database'de önceden ekleniyor (seed'de oluşturulmaz) |
| `BrandCategory` | ⚠️ Önceden Mevcut | Database'de önceden ekleniyor |
| `Product` | ✅ Var | Brand'lere ait ürünler |
| `WishboxEvent` | ✅ Var | Event'ler oluşturuluyor |
| `ContentPost` | ✅ Var | Ürünlere ait post'lar |

---

## Eksik Seed Verileri

### Yüksek Öncelikli

#### 1. `BridgeFollower` - Brand Takipçileri
**Etkilenen Endpoint'ler:**
- `GET /brands/:brandId/catalog` (followers count, isJoined)

**Öneri:**
- En çok ürünü olan 5 brand için 5-15 rastgele takipçi oluştur
- Test kullanıcılarının bu brand'ları takip etmesi

**Örnek Seed Fonksiyonu:**
```typescript
async function seedBridgeFollowers(prisma: PrismaClient): Promise<void> {
  // En çok ürünü olan 5 brand'i bul (database'den)
  const topBrands = await prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { products: { _count: 'desc' } },
    take: 5
  });
  
  if (topBrands.length === 0) {
    console.warn('⚠️  Database\'de brand bulunamadı, atlanıyor...');
    return;
  }
  
  const users = await prisma.user.findMany({ take: 40 });
  
  for (const brand of topBrands) {
    const followerCount = Math.floor(Math.random() * 10) + 5; // 5-15 takipçi
    const randomUsers = users.sort(() => Math.random() - 0.5).slice(0, followerCount);
    
    for (const user of randomUsers) {
      await prisma.bridgeFollower.upsert({
        where: { userId_brandId: { userId: user.id, brandId: brand.id } },
        update: {},
        create: { userId: user.id, brandId: brand.id }
      });
    }
  }
  
  console.log(`✅ ${topBrands.length} brand için takipçi verileri oluşturuldu`);
}
```

---

#### 2. `BrandSurvey`, `BrandSurveyQuestion`, `BrandSurveyAnswer` - Anket Sistemi
**Etkilenen Endpoint'ler:**
- `GET /brands/:brandId/surveys`
- `GET /brands/:brandId/history/surveys`
- `GET /brands/:brandId/stats` (survey participation)

**Öneri:**
- En çok ürünü olan 5 brand için 2-3 aktif survey
- Her survey için 3-5 soru
- Test kullanıcıları için bazı cevaplar

**Örnek Seed Fonksiyonu:**
```typescript
async function seedBrandSurveys(prisma: PrismaClient): Promise<void> {
  // En çok ürünü olan 5 brand'i bul (database'den)
  const topBrands = await prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { products: { _count: 'desc' } },
    take: 5
  });
  
  if (topBrands.length === 0) {
    console.warn('⚠️  Database\'de brand bulunamadı, atlanıyor...');
    return;
  }
  
  const surveyTemplates = [
    { title: 'Ürün Deneyimi Anketi', questions: ['Ürünü ne sıklıkla kullanıyorsunuz?', 'Memnuniyet puanınız?', 'Tavsiye eder misiniz?'] },
    { title: 'Yeni Ürün Tercihleri', questions: ['Hangi özellikleri tercih edersiniz?', 'Fiyat aralığı beklentiniz?'] },
  ];
  
  const users = await prisma.user.findMany({ take: 10 });
  
  for (const brand of topBrands) {
    for (const template of surveyTemplates) {
      // Survey oluştur
      const survey = await prisma.brandSurvey.create({
        data: {
          brandId: brand.id,
          title: `${brand.name} - ${template.title}`,
          description: `${brand.name} markası için ${template.title.toLowerCase()}`,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün sonra
        }
      });
      
      // Sorular oluştur
      for (const questionText of template.questions) {
        const question = await prisma.brandSurveyQuestion.create({
          data: {
            surveyId: survey.id,
            questionText,
            type: 'TEXT', // veya MULTIPLE_CHOICE, RATING vb.
          }
        });
        
        // Bazı kullanıcılar için cevaplar
        const answeringUsers = users.slice(0, 3);
        for (const user of answeringUsers) {
          await prisma.brandSurveyAnswer.create({
            data: {
              questionId: question.id,
              userId: user.id,
              answerText: 'Örnek cevap metni',
            }
          }).catch(() => {}); // Duplicate'leri atla
        }
      }
    }
  }
  
  console.log(`✅ ${topBrands.length} brand için survey verileri oluşturuldu`);
}
```

---

#### 3. `BridgePost` - Brand Paylaşımları
**Etkilenen Endpoint'ler:**
- `GET /brands/:brandId/history/feed`
- `GET /brands/:brandId/stats` (shares count)

**Öneri:**
- En çok ürünü olan 5 brand için 10-20 bridge post
- Farklı kullanıcılardan paylaşımlar

**Örnek Seed Fonksiyonu:**
```typescript
async function seedBridgePosts(prisma: PrismaClient): Promise<void> {
  const topBrands = await prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { products: { _count: 'desc' } },
    take: 5
  });
  
  if (topBrands.length === 0) return;
  
  const users = await prisma.user.findMany({ take: 20 });
  
  for (const brand of topBrands) {
    const postCount = Math.floor(Math.random() * 10) + 10; // 10-20 post
    
    for (let i = 0; i < postCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      await prisma.bridgePost.create({
        data: {
          id: generateUlid(), // ULID generator kullan
          brandId: brand.id,
          userId: randomUser.id,
          content: `${brand.name} hakkında harika bir deneyim paylaşımı #${i + 1}`,
        }
      });
    }
  }
  
  console.log(`✅ ${topBrands.length} brand için bridge post'lar oluşturuldu`);
}
```

---

#### 4. `BridgeReward` - Brand Ödülleri
**Etkilenen Endpoint'ler:**
- `GET /brands/:brandId/history` (badgeList, totalPoints)
- `GET /brands/:brandId/history/points`
- `GET /brands/:brandId/stats` (totalPoints)

**Öneri:**
- En çok ürünü olan 5 brand için kullanıcı reward'ları
- Badge kazanım geçmişi
- Puan kazanım işlemleri

**Örnek Seed Fonksiyonu:**
```typescript
async function seedBridgeRewards(prisma: PrismaClient): Promise<void> {
  const topBrands = await prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { products: { _count: 'desc' } },
    take: 5
  });
  
  if (topBrands.length === 0) return;
  
  const users = await prisma.user.findMany({ take: 15 });
  const badges = await prisma.badge.findMany({ where: { type: 'BRAND' }, take: 6 });
  
  for (const brand of topBrands) {
    // Her brand için 5-10 kullanıcıya reward ver
    const rewardCount = Math.floor(Math.random() * 5) + 5;
    const selectedUsers = users.sort(() => Math.random() - 0.5).slice(0, rewardCount);
    
    for (const user of selectedUsers) {
      const randomBadge = badges[Math.floor(Math.random() * badges.length)];
      const points = Math.floor(Math.random() * 100) + 10; // 10-110 puan
      
      await prisma.bridgeReward.create({
        data: {
          userId: user.id,
          brandId: brand.id,
          badgeId: randomBadge?.id || null,
          points,
          reason: 'Brand aktivite ödülü',
        }
      }).catch(() => {});
    }
  }
  
  console.log(`✅ ${topBrands.length} brand için reward verileri oluşturuldu`);
}
```

---

### Orta Öncelikli

#### 5. `WishboxStats` - Event Katılım Verileri
**Etkilenen Endpoint'ler:**
- `GET /brands/:brandId/events` (status: joined/join)
- `GET /brands/events/:eventId` (statistics)

**Durum:** Kısmen mevcut, kullanıcı katılım verileri eksik olabilir

**Öneri:**
- En çok ürünü olan 5 brand'e ait event'ler için 5-20 kullanıcı katılımı
- Farklı post sayıları ve durumlar

---

#### 6. `News` - Brand Haberleri
**Etkilenen Endpoint'ler:**
- `GET /brands/:brandId/products/:productId/news`
- `GET /brands/:brandId/products/:productId/news/:newsId`

**Öneri:**
- En çok ürünü olan 5 brand için 3-5 haber
- Product ilişkilendirmesi
- Farklı kategorilerde haberler

**Örnek Seed Fonksiyonu:**
```typescript
async function seedBrandNews(prisma: PrismaClient): Promise<void> {
  const topBrands = await prisma.brand.findMany({
    include: { 
      _count: { select: { products: true } },
      products: { take: 3 } // Her brand için ilk 3 ürün
    },
    orderBy: { products: { _count: 'desc' } },
    take: 5
  });
  
  if (topBrands.length === 0) return;
  
  const newsTemplates = [
    { title: 'Yeni Ürün Lansmanı', category: 'LAUNCH' },
    { title: 'Kampanya Duyurusu', category: 'PROMOTION' },
    { title: 'Teknoloji Haberleri', category: 'TECHNOLOGY' },
  ];
  
  for (const brand of topBrands) {
    for (const template of newsTemplates) {
      await prisma.news.create({
        data: {
          title: `${brand.name} - ${template.title}`,
          content: `${brand.name} markasından ${template.title.toLowerCase()} haberi...`,
          brandId: brand.id,
          imageUrl: null,
          publishedAt: new Date(),
        }
      });
    }
  }
  
  console.log(`✅ ${topBrands.length} brand için news verileri oluşturuldu`);
}
```

---

### Düşük Öncelikli

#### 7. `BridgeLeaderboard` - Liderlik Tablosu
**Etkilenen Endpoint'ler:** Brand history ile ilgili olabilir

**Öneri:**
- En çok ürünü olan 5 brand için leaderboard verileri
- Haftalık/aylık dönemler

---

#### 8. `BridgeUserStats` - Kullanıcı-Brand İstatistikleri
**Etkilenen Endpoint'ler:** Brand stats ile ilgili olabilir

**Öneri:**
- En çok ürünü olan 5 brand için kullanıcı-brand istatistikleri

---

## Endpoint - Tablo İlişki Matrisi

| Endpoint | BridgeFollower | BrandSurvey | BridgePost | BridgeReward | WishboxStats | News |
|----------|----------------|-------------|------------|--------------|--------------|------|
| `/brands/:id/catalog` | ✅ | - | - | - | - | - |
| `/brands/:id/surveys` | - | ✅ | - | - | - | - |
| `/brands/:id/history` | - | - | ✅ | ✅ | - | - |
| `/brands/:id/history/surveys` | - | ✅ | - | - | - | - |
| `/brands/:id/history/feed` | - | - | ✅ | - | - | - |
| `/brands/:id/history/points` | - | - | - | ✅ | - | - |
| `/brands/:id/history/events` | - | - | - | - | ✅ | - |
| `/brands/:id/stats` | - | ✅ | ✅ | ✅ | ✅ | - |
| `/brands/:id/events` | - | - | - | - | ✅ | - |
| `/brands/events/:id` | - | - | - | - | ✅ | - |
| `/brands/:id/products/:id/news` | - | - | - | - | - | ✅ |

---

## Önerilen Seed Fonksiyonları

> **Önemli:** Tüm fonksiyonlar database'deki mevcut brand'leri sorgular.
> Brand oluşturma işlemi bu seed'in kapsamı dışındadır.

### Helper: Top 5 Brand'i Bul
```typescript
async function getTopBrandsByProductCount(prisma: PrismaClient, limit = 5) {
  const brands = await prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { products: { _count: 'desc' } },
    take: limit
  });
  
  if (brands.length === 0) {
    console.warn('⚠️  Database\'de brand bulunamadı!');
  }
  
  return brands;
}
```

### 1. seedBridgeFollowers()
- Top 5 brand için 5-15 rastgele takipçi

### 2. seedBrandSurveys()
- Top 5 brand için 2-3 survey
- Her survey için 3-5 soru
- Rastgele kullanıcı cevapları

### 3. seedBridgePosts()
- Top 5 brand için 10-20 paylaşım

### 4. seedBridgeRewards()
- Top 5 brand için kullanıcı-brand reward ilişkileri
- Badge kazanımları

### 5. seedBrandNews()
- Top 5 brand için 3-5 haber

### 6. seedWishboxStats() (Güncelleme)
- Top 5 brand'e ait event'ler için katılım verilerini genişlet

---

## Ana Seed Fonksiyonu

```typescript
async function seedBrandCatalogData(prisma: PrismaClient): Promise<void> {
  console.log('\n📦 Brand Catalog Seed Verileri Oluşturuluyor...\n');
  
  // Database'deki mevcut brand'leri kontrol et
  const topBrands = await getTopBrandsByProductCount(prisma, 5);
  
  if (topBrands.length === 0) {
    console.error('❌ Database\'de brand bulunamadı! Brand Catalog seed atlanıyor.');
    return;
  }
  
  console.log(`📊 En çok ürünü olan ${topBrands.length} brand bulundu:`);
  topBrands.forEach((b, i) => {
    console.log(`   ${i + 1}. ${b.name} (${b._count.products} ürün)`);
  });
  
  // Seed fonksiyonlarını çalıştır
  await seedBridgeFollowers(prisma);
  await seedBrandSurveys(prisma);
  await seedBridgePosts(prisma);
  await seedBridgeRewards(prisma);
  await seedBrandNews(prisma);
  
  console.log('\n✅ Brand Catalog seed verileri tamamlandı!\n');
}
```

---

## Uygulama Öncelik Sırası

1. **Faz 1 (Kritik):**
   - `seedBridgeFollowers()` - Catalog sayfası için gerekli
   - `seedBrandSurveys()` - Survey akışı için gerekli

2. **Faz 2 (Önemli):**
   - `seedBridgeRewards()` - Points/history için gerekli
   - `seedBridgePosts()` - Feed history için gerekli

3. **Faz 3 (Tamamlayıcı):**
   - `seedBrandNews()` - News akışı için
   - WishboxStats güncellemesi - Event katılımları

---

## Test Senaryoları

Seed verileri eklendikten sonra test edilmesi gereken senaryolar (Top 5 brand için):

1. **Brand Catalog Sayfası:**
   - Brand detayı görüntüleme
   - Takipçi sayısı gösterimi
   - isJoined durumu kontrolü

2. **Survey Akışı:**
   - Aktif survey listeleme
   - Soru-cevap akışı
   - Survey tamamlama

3. **History Sayfası:**
   - Points geçmişi
   - Survey geçmişi
   - Feed geçmişi
   - Event geçmişi

4. **Stats:**
   - Toplam puan
   - Paylaşım sayısı
   - Survey katılım oranı

---

## Ön Koşullar

Bu seed fonksiyonlarının çalışabilmesi için:

1. ✅ Database'de brand'ler önceden mevcut olmalı
2. ✅ Brand'lere ait product'lar olmalı (sıralama için)
3. ✅ Kullanıcılar oluşturulmuş olmalı
4. ✅ Badge'ler (BRAND tipi) oluşturulmuş olmalı

---

*Bu dosya otomatik olarak oluşturulmuştur. Güncellemeler için seed.ts dosyasını kontrol edin.*
