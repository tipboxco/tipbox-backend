import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { ExperienceType } from '../../src/domain/content/experience-type.enum';
import { ExperienceStatus } from '../../src/domain/content/experience-status.enum';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const prisma = new PrismaClient();

// Test constants
const TEST_USER = {
  email: 'omer@tipbox.co',
  id: '480f5de9-b691-4d70-a6a8-2789226f4e07',
  password: 'password123',
};

const TEST_PRODUCTS = {
  dysonV15s: '08dd3d54-991f-4ca3-8231-3113b44f21ec',
  dysonV12: '2d1dbe46-dcc2-4917-8539-2705d07ba5ca',
};

const SEARCH_KEYWORD = 'Dyson';

// Experience templates for inventory (10 unique)
const inventoryExperiences = [
  "Ürünü 3 aydır kullanıyorum, 450 TL'ye aldım ve gerçekten çok memnunum. Kablosuz olması ve uzun pil ömrü harika. Evde günlük temizlikte çok işime yarıyor.",
  "Satın alma sürecinde indirim fırsatını yakaladım, 520 TL'ye aldım. İlk bir haftada biraz adapte olmam gerekti ama şimdi vazgeçilmezim oldu.",
  "Online siparişle aldım, kargo ücretsizdi. 2 gün içinde elime ulaştı. Şarj süresi beklenenden kısa ama performans çok iyi.",
  "Mağazadan aldım, satış temsilcisi çok yardımcı oldu. Fiyat biraz yüksek ama kalitesi buna değer. Özellikle ağır halılar için mükemmel.",
  "Black Friday'de %30 indirimle aldım. Kutusunu açtığımda kalitesi hemen belli oldu. Sessiz çalışması ve tasarımı harika.",
  "Hediye olarak aldım annem için, çok beğendi. Online fiyatları karşılaştırdım ve en ucuzunu buldum. Kullanımı çok kolay.",
  "İkinci el gibi satılan bir ürün aldım ama sıfıra yakın. Ofisimde kullanıyorum, kablosuz olması büyük avantaj.",
  "Taksitli aldım, banka kampanyası vardı. İlk kullanımda filtre sistemi beni etkiledi. Bakımı çok pratik.",
  "Kargodan hasarlı geldi ama değiştirdiler hemen. Müşteri hizmetleri çok ilgili. Ürün performansı beklentimin üzerinde.",
  "Showroom'dan test ederek aldım. Satış sonrası garanti süresi uzun. Özellikle pet kılları için çok etkili.",
];

// Experience templates for posts (10 unique)
const postExperiences = [
  "Profesyonel işlerimde bu ürünü 6 aydır kullanıyorum. Fiyat/performans oranı mükemmel. Özellikle dayanıklılığı beni şaşırttı.",
  "Uzun zamandır araştırıyordum, fiyatlar yükselince hemen aldım. Günlük kullanımda çok pratik, tavsiye ederim.",
  "E-ticaret sitesinde kampanya gördüm, ücretsiz kargo ile geldi. Ürün kalitesi fiyatına göre oldukça iyi.",
  "Arkadaşımın tavsiyesi ile aldım, kargo çok hızlıydı. İlk kullanımda biraz ağır gelse de alıştım, şimdi çok memnunum.",
  "Online incelemelerini okuyup karar verdim. İndirim dönemi beklemeye değdi. Kullanım kılavuzu çok detaylı.",
  "Mağazadan deneyerek aldım, personel çok bilgiliydi. Montajı kolay, tasarımı modern. Evde çok beğendik.",
  "Taksit seçenekleri çok uygundu, hemen aldım. Günlük kullanımda çok sessiz çalışıyor. Bakımı kolay.",
  "İkinci bir ürün olarak aldım. İlk ürünle karşılaştırınca farkı görüyorsunuz. Bu daha kaliteli malzeme kullanılmış.",
  "İade garantisi olduğu için risk almadım. Ürün beklentimi karşıladı, iade etmedim. Uzun ömürlü olacağını düşünüyorum.",
  "Markanın resmi sitesinden aldım, hediye paketi geldi. İlk 6 ayda hiç sorun yaşamadım. Uzun vadeli yatırım.",
];

// Timeout for AI operations
jest.setTimeout(120000); // 2 minutes for AI calls

