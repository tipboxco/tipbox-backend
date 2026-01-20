import { PrismaClient } from '@prisma/client';
import { getAuthToken, makeAuthenticatedRequest, getUserEmails, getUserTokens } from './helpers/api-client.helper';
import { TEST_USER_ID, TRUST_USER_IDS, generateUlid } from '../types';

const prisma = new PrismaClient();

interface PostResult {
  id: string;
  userId: string;
  productId: string;
  joinedEvent: boolean;
}

/**
 * Apple brand'ine ait tüm post'ları sil
 */
async function deleteApplePosts(brandId: string): Promise<number> {
  console.log('🗑️  Apple brand\'ine ait tüm post\'lar siliniyor...');
  
  // Apple brand'ine ait product'ları bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { externalId: true },
  });

  if (!appleBrand || !appleBrand.externalId) {
    throw new Error('Apple brand bulunamadı veya externalId yok');
  }

  // Apple product'larını bul
  const appleProducts = await prisma.product.findMany({
    where: { brandId: appleBrand.externalId },
    select: { id: true },
  });

  const productIds = appleProducts.map((p) => p.id);

  if (productIds.length === 0) {
    console.log('⚠️  Apple product bulunamadı');
    return 0;
  }

  // Bu product'lara ait post'ları sil
  const deletedPosts = await prisma.contentPost.deleteMany({
    where: {
      productId: { in: productIds },
    },
  });

  console.log(`✅ ${deletedPosts.count} post silindi`);
  return deletedPosts.count;
}

/**
 * 5 kullanıcı seç ve token'larını al
 */
async function getTestUsers(): Promise<Array<{ id: string; email: string; token: string; userId: string }>> {
  console.log('\n👥 Test kullanıcıları seçiliyor...');
  
  const allUsers = getUserEmails();
  
  // 5 kullanıcı seç: TEST_USER_ID + 4 TRUST_USER_ID
  const selectedUserIds = [
    TEST_USER_ID,
    ...TRUST_USER_IDS.slice(0, 4),
  ];

  const selectedUsers = allUsers.filter((u) => selectedUserIds.includes(u.id));

  if (selectedUsers.length < 5) {
    throw new Error(`Yeterli kullanıcı bulunamadı. Bulunan: ${selectedUsers.length}, Gerekli: 5`);
  }

  console.log(`✅ ${selectedUsers.length} kullanıcı seçildi:`);
  selectedUsers.forEach((u) => console.log(`   - ${u.email}`));

  // Token'ları al
  const tokenMap = await getUserTokens(selectedUsers);

  const usersWithTokens = selectedUsers
    .map((u) => {
      const auth = tokenMap.get(u.id);
      if (!auth) {
        throw new Error(`${u.email} için token alınamadı`);
      }
      return {
        id: u.id,
        email: u.email,
        token: auth.token,
        userId: auth.userId,
      };
    })
    .slice(0, 5); // İlk 5'i al

  console.log(`✅ ${usersWithTokens.length} kullanıcı için token alındı\n`);
  return usersWithTokens;
}

/**
 * Apple brand'ine ait bir product bul
 */
async function getAppleProduct(brandId: string): Promise<{ id: string; name: string }> {
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { externalId: true },
  });

  if (!appleBrand || !appleBrand.externalId) {
    throw new Error('Apple brand bulunamadı veya externalId yok');
  }

  const product = await prisma.product.findFirst({
    where: { brandId: appleBrand.externalId },
    select: { id: true, name: true },
  });

  if (!product) {
    throw new Error('Apple product bulunamadı');
  }

  return product;
}

/**
 * Apple brand'ine ait bir event bul veya oluştur
 */
async function getOrCreateAppleEvent(brandId: string): Promise<string> {
  // Önce mevcut bir event var mı kontrol et
  const existingEvent = await prisma.wishboxEvent.findFirst({
    where: {
      brandId,
      status: 'PUBLISHED',
    },
    select: { id: true },
  });

  if (existingEvent) {
    console.log(`✅ Mevcut event bulundu: ${existingEvent.id}`);
    return existingEvent.id;
  }

  // Event yoksa oluştur
  console.log('📅 Yeni event oluşturuluyor...');
  
  const mainCategory = await prisma.mainCategory.findFirst({
    where: { name: 'Electronics' },
  });

  if (!mainCategory) {
    throw new Error('Electronics main category bulunamadı');
  }

  const newEvent = await prisma.wishboxEvent.create({
    data: {
      id: generateUlid(),
      title: 'Apple Ürünleri Deneyim Paylaşımı',
      description: 'Apple ürünleriniz hakkında deneyimlerinizi paylaşın',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün sonra
      brandId,
      mainCategoryId: mainCategory.id,
      status: 'PUBLISHED',
    },
  });

  console.log(`✅ Yeni event oluşturuldu: ${newEvent.id}`);
  return newEvent.id;
}

/**
 * Kullanıcıyı event'e join et
 */
async function joinEvent(userToken: string, eventId: string): Promise<boolean> {
  const result = await makeAuthenticatedRequest('POST', `/events/${eventId}/join`, userToken);
  return result !== null;
}

