/**
 * Kapsamlı Feed Test Senaryosu
 * 
 * 10 kullanıcı için feed scoring sisteminin tüm özelliklerini test eder:
 * - Trust ilişkileri (mutual, one-way)
 * - Inventory match
 * - Boost edilmiş gönderiler
 * - Category match
 * - Trending post (yüksek engagement)
 * - Negatif testler
 * 
 * Her gönderi için hangi kullanıcılarda görünür/görünmez bilgisi içerir
 * ve test sonunda detaylı analiz raporu üretir.
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { getAuthToken } from '../helpers/auth-helper';
import { ContextType } from '../../src/domain/content/context-type.enum';
import { TipsAndTricksBenefitCategory } from '../../src/domain/content/tips-and-tricks-benefit-category.enum';

const BASE_URL = 'http://localhost:3000';
// PrismaClient singleton kullan (connection pool için)
// @ts-ignore - global type tanımı yok
const prisma: PrismaClient = global.prisma || (global.prisma = new PrismaClient());
const DEFAULT_PASSWORD = 'password123';

// Seed'den gelen kullanıcı email'leri
const USER_EMAILS = {
  OMER: 'omer@tipbox.co',
  TRUST_USER_1: 'trust-user-0@tipbox.co',
  TRUST_USER_2: 'trust-user-1@tipbox.co',
  TRUST_USER_3: 'trust-user-2@tipbox.co',
  TRUST_USER_4: 'trust-user-3@tipbox.co',
  TRUSTER_USER_1: 'truster-user-0@tipbox.co',
  TRUSTER_USER_2: 'truster-user-1@tipbox.co',
  JULIA: 'julia.havk@tipbox.co',
  TARGET_USER: 'markettest@tipbox.co',
  COMMUNITY_COACH: 'coach@tipbox.co',
};

// Test görselleri klasörü
const PRODUCT_IMAGES_DIR = path.join(__dirname, '../assets/product');

// Helper: Test görseli buffer'ını al
function getTestImageBuffer(imagePath: string): Buffer {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Test görseli bulunamadı: ${imagePath}`);
  }
  return fs.readFileSync(imagePath);
}

// Helper: Rastgele görsel seç
function getRandomProductImage(): string {
  const images = [
    'phone1.png', 'phone2.png', 'phone3.png', 'phone4.png', 'phone5.png', 'phone6.png',
    'electronic-post-1.jpg', 'electronic-post-2.jpg', 'electronic-post-3.jpg',
    'makeup-post-1.jpg', 'makeup-post-2.jpg', 'makeup-post-3.jpg',
    'headphone.png', 'smartwatch.png', 'macbook.png', 'dyson.png',
  ];
  const randomImage = images[Math.floor(Math.random() * images.length)];
  return path.join(PRODUCT_IMAGES_DIR, randomImage);
}

interface UserData {
  email: string;
  token: string;
  userId: string;
}

interface PostData {
  id: string;
  author: string;
  type: string;
  description: string;
  expectedInFeeds: string[];
  expectedNotInFeeds: string[];
  expectedSource?: string;
  expectedMinScore?: number;
}

interface FeedAnalysis {
  postId: string;
  author: string;
  type: string;
  feedsCreated: {
    userId: string;
    userEmail: string;
    source: string;
    score: number;
    success: boolean;
  }[];
  success: boolean;
  message: string;
}

describe('Kapsamlı Feed Test Senaryosu', () => {
  // Kullanıcı verileri
  const users: Record<string, UserData> = {};
  
  // Test verileri
  let phoneProductId: string; // Ömer ve Julia'nın paylaştığı telefon
  let otherProductId: string; // Target User'ın ürünü
  let productGroupId: string;
  let subCategoryId: string;
  let differentCategoryProductId: string; // Truster User 2 için farklı category
  let boostOptionId: string;
  let experienceOptions: {
    durations: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
    purposes: Array<{ id: string; name: string }>;
  };
  
  const createdPostIds: string[] = [];
  const createdFeedIds: string[] = [];
  const posts: PostData[] = [];
  const feedAnalysis: FeedAnalysis[] = [];

  beforeAll(async () => {
    console.log('\n🔧 Test ortamı hazırlanıyor...\n');

    // 1. Tüm kullanıcılar için auth token'ları al
    console.log('🔐 Auth token\'ları alınıyor...');
    for (const [key, email] of Object.entries(USER_EMAILS)) {
      try {
        const auth = await getAuthToken(email, DEFAULT_PASSWORD);
        users[key] = {
          email,
          token: auth.token,
          userId: auth.userId,
        };
        console.log(`✅ ${key}: ${email} (${auth.userId})`);
      } catch (error) {
        console.error(`❌ ${key} auth hatası: ${error}`);
        throw error;
      }
    }

    // 2. Product ve category ID'lerini belirle
    console.log('\n📦 Product ve category ID\'leri belirleniyor...');
    
    // Telefon ürünü (Ömer ve Julia için)
    const phoneProduct = await prisma.product.findFirst({
      where: {
        name: { contains: 'iPhone', mode: 'insensitive' },
      },
      include: {
        group: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
      },
    });

    if (!phoneProduct) {
      throw new Error('Telefon ürünü bulunamadı');
    }
    phoneProductId = phoneProduct.id;
    productGroupId = phoneProduct.groupId || '';
    subCategoryId = phoneProduct.group?.subCategoryId || '';
    console.log(`✅ Phone Product: ${phoneProductId}`);
    console.log(`✅ Product Group: ${productGroupId}`);
    console.log(`✅ Sub Category: ${subCategoryId}`);

    // Farklı bir ürün (Target User için)
    const otherProduct = await prisma.product.findFirst({
      where: {
        id: { not: phoneProductId },
        group: {
          subCategory: {
            mainCategoryId: phoneProduct.group?.subCategory?.mainCategoryId,
          },
        },
      },
      include: {
        group: {
          include: {
            subCategory: true,
          },
        },
      },
    });

    if (!otherProduct) {
      throw new Error('Farklı ürün bulunamadı');
    }
    otherProductId = otherProduct.id;
    console.log(`✅ Other Product: ${otherProductId}`);

    // Farklı category ürünü (Truster User 2 için)
    const differentCategoryProduct = await prisma.product.findFirst({
      where: {
        group: {
          subCategory: {
            mainCategoryId: { not: phoneProduct.group?.subCategory?.mainCategoryId },
          },
        },
      },
      include: {
        group: {
          include: {
            subCategory: true,
          },
        },
      },
    });

    if (differentCategoryProduct) {
      differentCategoryProductId = differentCategoryProduct.id;
      console.log(`✅ Different Category Product: ${differentCategoryProductId}`);
    }

    // 3. Boost option'ı al
    console.log('\n🚀 Boost option\'ları alınıyor...');
    const boostResponse = await request(BASE_URL)
      .get('/posts/boost-options')
      .set('Authorization', `Bearer ${users.OMER.token}`);
    
    if (boostResponse.status === 200 && boostResponse.body.length > 0) {
      boostOptionId = boostResponse.body[0].id;
      console.log(`✅ Boost Option: ${boostOptionId}`);
    } else {
      console.log('⚠️  Boost option bulunamadı, question post\'lar için boost kullanılmayacak');
    }

    // 3.5. Experience options'ı al
    console.log('\n📋 Experience options\'ları alınıyor...');
    const expOptionsResponse = await request(BASE_URL)
      .get('/posts/experience/options')
      .set('Authorization', `Bearer ${users.OMER.token}`);
    
    if (expOptionsResponse.status === 200) {
      experienceOptions = expOptionsResponse.body;
      console.log(`✅ Experience Options: ${experienceOptions.durations.length} durations, ${experienceOptions.locations.length} locations, ${experienceOptions.purposes.length} purposes`);
    } else {
      console.log('⚠️  Experience options bulunamadı, experience post\'lar için varsayılan değerler kullanılacak');
      // Varsayılan değerler (DB'den alınabilir)
      experienceOptions = {
        durations: [],
        locations: [],
        purposes: [],
      };
    }

    // 4. Trust ilişkilerini kur/doğrula
    console.log('\n🤝 Trust ilişkileri kuruluyor...');
    
    // Ömer ↔ Trust User 1 (Mutual trust)
    await ensureTrustRelation(users.OMER.userId, users.TRUST_USER_1.userId);
    await ensureTrustRelation(users.TRUST_USER_1.userId, users.OMER.userId);
    console.log('✅ Ömer ↔ Trust User 1 (Mutual trust)');

    // Ömer → Trust User 2 (One-way)
    await ensureTrustRelation(users.OMER.userId, users.TRUST_USER_2.userId);
    console.log('✅ Ömer → Trust User 2 (One-way)');

    // Trust User 3 → Ömer (One-way)
    await ensureTrustRelation(users.TRUST_USER_3.userId, users.OMER.userId);
    console.log('✅ Trust User 3 → Ömer (One-way)');

    // 5. Inventory kayıtlarını kur/doğrula
    console.log('\n📦 Inventory kayıtları kuruluyor...');
    
    // Ömer'in envanterinde telefon
    await ensureInventory(users.OMER.userId, phoneProductId);
    console.log('✅ Ömer\'in envanterinde telefon var');

    // Julia'nın envanterinde telefon
    await ensureInventory(users.JULIA.userId, phoneProductId);
    console.log('✅ Julia\'nın envanterinde telefon var');

    // Target User'ın envanterinde farklı ürün
    await ensureInventory(users.TARGET_USER.userId, otherProductId);
    console.log('✅ Target User\'ın envanterinde farklı ürün var');

    console.log('\n✅ Test ortamı hazır!\n');
  }, 60000); // 60 saniye timeout

  afterAll(async () => {
    // Test sonrası temizlik KAPALI - OpenAPI üzerinden kontrol için veriler korunuyor
    console.log('\n📊 Test verileri korunuyor (OpenAPI kontrolü için)...');
    console.log(`   Oluşturulan Post ID'leri: ${createdPostIds.join(', ')}`);
    console.log(`   Oluşturulan Feed ID'leri: ${createdFeedIds.length} adet`);
    
    // Analiz raporunu yazdır
    console.log('\n📈 FEED ANALİZ RAPORU\n');
    console.log('='.repeat(80));
    feedAnalysis.forEach((analysis, index) => {
      console.log(`\n${index + 1}. Post: ${analysis.postId} (${analysis.type})`);
      console.log(`   Yazar: ${analysis.author}`);
      console.log(`   Durum: ${analysis.success ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}`);
      console.log(`   Mesaj: ${analysis.message}`);
      console.log(`   Feed Dağılımı:`);
      analysis.feedsCreated.forEach((feed) => {
        const status = feed.success ? '✅' : '❌';
        console.log(`     ${status} ${feed.userEmail}: Source=${feed.source}, Score=${feed.score}`);
      });
    });
    console.log('\n' + '='.repeat(80));
    
    // PrismaClient singleton kullanıldığı için disconnect etme (diğer testler için gerekli)
    // await prisma.$disconnect();
    console.log('\n✅ Test tamamlandı - Veriler korundu\n');
  });

  // Helper: Trust ilişkisi kur
  async function ensureTrustRelation(trusterId: string, trustedUserId: string): Promise<void> {
    const existing = await prisma.trustRelation.findUnique({
      where: {
        trusterId_trustedUserId: {
          trusterId: trusterId,
          trustedUserId: trustedUserId,
        },
      },
    });

    if (!existing) {
      await prisma.trustRelation.create({
        data: {
          trusterId: trusterId,
          trustedUserId: trustedUserId,
        },
      });
    }
  }

  // Helper: Inventory kaydı kur
  async function ensureInventory(userId: string, productId: string): Promise<void> {
    const existing = await prisma.inventory.findFirst({
      where: {
        userId,
        productId,
      },
    });

    if (!existing) {
      await prisma.inventory.create({
        data: {
          userId,
          productId,
          hasOwned: true,
          experienceSummary: 'Test için eklenen inventory kaydı',
        },
      });
    }
  }

  // Helper: Post oluştur (multipart/form-data ile görsel)
  async function createPost(
    userKey: string,
    endpoint: string,
    data: {
      contextType: ContextType;
      contextId: string;
      description?: string;
      content?: string; // UPDATE post için
      imagePath?: string;
      selectedBoostOptionId?: string;
      benefitCategory?: TipsAndTricksBenefitCategory;
      // EXPERIENCE post için
      selectedDurationId?: string;
      selectedLocationId?: string;
      selectedPurposeId?: string;
      experience?: Array<{ type: string; content: string; rating: number }>;
      status?: string;
      // BENCHMARK post için
      products?: Array<{ productId: string; isSelected: boolean }>;
    }
  ): Promise<string> {
    const user = users[userKey];
    if (!user) {
      throw new Error(`Kullanıcı bulunamadı: ${userKey}`);
    }

    const imagePath = data.imagePath || getRandomProductImage();
    const imageBuffer = getTestImageBuffer(imagePath);
    const imageFileName = path.basename(imagePath);

    // Tüm field'ları önce ekle (image'den önce)
    const req = request(BASE_URL)
      .post(endpoint)
      .set('Authorization', `Bearer ${user.token}`)
      .field('contextType', data.contextType)
      .field('contextId', data.contextId);

    // Description veya content
    if (data.description) {
      req.field('description', data.description);
    }
    if (data.content) {
      req.field('content', data.content);
    }

    // Boost option
    if (data.selectedBoostOptionId) {
      req.field('selectedBoostOptionId', data.selectedBoostOptionId);
    }

    // Benefit category - TIPS post için zorunlu
    if (data.benefitCategory !== undefined) {
      // Enum değerini string olarak gönder (örn: 'PERFORMANCE' -> 'performance')
      const benefitCategoryValue = String(data.benefitCategory);
      req.field('benefitCategory', benefitCategoryValue);
    }

    // Experience post fields
    if (data.selectedDurationId) {
      req.field('selectedDurationId', data.selectedDurationId);
    }
    if (data.selectedLocationId) {
      req.field('selectedLocationId', data.selectedLocationId);
    }
    if (data.selectedPurposeId) {
      req.field('selectedPurposeId', data.selectedPurposeId);
    }
    if (data.experience) {
      req.field('experience', JSON.stringify(data.experience));
    }
    if (data.status) {
      req.field('status', data.status);
    }

    // Benchmark post products - JSON string olarak gönder
    if (data.products) {
      req.field('products', JSON.stringify(data.products));
    }

    // Image - EN SON ekle
    if (imageBuffer) {
      req.attach('images', imageBuffer, imageFileName);
    }

    const response = await req;

    if (response.status !== 201) {
      throw new Error(`Post oluşturma hatası: ${response.status} - ${JSON.stringify(response.body)}`);
    }

    return response.body.id;
  }

  // Helper: Engagement ekle
  async function addEngagement(
    postId: string,
    userKeys: string[],
    type: 'like' | 'comment' | 'share',
    count: number
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      const userKey = userKeys[i % userKeys.length];
      const user = users[userKey];
      if (!user) continue;

      try {
        if (type === 'like') {
          await request(BASE_URL)
            .post(`/interactions/posts/${postId}/like`)
            .set('Authorization', `Bearer ${user.token}`);
        } else if (type === 'comment') {
          await request(BASE_URL)
            .post(`/interactions/posts/${postId}/comments`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({ content: `Test comment ${i + 1}` });
        } else if (type === 'share') {
          await request(BASE_URL)
            .post(`/interactions/posts/${postId}/share`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({ shareType: 'EXTERNAL_SHARE' });
        }
      } catch (error) {
        // Engagement ekleme hatası kritik değil, devam et
        console.warn(`⚠️  Engagement ekleme hatası (${type}): ${error}`);
      }
    }
  }

  // Helper: Trending post oluştur
  async function createTrendingPost(postId: string): Promise<void> {
    // Post'un engagement sayılarını güncelle
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
    });

    if (post) {
      // Trending table'a ekle (compound unique key: postId + trendPeriod)
      // ID için UUID kullan (VarChar(26) için ULID formatı)
      const trendingId = postId.substring(0, 22) + 'TRND'; // PostId'nin ilk 22 karakteri + 'TRND'
      await prisma.trendingPost.upsert({
        where: {
          postId_trendPeriod: {
            postId: postId,
            trendPeriod: 'DAILY',
          },
        },
        update: {
          score: 500, // Yüksek score
          calculatedAt: new Date(),
        },
        create: {
          id: trendingId,
          postId: postId,
          score: 500,
          trendPeriod: 'DAILY',
          calculatedAt: new Date(),
        },
      });
    }
  }

  // Test 1: Trust User 1 - FREE post (Mutual trust)
  test('1. Trust User 1 - FREE post (Mutual trust)', async () => {
    console.log('\n📝 Test 1: Trust User 1 FREE post oluşturuluyor...');
    
    const description = `Trust User 1 test postu - Mutual trust ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: Truster User 2`;
    
    const postId = await createPost('TRUST_USER_1', '/posts/free', {
      contextType: ContextType.PRODUCT,
      contextId: phoneProductId,
      description,
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Trust User 1',
      type: 'FREE',
      description,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: ['TRUSTER_USER_2'],
      expectedSource: 'MUTUAL_TRUST',
      expectedMinScore: 35,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 saniye bekle
  }, 30000);

  // Test 2: Trust User 2 - TIPS post (One-way trust + Boost)
  test('2. Trust User 2 - TIPS post (One-way trust + Boost)', async () => {
    console.log('\n📝 Test 2: Trust User 2 TIPS post oluşturuluyor...');
    
    const description = `Trust User 2 test postu - One-way trust ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: Truster User 2`;
    
    const postId = await createPost('TRUST_USER_2', '/posts/tips-and-tricks', {
      contextType: ContextType.PRODUCT,
      contextId: phoneProductId,
      description,
      benefitCategory: TipsAndTricksBenefitCategory.DURABILITY, // PERFORMANCE yok, DURABILITY kullan
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Trust User 2',
      type: 'TIPS',
      description,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: ['TRUSTER_USER_2'],
      expectedSource: 'TRUSTER',
      expectedMinScore: 40,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 3: Trust User 2 - QUESTION post (Boost)
  test('3. Trust User 2 - QUESTION post (Boost)', async () => {
    console.log('\n📝 Test 3: Trust User 2 QUESTION post oluşturuluyor...');
    
    if (!boostOptionId) {
      console.log('⚠️  Boost option yok, test atlanıyor');
      return;
    }

    const description = `Trust User 2 question postu - Boost ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: Truster User 2`;
    
    const postId = await createPost('TRUST_USER_2', '/posts/question', {
      contextType: ContextType.PRODUCT,
      contextId: phoneProductId,
      description,
      selectedBoostOptionId: boostOptionId,
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Trust User 2',
      type: 'QUESTION',
      description,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: ['TRUSTER_USER_2'],
      expectedSource: 'BOOSTED',
      expectedMinScore: 40,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 4: Trust User 3 - UPDATE post (One-way trust)
  test('4. Trust User 3 - UPDATE post (One-way trust)', async () => {
    console.log('\n📝 Test 4: Trust User 3 UPDATE post oluşturuluyor...');
    
    const content = `Trust User 3 update postu - One-way trust (Trust User 3 → Ömer) ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: Truster User 2`;
    
    const postId = await createPost('TRUST_USER_3', '/posts/update', {
      contextType: ContextType.PRODUCT,
      contextId: phoneProductId,
      content: content, // UPDATE post için content kullanılır
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Trust User 3',
      type: 'UPDATE',
      description: content,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: ['TRUSTER_USER_2'],
      expectedSource: 'TRUSTER_NETWORK', // AUTHOR_TRUSTS_USER için TRUSTER_NETWORK olabilir
      expectedMinScore: 30,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 5: Julia - EXPERIENCE post (Inventory match)
  test('5. Julia - EXPERIENCE post (Inventory match)', async () => {
    console.log('\n📝 Test 5: Julia EXPERIENCE post oluşturuluyor...');
    
    if (!experienceOptions || experienceOptions.durations.length === 0) {
      console.log('⚠️  Experience options yok, test atlanıyor');
      return;
    }

    const content = `Julia experience postu - Inventory match (aynı telefon) ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: Truster User 2`;
    
    const postId = await createPost('JULIA', '/posts/experience', {
      contextType: ContextType.PRODUCT,
      contextId: phoneProductId,
      content: content,
      selectedDurationId: experienceOptions.durations[0].id,
      selectedLocationId: experienceOptions.locations[0]?.id || '',
      selectedPurposeId: experienceOptions.purposes[0]?.id || '',
      experience: [
        {
          type: 'product_and_usage',
          content: 'Great product, very satisfied with the quality and performance.',
          rating: 5,
        },
      ],
      status: 'own',
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Julia',
      type: 'EXPERIENCE',
      description: content,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: ['TRUSTER_USER_2'],
      expectedSource: 'INVENTORY_MATCH',
      expectedMinScore: 30,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 6: Target User - COMPARE post (Inventory match + Boost)
  test('6. Target User - COMPARE post (Inventory match + Boost)', async () => {
    console.log('\n📝 Test 6: Target User COMPARE post oluşturuluyor...');
    
    const description = `Target User compare postu - Inventory match + Boost ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: Truster User 2`;
    
    // COMPARE post için /posts/benchmark endpoint'i kullanılmalı
    // En az 2 ürün seçilmeli
    const postId = await createPost('TARGET_USER', '/posts/benchmark', {
      contextType: ContextType.PRODUCT,
      contextId: otherProductId,
      description,
      products: [
        { productId: otherProductId, isSelected: true },
        { productId: phoneProductId, isSelected: true }, // En az 2 ürün seçilmeli (isSelected: true)
      ],
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Target User',
      type: 'COMPARE',
      description,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: ['TRUSTER_USER_2'],
      expectedSource: 'INVENTORY_MATCH',
      expectedMinScore: 30,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 7: Truster User 1 - FREE post (Category match)
  test('7. Truster User 1 - FREE post (Category match)', async () => {
    console.log('\n📝 Test 7: Truster User 1 FREE post oluşturuluyor...');
    
    const description = `Truster User 1 free postu - Category match ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: -`;
    
    const postId = await createPost('TRUSTER_USER_1', '/posts/free', {
      contextType: ContextType.PRODUCT_GROUP,
      contextId: productGroupId,
      description,
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Truster User 1',
      type: 'FREE',
      description,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: [],
      expectedSource: 'CATEGORY_MATCH',
      expectedMinScore: 15,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 8: Community Coach - TIPS post (Category match)
  test('8. Community Coach - TIPS post (Category match)', async () => {
    console.log('\n📝 Test 8: Community Coach TIPS post oluşturuluyor...');
    
    const description = `Community Coach tips postu - Category match ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: -`;
    
    const postId = await createPost('COMMUNITY_COACH', '/posts/tips-and-tricks', {
      contextType: ContextType.SUB_CATEGORY,
      contextId: subCategoryId,
      description,
      benefitCategory: TipsAndTricksBenefitCategory.TIME, // USABILITY yok, TIME kullan
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Community Coach',
      type: 'TIPS',
      description,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: [],
      expectedSource: 'CATEGORY_MATCH',
      expectedMinScore: 15,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 9: Trust User 4 - FREE post (Trending - High engagement)
  test('9. Trust User 4 - FREE post (Trending - High engagement)', async () => {
    console.log('\n📝 Test 9: Trust User 4 FREE post oluşturuluyor (Trending)...');
    
    const description = `Trust User 4 trending postu - Yüksek engagement ile Ömer feed'inde görünmeli. Expected to appear in: Ömer | Expected NOT to appear in: -`;
    
    const postId = await createPost('TRUST_USER_4', '/posts/free', {
      contextType: ContextType.PRODUCT,
      contextId: phoneProductId,
      description,
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Trust User 4',
      type: 'FREE',
      description,
      expectedInFeeds: ['OMER'],
      expectedNotInFeeds: [],
      expectedSource: 'TRENDING', // veya ENGAGEMENT_HIGH
      expectedMinScore: 20,
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);

    // Engagement ekle
    console.log('   Engagement ekleniyor (50+ like, 20+ comment, 10+ share)...');
    const allUserKeys = Object.keys(users);
    await addEngagement(postId, allUserKeys, 'like', 50);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await addEngagement(postId, allUserKeys, 'comment', 20);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await addEngagement(postId, allUserKeys, 'share', 10);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trending post oluştur
    await createTrendingPost(postId);
    console.log('✅ Engagement ve trending post oluşturuldu');

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 60000);

  // Test 10: Truster User 2 - FREE post (Negatif test - görünmemeli)
  test('10. Truster User 2 - FREE post (Negatif test)', async () => {
    console.log('\n📝 Test 10: Truster User 2 FREE post oluşturuluyor (Negatif test)...');
    
    const description = `Truster User 2 free postu - Farklı category, trust yok, inventory yok - Ömer feed'inde görünmemeli veya çok düşük score. Expected to appear in: - | Expected NOT to appear in: Ömer`;
    
    const postId = await createPost('TRUSTER_USER_2', '/posts/free', {
      contextType: ContextType.PRODUCT,
      contextId: differentCategoryProductId || phoneProductId, // Fallback
      description,
    });

    createdPostIds.push(postId);
    posts.push({
      id: postId,
      author: 'Truster User 2',
      type: 'FREE',
      description,
      expectedInFeeds: [],
      expectedNotInFeeds: ['OMER'],
      expectedSource: 'NEW_USER', // veya çok düşük score
      expectedMinScore: undefined, // Düşük score bekleniyor
    });

    console.log(`✅ Post oluşturuldu: ${postId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 30000);

  // Test 11: Feed dağıtımı için bekle ve kontrol et
  test('11. Feed dağıtımı bekleniyor ve kontrol ediliyor', async () => {
    console.log('\n⏳ Feed dağıtımı için bekleniyor (20 saniye per post)...');
    const waitTime = posts.length * 20000; // 20 saniye per post
    console.log(`   Toplam bekleme süresi: ${waitTime / 1000} saniye`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    console.log('\n🔍 Ömer\'in feed\'i kontrol ediliyor...');
    const feedResponse = await request(BASE_URL)
      .get('/feed')
      .set('Authorization', `Bearer ${users.OMER.token}`)
      .query({ limit: 100 });

    const feedItems = feedResponse.status === 200 ? (feedResponse.body.items || []) : [];

    // Her post için feed kontrolü yap
    for (const post of posts) {
      const feedItem = feedItems.find((item: any) => 
        item.post?.id === post.id || item.id === post.id
      );

      const analysis: FeedAnalysis = {
        postId: post.id,
        author: post.author,
        type: post.type,
        feedsCreated: [],
        success: false,
        message: '',
      };

      // Ömer'in feed'inde var mı kontrol et
      if (post.expectedInFeeds.includes('OMER')) {
        if (feedItem) {
          const feedRecord = await prisma.feed.findFirst({
            where: {
              userId: users.OMER.userId,
              postId: post.id,
            },
          });

          if (feedRecord) {
            const score = feedRecord.relevanceScore || 0;
            const source = feedRecord.source;
            
            analysis.feedsCreated.push({
              userId: users.OMER.userId,
              userEmail: users.OMER.email,
              source,
              score,
              success: true,
            });

            // Source ve score kontrolü
            if (post.expectedSource && source !== post.expectedSource) {
              analysis.message += `Source beklenen: ${post.expectedSource}, gerçek: ${source}. `;
            }

            if (post.expectedMinScore && score < post.expectedMinScore) {
              analysis.message += `Score beklenen: ≥${post.expectedMinScore}, gerçek: ${score}. `;
            }

            if (!analysis.message) {
              analysis.success = true;
              analysis.message = 'Başarılı';
            }
          } else {
            analysis.message = 'Feed kaydı bulunamadı';
          }
        } else {
          analysis.message = 'Feed item bulunamadı';
        }
      } else if (post.expectedNotInFeeds.includes('OMER')) {
        // Ömer'in feed'inde OLMAMALI
        if (!feedItem) {
          analysis.success = true;
          analysis.message = 'Beklendiği gibi feed\'de görünmüyor';
        } else {
          const feedRecord = await prisma.feed.findFirst({
            where: {
              userId: users.OMER.userId,
              postId: post.id,
            },
          });

          if (feedRecord) {
            const score = feedRecord.relevanceScore || 0;
            if (score < 10) {
              analysis.success = true;
              analysis.message = `Beklendiği gibi düşük score: ${score}`;
            } else {
              analysis.message = `Beklenmeyen yüksek score: ${score}`;
            }
          } else {
            analysis.success = true;
            analysis.message = 'Feed kaydı yok (beklenen)';
          }
        }
      }

      feedAnalysis.push(analysis);
    }

    // Tüm feed kayıtlarını DB'den al ve analiz et
    console.log('\n📊 Tüm feed kayıtları analiz ediliyor...');
    const allFeeds = await prisma.feed.findMany({
      where: {
        postId: { in: createdPostIds },
      },
      include: {
        user: true,
      },
    });

    console.log(`✅ Toplam ${allFeeds.length} feed kaydı bulundu`);

    // Her post için hangi kullanıcılara gittiğini göster
    for (const post of posts) {
      const postFeeds = allFeeds.filter(f => f.postId === post.id);
      console.log(`\n   Post ${post.id} (${post.author}):`);
      postFeeds.forEach(feed => {
        const userEmail = feed.user?.email || 'Unknown';
        console.log(`     → ${userEmail}: Source=${feed.source}, Score=${feed.relevanceScore || 0}`);
      });
    }
  }, 300000); // 5 dakika timeout
});

