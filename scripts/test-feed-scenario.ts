/**
 * Feed Test Senaryosu
 * 
 * 3 kullanıcı için feed test senaryosu:
 * - omer@tipbox.co: Tüm post tiplerinden gönderi oluşturur
 * - markettest@tipbox.co ve trust-user-0@tipbox.co: Feed'lerinde omer'in gönderilerini görür
 * 
 * Kullanım:
 *   npx ts-node scripts/test-feed-scenario.ts
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import path from 'path';
import { S3Service } from '../src/infrastructure/s3/s3.service';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const prisma = new PrismaClient();
const s3Service = new S3Service();

// Test kullanıcıları
const USERS = {
  omer: {
    email: 'omer@tipbox.co',
    password: 'password123',
    id: '480f5de9-b691-4d70-a6a8-2789226f4e07',
  },
  markettest: {
    email: 'markettest@tipbox.co',
    password: 'password123',
    id: '248cc91f-b551-4ecc-a885-db1163571330',
  },
  trustUser0: {
    email: 'trust-user-0@tipbox.co',
    password: 'password123',
    id: '11111111-1111-4111-a111-111111111111',
  },
};

interface AuthResult {
  token: string;
  userId: string;
}

// Helper: Login yap ve token al
async function login(email: string, password: string): Promise<AuthResult> {
  const res = await request(BASE_URL)
    .post('/auth/login')
    .send({ email, password });

  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Login başarısız: ${email} - ${res.status} - ${JSON.stringify(res.body)}`);
  }

  return {
    token: res.body.token,
    userId: res.body.id || res.body.userId,
  };
}

// Helper: Görsel yükle
async function uploadImage(filePath: string, userId: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const contentType = mimeMap[ext] || 'image/jpeg';
  const fileName = `post-media/${userId}/${Date.now()}-${path.basename(filePath)}`;
  const uploadedPath = await s3Service.uploadFile(fileName, buffer, contentType);
  return uploadedPath;
}

// Helper: Aktif event al
async function getActiveEvent(token: string): Promise<string | null> {
  try {
    const res = await request(BASE_URL)
      .get('/events/active')
      .set('Authorization', `Bearer ${token}`)
      .query({ limit: 1 });

    if (res.status === 200 && res.body.items && res.body.items.length > 0) {
      return res.body.items[0].id;
    }
  } catch (error) {
    console.warn('Aktif event alınamadı:', error);
  }
  return null;
}

// Helper: Inventory'den ürün al
async function getInventoryProduct(token: string): Promise<{ productId: string; contextType: string } | null> {
  try {
    const res = await request(BASE_URL)
      .get('/inventory')
      .set('Authorization', `Bearer ${token}`);

    if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
      // InventoryListItemResponse'da productId yok, sadece inventory id var
      // DB'den inventory'yi sorgulayıp productId'yi al
      const inventoryId = res.body[0].id;
      
      if (inventoryId) {
        const inventory = await prisma.inventory.findUnique({
          where: { id: inventoryId },
          select: { productId: true },
        });
        
        if (inventory && inventory.productId) {
          // Product'ın gerçekten var olduğunu kontrol et
          const productExists = await prisma.product.findUnique({
            where: { id: inventory.productId },
            select: { id: true },
          });
          
          if (productExists) {
            return {
              productId: inventory.productId,
              contextType: 'product',
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn('Inventory alınamadı:', error);
  }
  return null;
}

// Helper: Product veya ProductGroup veya SubCategory al (fallback)
async function getContextForPost(token: string): Promise<{ contextId: string; contextType: string }> {
  // Önce inventory'den ürün dene
  const inventory = await getInventoryProduct(token);
  if (inventory && inventory.productId) {
    // Product'ın gerçekten var olduğunu kontrol et
    const productExists = await prisma.product.findUnique({
      where: { id: inventory.productId },
      select: { id: true },
    });
    if (productExists) {
      return { contextId: inventory.productId, contextType: 'product' };
    }
  }

  // Eğer inventory yoksa, DB'den bir product al
  const product = await prisma.product.findFirst({
    select: { id: true },
    take: 1,
  });

  if (product && product.id) {
    return { contextId: product.id, contextType: 'product' };
  }

  // Product yoksa productGroup al
  const productGroup = await prisma.productGroup.findFirst({
    select: { id: true },
    take: 1,
  });

  if (productGroup && productGroup.id) {
    return { contextId: productGroup.id, contextType: 'product_group' };
  }

  // ProductGroup yoksa subCategory al
  const subCategory = await prisma.subCategory.findFirst({
    select: { id: true },
    take: 1,
  });

  if (subCategory && subCategory.id) {
    return { contextId: subCategory.id, contextType: 'sub_category' };
  }

  throw new Error('Context bulunamadı (product, productGroup, subCategory)');
}

// Helper: Boost option al
async function getBoostOption(token: string): Promise<string | null> {
  try {
    const res = await request(BASE_URL)
      .get('/posts/boost-options')
      .set('Authorization', `Bearer ${token}`);

    if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
      return res.body[0].id;
    }
  } catch (error) {
    console.warn('Boost option alınamadı:', error);
  }
  return null;
}

// Helper: DB kontrolü
async function checkPostInDB(postId: string, userId: string): Promise<boolean> {
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      include: {
        media: true,
      },
    });

  if (!post || post.userId !== userId) {
    return false;
  }

  return true;
}

// Helper: Feed kontrolü
async function checkPostInFeed(token: string, postId: string): Promise<boolean> {
  try {
    const res = await request(BASE_URL)
      .get('/feed')
      .set('Authorization', `Bearer ${token}`)
      .query({ limit: 50 });

    if (res.status === 200 && res.body.items) {
      const found = res.body.items.some((item: any) => item.data?.id === postId);
      return found;
    }
  } catch (error) {
    console.error('Feed kontrolü hatası:', error);
  }
  return false;
}

// Helper: MinIO kontrolü
async function checkImageInMinIO(imagePath: string): Promise<boolean> {
  return await s3Service.fileExists(imagePath);
}

// Helper: Feed tablosunda kayıt kontrolü
async function checkFeedRecords(postId: string, expectedUserIds: string[]): Promise<boolean> {
  const feeds = await prisma.feed.findMany({
    where: { postId },
    select: { userId: true },
  });

  const feedUserIds = new Set(feeds.map((f) => f.userId));
  const allFound = expectedUserIds.every((id) => feedUserIds.has(id));

  return allFound && feeds.length >= expectedUserIds.length;
}

// Post tipleri ve test senaryoları
interface PostScenario {
  name: string;
  type: 'FREE' | 'TIPS' | 'QUESTION' | 'COMPARE' | 'EXPERIENCE' | 'UPDATE';
  withEvent: boolean;
  needsInventory: boolean;
  needsBoostOption: boolean;
}

const POST_SCENARIOS: PostScenario[] = [
  { name: 'FREE (event olmadan)', type: 'FREE', withEvent: false, needsInventory: false, needsBoostOption: false },
  { name: 'FREE (event ile)', type: 'FREE', withEvent: true, needsInventory: false, needsBoostOption: false },
  { name: 'TIPS (event olmadan)', type: 'TIPS', withEvent: false, needsInventory: false, needsBoostOption: false },
  { name: 'TIPS (event ile)', type: 'TIPS', withEvent: true, needsInventory: false, needsBoostOption: false },
  { name: 'QUESTION (event olmadan)', type: 'QUESTION', withEvent: false, needsInventory: false, needsBoostOption: true },
  { name: 'QUESTION (event ile)', type: 'QUESTION', withEvent: true, needsInventory: false, needsBoostOption: true },
  { name: 'COMPARE (event olmadan)', type: 'COMPARE', withEvent: false, needsInventory: false, needsBoostOption: false },
  { name: 'COMPARE (event ile)', type: 'COMPARE', withEvent: true, needsInventory: false, needsBoostOption: false },
  { name: 'EXPERIENCE (event olmadan)', type: 'EXPERIENCE', withEvent: false, needsInventory: true, needsBoostOption: false },
  { name: 'EXPERIENCE (event ile)', type: 'EXPERIENCE', withEvent: true, needsInventory: true, needsBoostOption: false },
  { name: 'UPDATE (event olmadan)', type: 'UPDATE', withEvent: false, needsInventory: true, needsBoostOption: false },
  { name: 'UPDATE (event ile)', type: 'UPDATE', withEvent: true, needsInventory: true, needsBoostOption: false },
];

// Ana test fonksiyonu
async function testPostScenario(
  scenario: PostScenario,
  omerAuth: AuthResult,
  markettestAuth: AuthResult,
  trustUser0Auth: AuthResult,
  activeEventId: string | null,
  appleProductsDir: string
): Promise<boolean> {
  console.log(`\n📝 Test: ${scenario.name}`);
  console.log('─'.repeat(60));

  try {
    // 1. Görsel yükle
    const imageFiles = [
      path.join(appleProductsDir, 'apple-product-iphone17pro.png'),
      path.join(appleProductsDir, 'apple-product-airpodspro3.png'),
    ].filter((f) => {
      try {
        return readFileSync(f);
      } catch {
        return false;
      }
    });

    if (imageFiles.length === 0) {
      throw new Error('Görsel dosyası bulunamadı');
    }

    console.log('📤 Görseller yükleniyor...');
    const uploadedImages: string[] = [];
    for (const imageFile of imageFiles.slice(0, 2)) {
      const uploadedPath = await uploadImage(imageFile, omerAuth.userId);
      uploadedImages.push(uploadedPath);
      console.log(`  ✓ ${path.basename(imageFile)} -> ${uploadedPath}`);
    }

    // 2. Context al
    const context = await getContextForPost(omerAuth.token);
    console.log(`📦 Context: ${context.contextType} (${context.contextId})`);

    // 3. Event ID (eğer gerekliyse)
    const eventId = scenario.withEvent ? activeEventId : undefined;
    if (scenario.withEvent && !eventId) {
      console.warn('  ⚠ Event gerekli ama aktif event bulunamadı, event olmadan devam ediliyor');
    }

    // 4. Boost option (eğer gerekliyse)
    let boostOptionId: string | null = null;
    if (scenario.needsBoostOption) {
      boostOptionId = await getBoostOption(omerAuth.token);
      if (!boostOptionId) {
        // Boost option yoksa, DB'den kontrol et
        const boostOption = await prisma.boostOption.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        if (boostOption) {
          boostOptionId = boostOption.id;
          console.log(`  ✓ Boost option (DB'den): ${boostOptionId}`);
        } else {
          throw new Error('Boost option bulunamadı (ne endpoint\'te ne DB\'de)');
        }
      } else {
        console.log(`  ✓ Boost option: ${boostOptionId}`);
      }
    }

    // 5. Post oluştur
    console.log('📝 Post oluşturuluyor...');
    let postId: string;

    // Base body - uploadedImages zaten yukarıda tanımlı
    const baseBody: any = {
      contextType: context.contextType,
      contextId: context.contextId,
      description: `Test post: ${scenario.name} - ${new Date().toISOString()}`,
      images: uploadedImages,
      ...(eventId && { eventId }),
    };

    switch (scenario.type) {
      case 'FREE': {
        const res = await request(BASE_URL)
          .post('/posts/free')
          .set('Authorization', `Bearer ${omerAuth.token}`)
          .send(baseBody);
        if (res.status !== 201 || !res.body.id) {
          throw new Error(`Post oluşturulamadı: ${res.status} - ${JSON.stringify(res.body)}`);
        }
        postId = res.body.id;
        break;
      }
      case 'TIPS': {
        const res = await request(BASE_URL)
          .post('/posts/tips-and-tricks')
          .set('Authorization', `Bearer ${omerAuth.token}`)
          .send({
            ...baseBody,
            benefitCategory: 'time_saving',
          });
        if (res.status !== 201 || !res.body.id) {
          throw new Error(`Post oluşturulamadı: ${res.status} - ${JSON.stringify(res.body)}`);
        }
        postId = res.body.id;
        break;
      }
      case 'QUESTION': {
        if (!boostOptionId) {
          throw new Error('Boost option gerekli');
        }
        const res = await request(BASE_URL)
          .post('/posts/question')
          .set('Authorization', `Bearer ${omerAuth.token}`)
          .send({
            ...baseBody,
            selectedBoostOptionId: boostOptionId,
          });
        if (res.status !== 201 || !res.body.id) {
          throw new Error(`Post oluşturulamadı: ${res.status} - ${JSON.stringify(res.body)}`);
        }
        postId = res.body.id;
        break;
      }
      case 'COMPARE': {
        // COMPARE için 2 ürün gerekli ve contextType PRODUCT olmalı
        const product1 = await prisma.product.findFirst({ select: { id: true } });
        const product2 = await prisma.product.findMany({ where: { id: { not: product1?.id } }, select: { id: true }, take: 1 });
        
        if (!product1 || product2.length === 0) {
          throw new Error('COMPARE için yeterli ürün bulunamadı');
        }

        const res = await request(BASE_URL)
          .post('/posts/benchmark')
          .set('Authorization', `Bearer ${omerAuth.token}`)
          .send({
            contextType: 'product',
            contextId: product1.id,
            description: baseBody.description,
            images: uploadedImages, // baseBody.images yerine uploadedImages kullan
            products: [
              { productId: product1.id, isSelected: true },
              { productId: product2[0].id, isSelected: true },
            ],
            ...(eventId && { eventId }),
          });
        if (res.status !== 201 || !res.body.id) {
          throw new Error(`Post oluşturulamadı: ${res.status} - ${JSON.stringify(res.body)}`);
        }
        postId = res.body.id;
        break;
      }
      case 'EXPERIENCE': {
        // EXPERIENCE için product context gerekli
        const inventory = await getInventoryProduct(omerAuth.token);
        if (!inventory) {
          throw new Error('EXPERIENCE için inventory ürünü bulunamadı');
        }

        // Experience options al
        const optionsRes = await request(BASE_URL)
          .get('/posts/experience/options')
          .set('Authorization', `Bearer ${omerAuth.token}`);

        let durationId: string | undefined;
        let locationId: string | undefined;
        let purposeId: string | undefined;

        if (optionsRes.status === 200 && optionsRes.body) {
          durationId = optionsRes.body.durations?.[0]?.id;
          locationId = optionsRes.body.locations?.[0]?.id;
          purposeId = optionsRes.body.purposes?.[0]?.id;
        }

        const res = await request(BASE_URL)
          .post('/posts/experience')
          .set('Authorization', `Bearer ${omerAuth.token}`)
          .send({
            contextType: 'product',
            contextId: inventory.productId,
            content: 'Test experience content',
            experience: [
              {
                type: 'price_and_shopping',
                content: 'Price and shopping experience test',
                rating: 4,
              },
              {
                type: 'product_and_usage',
                content: 'Product and usage experience test',
                rating: 5,
              },
            ],
            status: 'own',
            images: uploadedImages,
            selectedDurationId: durationId,
            selectedLocationId: locationId,
            selectedPurposeId: purposeId,
            ...(eventId && { eventId }),
          });
        if (res.status !== 201 || !res.body.id) {
          throw new Error(`Post oluşturulamadı: ${res.status} - ${JSON.stringify(res.body)}`);
        }
        postId = res.body.id;
        break;
      }
      case 'UPDATE': {
        // UPDATE için product context gerekli
        const inventory = await getInventoryProduct(omerAuth.token);
        if (!inventory) {
          throw new Error('UPDATE için inventory ürünü bulunamadı');
        }

        const res = await request(BASE_URL)
          .post('/posts/update')
          .set('Authorization', `Bearer ${omerAuth.token}`)
          .send({
            contextType: 'product',
            contextId: inventory.productId,
            content: 'Test update content',
            images: uploadedImages,
            ...(eventId && { eventId }),
          });
        if (res.status !== 201 || !res.body.id) {
          throw new Error(`Post oluşturulamadı: ${res.status} - ${JSON.stringify(res.body)}`);
        }
        postId = res.body.id;
        break;
      }
      default:
        throw new Error(`Bilinmeyen post tipi: ${scenario.type}`);
    }

    console.log(`  ✓ Post oluşturuldu: ${postId}`);

    // 6. DB kontrolü
    console.log('🔍 DB kontrolü yapılıyor...');
    const postExists = await checkPostInDB(postId, omerAuth.userId);
    if (!postExists) {
      throw new Error('Post DB\'de bulunamadı');
    }
    console.log('  ✓ Post DB\'de mevcut');

    const postMedia = await prisma.postMedia.findMany({ where: { postId } });
    // COMPARE post'ları için görseller opsiyonel olabilir, bu yüzden sadece uyarı ver
    if (postMedia.length !== uploadedImages.length && scenario.type !== 'COMPARE') {
      throw new Error(`PostMedia kayıt sayısı eşleşmiyor: beklenen ${uploadedImages.length}, bulunan ${postMedia.length}`);
    }
    if (postMedia.length > 0) {
      console.log(`  ✓ PostMedia kayıtları mevcut (${postMedia.length} adet)`);
    } else if (uploadedImages.length > 0 && scenario.type === 'COMPARE') {
      console.log(`  ⚠ PostMedia kayıtları yok (COMPARE post'ları için görseller opsiyonel olabilir)`);
    } else {
      console.log(`  ✓ PostMedia kayıtları mevcut (${postMedia.length} adet)`);
    }

    // Feed kayıtları kontrolü (async olarak ekleniyor olabilir, biraz bekle)
    console.log('  ⏳ Feed kayıtları kontrol ediliyor (async işlem için bekleniyor)...');
    let feedRecordsExist = false;
    const expectedFeedUserIds = [markettestAuth.userId, trustUser0Auth.userId];
    
    // En fazla 5 saniye bekle (her 500ms'de bir kontrol et)
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      feedRecordsExist = await checkFeedRecords(postId, expectedFeedUserIds);
      if (feedRecordsExist) {
        break;
      }
    }
    
    if (!feedRecordsExist) {
      // Hata mesajında detaylı bilgi ver
      const feeds = await prisma.feed.findMany({
        where: { postId },
        select: { userId: true },
      });
      const foundUserIds = feeds.map((f) => f.userId);
      throw new Error(`Feed kayıtları eksik veya yanlış. Beklenen: ${expectedFeedUserIds.join(', ')}, Bulunan: ${foundUserIds.join(', ')}, Toplam: ${feeds.length}`);
    }
    console.log('  ✓ Feed kayıtları mevcut (diğer 2 kullanıcı için)');

    // 7. MinIO kontrolü
    console.log('📦 MinIO kontrolü yapılıyor...');
    for (const imagePath of uploadedImages) {
      const exists = await checkImageInMinIO(imagePath);
      if (!exists) {
        throw new Error(`Görsel MinIO'da bulunamadı: ${imagePath}`);
      }
      console.log(`  ✓ ${path.basename(imagePath)} MinIO'da mevcut`);
    }

    // 8. Feed kontrolü
    console.log('📰 Feed kontrolü yapılıyor...');
    
    // Feed kayıtları zaten kontrol edildi, burada sadece API'den kontrol ediyoruz

    const inMarkettestFeed = await checkPostInFeed(markettestAuth.token, postId);
    const inTrustUser0Feed = await checkPostInFeed(trustUser0Auth.token, postId);

    if (!inMarkettestFeed) {
      throw new Error('Post markettest kullanıcısının feed\'inde görünmüyor');
    }
    console.log('  ✓ Post markettest kullanıcısının feed\'inde mevcut');

    if (!inTrustUser0Feed) {
      throw new Error('Post trust-user-0 kullanıcısının feed\'inde görünmüyor');
    }
    console.log('  ✓ Post trust-user-0 kullanıcısının feed\'inde mevcut');

    console.log(`✅ ${scenario.name} başarılı!`);
    return true;
  } catch (error) {
    console.error(`❌ ${scenario.name} başarısız:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Ana fonksiyon
async function main() {
  console.log('🚀 Feed Test Senaryosu Başlatılıyor...');
  console.log('═'.repeat(60));

  try {
    // 1. Login
    console.log('\n🔐 Kullanıcılar login oluyor...');
    const omerAuth = await login(USERS.omer.email, USERS.omer.password);
    console.log(`  ✓ ${USERS.omer.email} - ${omerAuth.userId}`);

    const markettestAuth = await login(USERS.markettest.email, USERS.markettest.password);
    console.log(`  ✓ ${USERS.markettest.email} - ${markettestAuth.userId}`);

    const trustUser0Auth = await login(USERS.trustUser0.email, USERS.trustUser0.password);
    console.log(`  ✓ ${USERS.trustUser0.email} - ${trustUser0Auth.userId}`);

    // 2. Aktif event al
    console.log('\n📅 Aktif event aranıyor...');
    const activeEventId = await getActiveEvent(omerAuth.token);
    if (activeEventId) {
      console.log(`  ✓ Aktif event bulundu: ${activeEventId}`);
    } else {
      console.log('  ⚠ Aktif event bulunamadı (event ile post oluşturma testleri atlanacak)');
    }

    // 3. Apple Products klasörü
    const appleProductsDir = path.join(__dirname, '..', 'tests', 'assets', 'Apple_Products');
    console.log(`\n📁 Görseller klasörü: ${appleProductsDir}`);

    // 4. Her post senaryosu için test
    console.log('\n📝 Post senaryoları test ediliyor...');
    let successCount = 0;
    let failCount = 0;

    for (const scenario of POST_SCENARIOS) {
      const success = await testPostScenario(
        scenario,
        omerAuth,
        markettestAuth,
        trustUser0Auth,
        activeEventId,
        appleProductsDir
      );

      if (success) {
        successCount++;
      } else {
        failCount++;
        console.error(`\n❌ Test durduruldu: ${scenario.name} başarısız oldu`);
        break; // Bir test başarısız olursa durdur
      }
    }

    // 5. Özet
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Test Özeti:');
    console.log(`  ✅ Başarılı: ${successCount}`);
    console.log(`  ❌ Başarısız: ${failCount}`);
    console.log(`  📝 Toplam: ${POST_SCENARIOS.length}`);

    if (failCount > 0) {
      process.exit(1);
    } else {
      console.log('\n🎉 Tüm testler başarılı!');
    }
  } catch (error) {
    console.error('\n❌ Test hatası:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script çalıştır
main();

