import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { getAuthToken } from '../tests/helpers/auth-helper';
import { ExperienceType } from '../src/domain/content/experience-type.enum';
import { ExperienceStatus } from '../src/domain/content/experience-status.enum';
import { ContextType } from '../src/domain/content/context-type.enum';

const BASE_URL = 'http://localhost:3000';
const prisma = new PrismaClient();

async function testExperienceFeed() {
  console.log('🧪 Experience Feed Test Başlatılıyor...\n');

  try {
    // 1. Auth token al
    console.log('1️⃣ Auth token alınıyor...');
    const auth = await getAuthToken('omer@tipbox.co', 'password123');
    console.log(`✅ Token alındı: ${auth.token.substring(0, 20)}...`);
    console.log(`   User ID: ${auth.userId}\n`);

    // 2. Experience options al
    console.log('2️⃣ Experience options alınıyor...');
    const optionsRes = await request(BASE_URL)
      .get('/posts/experience/options')
      .set('Authorization', `Bearer ${auth.token}`);

    if (optionsRes.status !== 200) {
      throw new Error(`Experience options alınamadı: ${optionsRes.status}`);
    }

    const options = optionsRes.body;
    const durationId = options.durations?.[0]?.id;
    const locationId = options.locations?.[0]?.id;
    const purposeId = options.purposes?.[0]?.id;

    console.log(`✅ Options alındı:`);
    console.log(`   Duration: ${durationId}`);
    console.log(`   Location: ${locationId}`);
    console.log(`   Purpose: ${purposeId}\n`);

    // 3. Bir product bul (DB'den)
    console.log('3️⃣ Product aranıyor (DB\'den)...');
    const product = await prisma.product.findFirst({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!product) {
      throw new Error('Product bulunamadı');
    }

    const productId = product.id;
    console.log(`✅ Product bulundu: ${product.name} (${productId})\n`);

    // 4. Experience gönderisi oluştur
    console.log('4️⃣ Experience gönderisi oluşturuluyor...');
    const experiencePostRes = await request(BASE_URL)
      .post('/posts/experience')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        contextType: ContextType.PRODUCT,
        contextId: productId,
        content: 'Test experience gönderisi - iPhone deneyimi',
        experience: [
          {
            type: ExperienceType.PRICE_AND_SHOPPING,
            content: 'Fiyat biraz yüksek ama kalite karşılıyor. Alışveriş deneyimi sorunsuzdu.',
            rating: 4,
          },
          {
            type: ExperienceType.PRODUCT_AND_USAGE,
            content: 'Ürün performansı mükemmel. Kullanım kolay ve hızlı.',
            rating: 5,
          },
        ],
        status: ExperienceStatus.OWN,
        selectedDurationId: durationId,
        selectedLocationId: locationId,
        selectedPurposeId: purposeId,
      });

    if (experiencePostRes.status !== 201) {
      console.error('❌ Experience gönderisi oluşturulamadı:');
      console.error(`   Status: ${experiencePostRes.status}`);
      console.error(`   Body: ${JSON.stringify(experiencePostRes.body, null, 2)}`);
      throw new Error('Experience gönderisi oluşturulamadı');
    }

    const postId = experiencePostRes.body.id;
    console.log(`✅ Experience gönderisi oluşturuldu: ${postId}\n`);

    // 5. Kısa bir bekleme (cache/async işlemler için)
    console.log('5️⃣ 2 saniye bekleniyor (cache/async işlemler için)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Bekleme tamamlandı\n');

    // 6. user/reviews endpoint'ini kontrol et
    console.log('6️⃣ GET /users/{id}/reviews kontrol ediliyor...');
    const reviewsRes = await request(BASE_URL)
      .get(`/users/${auth.userId}/reviews`)
      .set('Authorization', `Bearer ${auth.token}`);

    if (reviewsRes.status !== 200) {
      console.error(`❌ Reviews endpoint hatası: ${reviewsRes.status}`);
      console.error(`   Body: ${JSON.stringify(reviewsRes.body, null, 2)}`);
    } else {
      const reviews = reviewsRes.body.items || [];
      const foundPost = reviews.find((item: any) => item.id === postId || item.type === 'experience');
      
      console.log(`   Toplam review sayısı: ${reviews.length}`);
      if (foundPost) {
        console.log(`✅ Experience gönderisi reviews'de bulundu!`);
        console.log(`   Post ID: ${foundPost.id}`);
        console.log(`   Type: ${foundPost.type}`);
      } else {
        console.log(`❌ Experience gönderisi reviews'de BULUNAMADI!`);
        console.log(`   İlk 3 review:`, reviews.slice(0, 3).map((r: any) => ({ id: r.id, type: r.type })));
      }
    }
    console.log('');

    // 7. user/feed endpoint'ini kontrol et
    console.log('7️⃣ GET /users/{id}/feed kontrol ediliyor...');
    const feedRes = await request(BASE_URL)
      .get(`/users/${auth.userId}/feed?types=experience`)
      .set('Authorization', `Bearer ${auth.token}`);

    if (feedRes.status !== 200) {
      console.error(`❌ Feed endpoint hatası: ${feedRes.status}`);
      console.error(`   Body: ${JSON.stringify(feedRes.body, null, 2)}`);
    } else {
      const feedItems = feedRes.body.items || [];
      const foundPost = feedItems.find((item: any) => 
        item.id === postId || 
        (item.type === 'experience' && item.data?.id === postId)
      );
      
      console.log(`   Toplam feed item sayısı: ${feedItems.length}`);
      if (foundPost) {
        console.log(`✅ Experience gönderisi feed'de bulundu!`);
        console.log(`   Post ID: ${foundPost.id || foundPost.data?.id}`);
        console.log(`   Type: ${foundPost.type}`);
      } else {
        console.log(`❌ Experience gönderisi feed'de BULUNAMADI!`);
        console.log(`   İlk 3 feed item:`, feedItems.slice(0, 3).map((f: any) => ({ 
          id: f.id || f.data?.id, 
          type: f.type 
        })));
      }
    }
    console.log('');

    // 8. ContentPost tablosundan kontrol et
    console.log('8️⃣ ContentPost tablosundan kontrol ediliyor...');
    const postInDb = await prisma.contentPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        type: true,
        userId: true,
        productId: true,
        createdAt: true,
      },
    });

    if (postInDb) {
      console.log(`✅ Post DB'de bulundu:`);
      console.log(`   ID: ${postInDb.id}`);
      console.log(`   Type: ${postInDb.type}`);
      console.log(`   User ID: ${postInDb.userId}`);
      console.log(`   Product ID: ${postInDb.productId}`);
      console.log(`   Created At: ${postInDb.createdAt}`);
    } else {
      console.log(`❌ Post DB'de bulunamadı!`);
    }

    console.log('');

    console.log('✅ Test tamamlandı!');
  } catch (error) {
    console.error('❌ Test hatası:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script çalıştır
testExperienceFeed();