describe('AI Split Experience - Comprehensive E2E Tests', () => {
  let authToken: string;
  let userId: string;
  let testsFailed = false;
  
  // Track created items for cleanup
  const createdInventoryIds: string[] = [];
  const createdPostIds: string[] = [];
  const createdSnippetIds: string[] = [];

  beforeAll(async () => {
    console.log('\n🔐 Setting up authentication...');
    
    // Login with test user
    const loginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    
    authToken = loginRes.body.token;
    userId = loginRes.body.id || loginRes.body.userId || TEST_USER.id;
    
    console.log(`✅ Authenticated as ${TEST_USER.email}`);
    console.log(`   User ID: ${userId}`);

    // Clean up old test data for Dyson products
    console.log('\n🧹 Cleaning up old inventory items...');
    const oldInventories = await prisma.inventory.findMany({
      where: {
        userId,
        productId: {
          in: [TEST_PRODUCTS.dysonV15s, TEST_PRODUCTS.dysonV12],
        },
      },
    });

    for (const inv of oldInventories) {
      await prisma.inventoryMedia.deleteMany({ where: { inventoryId: inv.id } });
      await prisma.productExperience.deleteMany({ where: { inventoryId: inv.id } });
      await prisma.inventory.delete({ where: { id: inv.id } });
    }
    
    console.log(`   Deleted ${oldInventories.length} old inventory items`);
  });

  afterEach(() => {
    // Track if current test failed
    if ((expect as any).getState().testPath && (expect as any).getState().currentTestName) {
      const state = (expect as any).getState();
      if (state.assertionCalls !== state.numPassingAsserts) {
        testsFailed = true;
      }
    }
  });

  afterAll(async () => {
    if (testsFailed) {
      console.log('\n🧹 Tests failed - cleaning up test data...');
      
      // Delete created inventories
      for (const invId of createdInventoryIds) {
        try {
          await prisma.inventoryMedia.deleteMany({ where: { inventoryId: invId } });
          await prisma.productExperience.deleteMany({ where: { inventoryId: invId } });
          await prisma.inventory.delete({ where: { id: invId } });
        } catch (error) {
          // Silently ignore
        }
      }
      console.log(`   Deleted ${createdInventoryIds.length} inventory items`);

      // Delete created posts
      for (const postId of createdPostIds) {
        try {
          await prisma.postMedia.deleteMany({ where: { postId } });
          await prisma.contentPost.delete({ where: { id: postId } });
        } catch (error) {
          // Silently ignore
        }
      }
      console.log(`   Deleted ${createdPostIds.length} posts`);

      // Delete experience snippets
      for (const snippetId of createdSnippetIds) {
        try {
          await prisma.aiExperienceSplit.delete({ where: { id: snippetId } });
        } catch (error) {
          // Silently ignore
        }
      }
      console.log(`   Deleted ${createdSnippetIds.length} experience snippets`);
      console.log('✅ Cleanup completed\n');
    } else {
      console.log('\n✅ All tests passed! Test data kept for inspection.');
      console.log(`   - ${createdInventoryIds.length} inventory items`);
      console.log(`   - ${createdPostIds.length} posts`);
      console.log(`   - ${createdSnippetIds.length} experience snippets\n`);
    }

    await prisma.$disconnect();
  });

  describe('Part A: Inventory Creation with AI Split (10 items)', () => {
    let experienceOptions: {
      durations: Array<{ id: string; name: string }>;
      locations: Array<{ id: string; name: string }>;
      purposes: Array<{ id: string; name: string }>;
    };

    beforeAll(async () => {
      console.log('\n📋 Fetching experience options...');
      
      const optionsRes = await request(BASE_URL)
        .get('/inventory/experience/options')
        .set('Authorization', `Bearer ${authToken}`);

      expect(optionsRes.status).toBe(200);
      expect(optionsRes.body).toHaveProperty('durations');
      expect(optionsRes.body).toHaveProperty('locations');
      expect(optionsRes.body).toHaveProperty('purposes');
      
      experienceOptions = optionsRes.body;
      
      console.log(`   Durations: ${experienceOptions.durations.length}`);
      console.log(`   Locations: ${experienceOptions.locations.length}`);
      console.log(`   Purposes: ${experienceOptions.purposes.length}`);
    });

    // 10 inventory creation tests
    for (let i = 0; i < 10; i++) {
      it(`should create inventory item ${i + 1}/10 with AI split`, async () => {
        console.log(`\n🔧 Creating inventory ${i + 1}/10...`);
        
        // Select product (alternating between V15s and V12)
        const productId = i % 2 === 0 ? TEST_PRODUCTS.dysonV15s : TEST_PRODUCTS.dysonV12;
        console.log(`   Product: ${i % 2 === 0 ? 'Dyson V15s' : 'Dyson V12'}`);
        
        // Clean up existing inventory for this product (to avoid unique constraint)
        await prisma.inventory.deleteMany({
          where: {
            userId,
            productId,
          },
        });
        
        // Step 1: Product search
        const searchRes = await request(BASE_URL)
          .get('/search')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ keyword: SEARCH_KEYWORD, types: 'product', limit: 10 });

        expect([200, 204]).toContain(searchRes.status);

        // Step 2: Select options (round-robin)
        const durationId = experienceOptions.durations[i % experienceOptions.durations.length].id;
        const locationId = experienceOptions.locations[i % experienceOptions.locations.length].id;
        const purposeId = experienceOptions.purposes[i % experienceOptions.purposes.length].id;

        // Step 3: Experience text
        const experienceText = inventoryExperiences[i];

        // Step 4: AI Split
        console.log(`   Calling AI split...`);
        const splitRes = await request(BASE_URL)
          .post('/inventory/split-experience')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ productId, experienceText });

        expect(splitRes.status).toBe(200);
        expect(splitRes.body).toHaveProperty('experienceSnippetId');
        expect(splitRes.body).toHaveProperty('metadata');
        
        const snippetId = splitRes.body.experienceSnippetId;
        createdSnippetIds.push(snippetId);
        
        // Validate UUID format
        expect(snippetId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        
        // At least one experience category should be present
        const hasContent = splitRes.body.priceAndShopping || splitRes.body.productAndUsage;
        expect(hasContent).toBeTruthy();
        
        console.log(`   AI Split completed (${splitRes.body.metadata.processingTimeMs}ms, ${splitRes.body.metadata.tokensUsed || 'N/A'} tokens)`);

        // Step 5: Create inventory
        const experience = [];
        if (splitRes.body.priceAndShopping) {
          experience.push({
            type: ExperienceType.PRICE_AND_SHOPPING,
            content: splitRes.body.priceAndShopping.content,
            rating: splitRes.body.priceAndShopping.rating,
          });
        }
        if (splitRes.body.productAndUsage) {
          experience.push({
            type: ExperienceType.PRODUCT_AND_USAGE,
            content: splitRes.body.productAndUsage.content,
            rating: splitRes.body.productAndUsage.rating,
          });
        }

        const inventoryPayload = {
          productId,
          selectedDurationId: durationId,
          selectedLocationId: locationId,
          selectedPurposeId: purposeId,
          content: experienceText,
          experience,
          status: ExperienceStatus.OWN,
          experienceSnippetId: snippetId,
        };

        const createRes = await request(BASE_URL)
          .post('/inventory')
          .set('Authorization', `Bearer ${authToken}`)
          .send(inventoryPayload);

        expect(createRes.status).toBe(201);
        expect(createRes.body).toHaveProperty('id');
        
        const inventoryId = createRes.body.id;
        createdInventoryIds.push(inventoryId);
        
        console.log(`   Inventory created: ${inventoryId}`);

        // Step 6: DB Verification
        const dbInventory = await prisma.inventory.findUnique({
          where: { id: inventoryId },
          include: {
            experienceDuration: true,
            experienceLocation: true,
            experiencePurpose: true,
          },
        });
        
        expect(dbInventory).not.toBeNull();
        expect(dbInventory?.experienceSnippetId).toBe(snippetId);
        expect(dbInventory?.userId).toBe(userId);
        expect(dbInventory?.productId).toBe(productId);
        
        // ✅ Taxonomy ID'leri kontrol et
        expect(dbInventory?.experienceDurationId).toBe(durationId);
        expect(dbInventory?.experienceLocationId).toBe(locationId);
        expect(dbInventory?.experiencePurposeId).toBe(purposeId);
        
        // ✅ Relations kontrol et
        expect(dbInventory?.experienceDuration).not.toBeNull();
        expect(dbInventory?.experienceLocation).not.toBeNull();
        expect(dbInventory?.experiencePurpose).not.toBeNull();
        
        console.log(`   📊 Taxonomy: ${dbInventory?.experienceDuration?.name} / ${dbInventory?.experienceLocation?.name} / ${dbInventory?.experiencePurpose?.name}`);

        const dbSnippet = await prisma.aiExperienceSplit.findUnique({
          where: { id: snippetId },
        });
        
        expect(dbSnippet).not.toBeNull();
        expect(dbSnippet?.userId).toBe(userId);
        expect(dbSnippet?.productId).toBe(productId);

        const dbExperiences = await prisma.productExperience.findMany({
          where: { inventoryId },
        });
        
        expect(dbExperiences.length).toBe(experience.length);
        
        console.log(`   ✅ DB verification passed (${dbExperiences.length} experiences)`);
      }, 120000); // 2 minutes timeout for AI
    }
  });

  describe('Part B: Experience Post Creation with AI Split (10 posts)', () => {
    let experienceOptions: {
      durations: Array<{ id: string; name: string }>;
      locations: Array<{ id: string; name: string }>;
      purposes: Array<{ id: string; name: string }>;
    };

    beforeAll(async () => {
      console.log('\n📋 Fetching post experience options...');
      
      const optionsRes = await request(BASE_URL)
        .get('/posts/experience/options')
        .set('Authorization', `Bearer ${authToken}`);

      expect(optionsRes.status).toBe(200);
      expect(optionsRes.body).toHaveProperty('durations');
      
      experienceOptions = optionsRes.body;
    });

    // 10 post creation tests
    for (let i = 0; i < 10; i++) {
      it(`should create experience post ${i + 1}/10 with AI split`, async () => {
        console.log(`\n📝 Creating post ${i + 1}/10...`);
        
        // Step 1: Product selection
        const productId = i % 2 === 0 ? TEST_PRODUCTS.dysonV15s : TEST_PRODUCTS.dysonV12;
        console.log(`   Product: ${i % 2 === 0 ? 'Dyson V15s' : 'Dyson V12'}`);

        // Step 2: Select options
        const durationId = experienceOptions.durations[i % experienceOptions.durations.length].id;
        const locationId = experienceOptions.locations[i % experienceOptions.locations.length].id;
        const purposeId = experienceOptions.purposes[i % experienceOptions.purposes.length].id;

        // Step 3: Experience text
        const experienceText = postExperiences[i];

        // Step 4: AI Split
        console.log(`   Calling AI split...`);
        const splitRes = await request(BASE_URL)
          .post('/posts/experience/split')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ productId, content: experienceText });

        expect(splitRes.status).toBe(200);
        expect(splitRes.body).toHaveProperty('experienceSnippetId');
        
        const snippetId = splitRes.body.experienceSnippetId;
        createdSnippetIds.push(snippetId);
        
        console.log(`   AI Split completed (${splitRes.body.metadata.processingTimeMs}ms)`);

        // Step 5: Create post
        const experience = [];
        if (splitRes.body.priceAndShopping) {
          experience.push({
            type: ExperienceType.PRICE_AND_SHOPPING,
            content: splitRes.body.priceAndShopping.content,
            rating: splitRes.body.priceAndShopping.rating,
          });
        }
        if (splitRes.body.productAndUsage) {
          experience.push({
            type: ExperienceType.PRODUCT_AND_USAGE,
            content: splitRes.body.productAndUsage.content,
            rating: splitRes.body.productAndUsage.rating,
          });
        }

        const postPayload = {
          contextType: 'product',
          contextId: productId,
          selectedDurationId: durationId,
          selectedLocationId: locationId,
          selectedPurposeId: purposeId,
          content: experienceText,
          experience,
          status: ExperienceStatus.OWN,
          experienceSnippetId: snippetId,
        };

        const createRes = await request(BASE_URL)
          .post('/posts/experience')
          .set('Authorization', `Bearer ${authToken}`)
          .send(postPayload);

        expect(createRes.status).toBe(201);
        expect(createRes.body).toHaveProperty('id');
        
        const postId = createRes.body.id;
        createdPostIds.push(postId);
        
        console.log(`   Post created: ${postId}`);

        // Step 6: DB Verification
        const dbPost = await prisma.contentPost.findUnique({
          where: { id: postId },
          include: {
            experienceDuration: true,
            experienceLocation: true,
            experiencePurpose: true,
          },
        });
        
        expect(dbPost).not.toBeNull();
        expect(dbPost?.experienceSnippetId).toBe(snippetId);
        expect(dbPost?.userId).toBe(userId);
        expect(dbPost?.productId).toBe(productId);
        expect(dbPost?.type).toBe('EXPERIENCE');
        
        // ✅ Taxonomy ID'leri kontrol et
        expect(dbPost?.experienceDurationId).toBe(durationId);
        expect(dbPost?.experienceLocationId).toBe(locationId);
        expect(dbPost?.experiencePurposeId).toBe(purposeId);
        
        // ✅ Relations kontrol et
        expect(dbPost?.experienceDuration).not.toBeNull();
        expect(dbPost?.experienceLocation).not.toBeNull();
        expect(dbPost?.experiencePurpose).not.toBeNull();
        
        console.log(`   📊 Taxonomy: ${dbPost?.experienceDuration?.name} / ${dbPost?.experienceLocation?.name} / ${dbPost?.experiencePurpose?.name}`);

        const dbSnippet = await prisma.aiExperienceSplit.findUnique({
          where: { id: snippetId },
        });
        
        expect(dbSnippet).not.toBeNull();
        
        console.log(`   ✅ DB verification passed`);
      }, 120000); // 2 minutes timeout for AI
    }
  });
});