/**
 * Free post oluştur
 */
async function createFreePost(
  userToken: string,
  productId: string,
  description: string,
  eventId?: string
): Promise<string | null> {
  const payload: any = {
    contextType: 'product',
    contextId: productId,
    description,
  };

  if (eventId) {
    payload.eventId = eventId;
  }

  const result = await makeAuthenticatedRequest(
    'POST',
    '/posts/free',
    userToken,
    payload
  );

  return result?.id || null;
}

/**
 * Post'a interaction ekle
 */
async function addInteraction(
  type: 'like' | 'comment' | 'share' | 'favorite',
  userToken: string,
  postId: string,
  commentText?: string
): Promise<boolean> {
  let endpoint = '';
  let data: any = {};

  switch (type) {
    case 'like':
      endpoint = `/interactions/posts/${postId}/like`;
      break;
    case 'comment':
      endpoint = `/interactions/posts/${postId}/comment`;
      data = { comment: commentText || 'Harika bir gönderi!' };
      break;
    case 'share':
      endpoint = `/interactions/posts/${postId}/share`;
      data = { shareType: 'INTERNAL_REPOST' };
      break;
    case 'favorite':
      endpoint = `/interactions/posts/${postId}/favorite`;
      break;
  }

  const result = await makeAuthenticatedRequest('POST', endpoint, userToken, data);
  return result !== null;
}

/**
 * Ana test fonksiyonu
 */
