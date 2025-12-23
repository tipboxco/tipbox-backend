/**
 * Julia'nın postlarını API üzerinden kontrol et ve feed'e ekle
 * Cache'i temizle
 */

import request from 'supertest';

const BASE_URL = 'http://localhost:3000';

const JULIA_EMAIL = 'julia.havk@tipbox.co';
const JULIA_PASSWORD = 'password123';
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';
const OMER_EMAIL = 'omer@tipbox.co';
const OMER_PASSWORD = 'password123';

async function fixJuliaFeed() {
  console.log('🔍 Julia postları ve Ömer feed kontrolü (API üzerinden)...\n');

  try {
    // 1. Julia için token al
    console.log('🔐 Julia için token alınıyor...');
    const juliaLoginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: JULIA_EMAIL, password: JULIA_PASSWORD });

    if (juliaLoginRes.status !== 200 || !juliaLoginRes.body.token) {
      throw new Error(`Julia login başarısız: ${juliaLoginRes.status}`);
    }

    const juliaToken = juliaLoginRes.body.token;
    console.log('✅ Julia token alındı\n');

    // 2. Julia'nın postlarını bul (kullanıcı profilinden)
    console.log('📝 Julia\'nın postları bulunuyor...');
    const juliaProfileRes = await request(BASE_URL)
      .get(`/users/${JULIA_USER_ID}/feed`)
      .set('Authorization', `Bearer ${juliaToken}`)
      .query({ limit: 10 });

    let juliaPostIds: string[] = [];
    if (juliaProfileRes.status === 200 && juliaProfileRes.body.items) {
      juliaPostIds = juliaProfileRes.body.items
        .map((item: any) => item.data?.id || item.id)
        .filter(Boolean);
      console.log(`✅ Julia'nın ${juliaPostIds.length} postu bulundu`);
      juliaPostIds.forEach((id, index) => {
        console.log(`   ${index + 1}. ${id}`);
      });
    } else {
      console.log('⚠️  Julia postları bulunamadı, yeni post oluşturuluyor...');
      
      // Yeni post oluştur
      const categoriesRes = await request(BASE_URL)
        .get('/catalog/categories')
        .set('Authorization', `Bearer ${juliaToken}`);

      if (categoriesRes.status === 200 && categoriesRes.body && categoriesRes.body.length > 0) {
        const categoryId = categoriesRes.body[0].categoryId || categoriesRes.body[0].id;
        const subCategoriesRes = await request(BASE_URL)
          .get(`/catalog/categories/${categoryId}/sub-categories`)
          .set('Authorization', `Bearer ${juliaToken}`);

        if (subCategoriesRes.status === 200 && subCategoriesRes.body && subCategoriesRes.body.length > 0) {
          const subCategoryId = subCategoriesRes.body[0].subCategoryId || subCategoriesRes.body[0].id;
          
          const createPostRes = await request(BASE_URL)
            .post('/posts/free')
            .set('Authorization', `Bearer ${juliaToken}`)
            .send({
              contextType: 'sub_category',
              contextId: subCategoryId,
              description: `Julia test postu - ${new Date().toISOString()} - Ömer feed testi`,
              images: [],
            });

          if (createPostRes.status === 201 && createPostRes.body.id) {
            juliaPostIds = [createPostRes.body.id];
            console.log(`✅ Yeni post oluşturuldu: ${createPostRes.body.id}`);
          }
        }
      }
    }

    if (juliaPostIds.length === 0) {
      console.log('❌ Julia postu bulunamadı ve oluşturulamadı!');
      return;
    }

    // 3. Ömer için token al
    console.log('\n🔐 Ömer için token alınıyor...');
    const omerLoginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: OMER_EMAIL, password: OMER_PASSWORD });

    if (omerLoginRes.status !== 200 || !omerLoginRes.body.token) {
      throw new Error(`Ömer login başarısız: ${omerLoginRes.status}`);
    }

    const omerToken = omerLoginRes.body.token;
    console.log('✅ Ömer token alındı\n');

    // 4. Ömer'in feed'ini kontrol et
    console.log('🔍 Ömer\'in feed\'i kontrol ediliyor...');
    const feedRes = await request(BASE_URL)
      .get('/feed')
      .set('Authorization', `Bearer ${omerToken}`)
      .query({ limit: 100 });

    if (feedRes.status === 200 && feedRes.body.items) {
      const juliaPostsInFeed = feedRes.body.items.filter((item: any) => {
        const itemPostId = item.data?.id || item.id;
        return juliaPostIds.includes(itemPostId);
      });

      console.log(`Ömer'in feed'inde ${juliaPostsInFeed.length} Julia postu var:`);
      if (juliaPostsInFeed.length === 0) {
        console.log('❌ Ömer\'in feed\'inde Julia postu yok!');
        console.log(`\n⚠️  Feed'e eklenmesi gerekiyor.`);
        console.log(`   - Post ID'leri: ${juliaPostIds.join(', ')}`);
        console.log(`   - Feed'e ekleme işlemi async olarak yapılıyor, birkaç saniye bekleyin.`);
        console.log(`   - Veya backend loglarını kontrol edin.`);
      } else {
        juliaPostsInFeed.forEach((item: any, index: number) => {
          const postId = item.data?.id || item.id;
          const source = item.data?.source || 'N/A';
          console.log(`   ${index + 1}. Post: ${postId} - Source: ${source}`);
        });
      }

      // Feed'deki tüm postları göster
      console.log(`\n📊 Ömer'in feed'indeki ilk 10 post:`);
      feedRes.body.items.slice(0, 10).forEach((item: any, index: number) => {
        const postId = item.data?.id || item.id || 'N/A';
        const userId = item.data?.user?.id || 'N/A';
        const source = item.data?.source || 'N/A';
        const isJulia = userId === JULIA_USER_ID;
        const createdAt = item.data?.createdAt || 'N/A';
        console.log(`   ${index + 1}. ${postId} ${isJulia ? '(JULIA!)' : ''} - Source: ${source} - Created: ${createdAt}`);
      });
    }

    // 5. Cache temizleme önerisi
    console.log(`\n💡 Öneriler:`);
    console.log(`   1. Backend loglarını kontrol edin (feed ekleme işlemi async)`);
    console.log(`   2. Birkaç saniye bekleyip feed'i tekrar kontrol edin`);
    console.log(`   3. Cache temizlemek için: npm run clear-feed-cache`);
    console.log(`   4. Limit'i artırın: /feed?limit=100`);

    console.log(`\n✅ Kontrol tamamlandı!`);

  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  }
}

fixJuliaFeed().catch(console.error);



