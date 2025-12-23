/**
 * Julia kullanıcısı için post oluştur ve Ömer'in feed'inde olup olmadığını kontrol et
 * Swagger'da görmek için post silinmiyor
 */

import request from 'supertest';

const BASE_URL = 'http://localhost:3000';

const JULIA_EMAIL = 'julia.havk@tipbox.co';
const JULIA_PASSWORD = 'password123';
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';
const OMER_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function testJuliaPostOmerFeed() {
  console.log('🧪 Julia post oluşturma ve Ömer feed kontrolü testi başlıyor...\n');

  try {
    // 1. Julia için auth token al
    console.log('🔐 Julia için auth token alınıyor...');
    const loginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: JULIA_EMAIL, password: JULIA_PASSWORD });

    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error(`Julia login başarısız: ${loginRes.status} - ${JSON.stringify(loginRes.body)}`);
    }

    const juliaToken = loginRes.body.token;
    const juliaUserId = loginRes.body.id || loginRes.body.userId || JULIA_USER_ID;
    console.log(`✅ Julia auth token alındı - User ID: ${juliaUserId}\n`);

    // 2. Bir sub_category bul (API'den)
    console.log('📂 Sub category bulunuyor...');
    
    // Önce kategorileri al
    const categoriesRes = await request(BASE_URL)
      .get('/catalog/categories')
      .set('Authorization', `Bearer ${juliaToken}`);

    if (categoriesRes.status !== 200 || !categoriesRes.body || categoriesRes.body.length === 0) {
      throw new Error('Kategoriler bulunamadı!');
    }

    const firstCategory = categoriesRes.body[0];
    const categoryId = firstCategory.categoryId || firstCategory.id;
    console.log(`   - İlk kategori bulundu: ${firstCategory.name} (${categoryId})\n`);

    // Sub kategorileri al
    const subCategoriesRes = await request(BASE_URL)
      .get(`/catalog/categories/${categoryId}/sub-categories`)
      .set('Authorization', `Bearer ${juliaToken}`);

    if (subCategoriesRes.status !== 200 || !subCategoriesRes.body || subCategoriesRes.body.length === 0) {
      throw new Error('Sub kategoriler bulunamadı!');
    }

    const subCategory = subCategoriesRes.body[0];
    const subCategoryId = subCategory.subCategoryId || subCategory.id;
    console.log(`✅ Sub category bulundu: ${subCategory.name} (${subCategoryId})\n`);

    // 3. Post oluştur
    console.log('📝 Post oluşturuluyor...');
    const postDescription = `Julia Havk test postu - ${new Date().toISOString()} - Ömer feed testi için oluşturuldu.`;
    
    const createPostRes = await request(BASE_URL)
      .post('/posts/free')
      .set('Authorization', `Bearer ${juliaToken}`)
      .send({
        contextType: 'sub_category',
        contextId: subCategoryId,
        description: postDescription,
        images: [],
      });

    if (createPostRes.status !== 201 || !createPostRes.body.id) {
      throw new Error(`Post oluşturma başarısız: ${createPostRes.status} - ${JSON.stringify(createPostRes.body)}`);
    }

    const postId = createPostRes.body.id;
    console.log(`✅ Post oluşturuldu - Post ID: ${postId}\n`);

    // 4. Post'un API'den kontrol edilmesi (veritabanı bağlantısı olmayabilir)
    console.log('🔍 Post API\'den kontrol ediliyor...');
    const postCheckRes = await request(BASE_URL)
      .get(`/posts/${postId}`)
      .set('Authorization', `Bearer ${juliaToken}`);

    if (postCheckRes.status === 200) {
      console.log(`✅ Post API'den bulundu:`);
      console.log(`   - ID: ${postCheckRes.body.id || postId}`);
      console.log(`   - User ID: ${postCheckRes.body.userId || 'N/A'}`);
      console.log(`   - Created At: ${postCheckRes.body.createdAt || 'N/A'}`);
      console.log(`   - Body: ${(postCheckRes.body.body || postCheckRes.body.description || '').substring(0, 100)}...\n`);
    } else {
      console.log(`⚠️  Post API'den kontrol edilemedi (status: ${postCheckRes.status})\n`);
    }

    // 5. Feed'e eklenmesi için kısa bir bekleme (async işlem olabilir)
    console.log('⏳ Feed ekleme işlemi için bekleniyor (3 saniye)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. Ömer'in feed endpoint'inden kontrol et
    console.log(`\n🌐 Ömer'in feed endpoint'inden kontrol ediliyor...`);
    const omerLoginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: 'omer@tipbox.co', password: 'password123' });

    if (omerLoginRes.status === 200 && omerLoginRes.body.token) {
      const omerToken = omerLoginRes.body.token;
      const feedRes = await request(BASE_URL)
        .get('/feed')
        .set('Authorization', `Bearer ${omerToken}`)
        .query({ limit: 50 });

      if (feedRes.status === 200 && feedRes.body.items) {
        const postInFeed = feedRes.body.items.find((item: any) => {
          const itemPostId = item.data?.id || item.id || item.postId;
          return itemPostId === postId;
        });

        if (postInFeed) {
          console.log(`✅ BAŞARILI: Post Ömer'in feed endpoint'inde bulundu!`);
          console.log(`   - Feed item type: ${postInFeed.type || 'N/A'}`);
          console.log(`   - Post ID: ${postInFeed.data?.id || postInFeed.id || 'N/A'}`);
          console.log(`   - Source: ${postInFeed.data?.source || postInFeed.source || 'N/A'}`);
        } else {
          console.log(`❌ BAŞARISIZ: Post Ömer'in feed endpoint'inde bulunamadı`);
          console.log(`   - Feed'deki toplam item sayısı: ${feedRes.body.items.length}`);
          
          // İlk 5 feed item'ını göster
          console.log(`   - İlk 5 feed item:`);
          feedRes.body.items.slice(0, 5).forEach((item: any, index: number) => {
            const itemPostId = item.data?.id || item.id || item.postId || 'N/A';
            const itemUserId = item.data?.userId || item.userId || 'N/A';
            const isJuliaPost = itemUserId === juliaUserId;
            console.log(`     ${index + 1}. Post ID: ${itemPostId} ${isJuliaPost ? '(Julia postu!)' : ''}`);
          });
        }
      } else {
        console.log(`⚠️  Feed endpoint yanıtı beklenmedik format: ${feedRes.status}`);
      }
    } else {
      console.log(`⚠️  Ömer login başarısız: ${omerLoginRes.status}`);
    }

    console.log(`\n✅ Test tamamlandı! Post ID: ${postId}`);
    console.log(`📝 Not: Post silinmedi, Swagger'da kontrol edebilirsiniz.`);

  } catch (error) {
    console.error('❌ Test hatası:', error);
    throw error;
  }
}

testJuliaPostOmerFeed().catch(console.error);