export async function seedAppleTrendsTest(brandId: string): Promise<{
  deletedPosts: number;
  createdPosts: PostResult[];
  interactions: {
    postId: string;
    likes: number;
    comments: number;
    shares: number;
    favorites: number;
  }[];
}> {
  console.log('\n🧪 Apple Trends Test Seed Başlatılıyor...\n');

  // 1. Apple post'larını sil
  const deletedPosts = await deleteApplePosts(brandId);

  // 2. Test kullanıcılarını al
  const testUsers = await getTestUsers();

  // 3. Apple product bul
  const appleProduct = await getAppleProduct(brandId);
  console.log(`✅ Product seçildi: ${appleProduct.name} (${appleProduct.id})\n`);

  // 4. Event bul veya oluştur
  const eventId = await getOrCreateAppleEvent(brandId);
  console.log(`✅ Event hazır: ${eventId}\n`);

  // 5. Post'ları oluştur
  console.log('📝 Post\'lar oluşturuluyor...\n');

  const postDescriptions = [
    'iPhone 17 Pro ile harika bir deneyim yaşıyorum! Kamera kalitesi gerçekten etkileyici.',
    'MacBook Air M3 performansı beni şaşırttı. Günlük kullanım için mükemmel.',
    'iPad Pro ile çalışmak çok keyifli. Apple Pencil ile not alma deneyimi harika.',
    'Apple Watch Series 10 sağlık takibi için çok faydalı. Spor yaparken vazgeçilmez.',
    'AirPods Pro 3. nesil ses kalitesi ve gürültü önleme özelliği ile beni büyüledi.',
  ];

  const createdPosts: PostResult[] = [];

  // İlk 2 kullanıcı: Join olmadan post oluştur
  for (let i = 0; i < 2; i++) {
    const user = testUsers[i];
    console.log(`📝 [${i + 1}/5] ${user.email} - Join olmadan post oluşturuluyor...`);

    const postId = await createFreePost(
      user.token,
      appleProduct.id,
      postDescriptions[i]
    );

    if (postId) {
      createdPosts.push({
        id: postId,
        userId: user.userId,
        productId: appleProduct.id,
        joinedEvent: false,
      });
      console.log(`   ✅ Post oluşturuldu: ${postId}`);
    } else {
      console.log(`   ❌ Post oluşturulamadı`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms bekle
  }

  // Son 3 kullanıcı: Join olup post oluştur
  for (let i = 2; i < 5; i++) {
    const user = testUsers[i];
    console.log(`📝 [${i + 1}/5] ${user.email} - Event'e join olunuyor...`);

    const joined = await joinEvent(user.token, eventId);
    if (joined) {
      console.log(`   ✅ Event'e join olundu`);
    } else {
      console.log(`   ⚠️  Event'e join olunamadı, yine de post oluşturulacak`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log(`   📝 Post oluşturuluyor...`);
    const postId = await createFreePost(
      user.token,
      appleProduct.id,
      postDescriptions[i],
      eventId // Event ID'yi post'a ekle
    );

    if (postId) {
      createdPosts.push({
        id: postId,
        userId: user.userId,
        productId: appleProduct.id,
        joinedEvent: true,
      });
      console.log(`   ✅ Post oluşturuldu: ${postId}`);
    } else {
      console.log(`   ❌ Post oluşturulamadı`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`\n✅ ${createdPosts.length} post oluşturuldu\n`);

  // 6. Interaction'ları ekle
  console.log('💬 Interaction\'lar ekleniyor...\n');

  // Tüm kullanıcıların token'larını al (interaction için)
  const allUserTokens = await getUserTokens(getUserEmails());
  const interactionUsers = Array.from(allUserTokens.values());

  const interactionStats: Array<{
    postId: string;
    likes: number;
    comments: number;
    shares: number;
    favorites: number;
  }> = [];

  // Her post için interaction ekle
  for (let i = 0; i < createdPosts.length; i++) {
    const post = createdPosts[i];
    const postIndex = i + 1;

    // 1. post: En fazla interaction (50-70 interaction)
    // 5. post: En az interaction (5-10 interaction)
    // Araları: Rastgele (15-40 interaction)
    let targetInteractions = 0;
    if (postIndex === 1) {
      targetInteractions = 60; // En fazla
    } else if (postIndex === 5) {
      targetInteractions = 8; // En az
    } else {
      targetInteractions = 15 + Math.floor(Math.random() * 25); // 15-40 arası
    }

    console.log(`💬 [${postIndex}/5] Post ${post.id} - ${targetInteractions} interaction hedefleniyor...`);

    let likes = 0;
    let comments = 0;
    let shares = 0;
    let favorites = 0;

    // Interaction'ları rastgele kullanıcılara dağıt
    const shuffledUsers = interactionUsers.sort(() => Math.random() - 0.5);
    const usersToInteract = shuffledUsers.slice(0, Math.min(targetInteractions, shuffledUsers.length));

    for (const userAuth of usersToInteract) {
      // Post sahibi kendi post'una interaction yapmasın
      if (userAuth.userId === post.userId) {
        continue;
      }

      const chance = Math.random();

      // Like: %80
      if (chance < 0.8) {
        const success = await addInteraction('like', userAuth.token, post.id);
        if (success) likes++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Comment: %50
      if (chance < 0.5) {
        const commentTexts = [
          'Harika bir gönderi!',
          'Çok bilgilendirici, teşekkürler!',
          'Aynı deneyimi yaşadım.',
          'Çok faydalı bilgiler.',
          'Kesinlikle katılıyorum!',
        ];
        const success = await addInteraction(
          'comment',
          userAuth.token,
          post.id,
          commentTexts[Math.floor(Math.random() * commentTexts.length)]
        );
        if (success) comments++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Share: %30
      if (chance < 0.3) {
        const success = await addInteraction('share', userAuth.token, post.id);
        if (success) shares++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Favorite: %40
      if (chance < 0.4) {
        const success = await addInteraction('favorite', userAuth.token, post.id);
        if (success) favorites++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    interactionStats.push({
      postId: post.id,
      likes,
      comments,
      shares,
      favorites,
    });

    console.log(`   ✅ ${likes} likes, ${comments} comments, ${shares} shares, ${favorites} favorites`);
  }

  console.log('\n✅ Tüm interaction\'lar eklendi\n');

  // 7. Test endpoint'lerini çağır
  console.log('🧪 Test endpoint\'leri çağrılıyor...\n');

  // Ömer'in token'ını al
  const omerToken = testUsers.find((u) => u.id === TEST_USER_ID)?.token;
  if (omerToken) {
    // GET /brands/{brandId}/trends
    console.log('📊 GET /brands/{brandId}/trends çağrılıyor...');
    const trendsResult = await makeAuthenticatedRequest(
      'GET',
      `/brands/${brandId}/trends?limit=10`,
      omerToken
    );

    if (trendsResult?.items) {
      console.log(`   ✅ ${trendsResult.items.length} trend post bulundu\n`);
      trendsResult.items.slice(0, 5).forEach((item: any, index: number) => {
        const postData = item.data || item;
        const stats = postData.stats || {};
        console.log(`   ${index + 1}. Post ID: ${postData.id || 'N/A'}`);
        console.log(`      User: ${postData.user?.name || 'N/A'}`);
        console.log(`      Likes: ${stats.likes || 0}, Comments: ${stats.comments || 0}, Shares: ${stats.shares || 0}, Bookmarks: ${stats.bookmarks || 0}`);
        console.log(`      Content: ${(postData.content || '').substring(0, 50)}...`);
        console.log(`      Created: ${postData.createdAt || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  Trends endpoint boş döndü');
      console.log('   Response:', JSON.stringify(trendsResult, null, 2));
    }

    // GET /brands/{brandId}/groups
    console.log('\n📊 GET /brands/{brandId}/groups çağrılıyor...');
    const groupsResult = await makeAuthenticatedRequest(
      'GET',
      `/brands/${brandId}/groups?limit=20`,
      omerToken
    );

    if (groupsResult?.items) {
      console.log(`   ✅ ${groupsResult.items.length} product group bulundu`);
      const totalProducts = groupsResult.items.reduce(
        (sum: number, group: any) => sum + (group.products?.length || 0),
        0
      );
      console.log(`   ✅ Toplam ${totalProducts} product bulundu`);
    } else {
      console.log('   ⚠️  Groups endpoint boş döndü');
    }
  }

  console.log('\n✅ Test tamamlandı!\n');

  return {
    deletedPosts,
    createdPosts,
    interactions: interactionStats,
  };
}
