import { prisma, TEST_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } from '../types';
import { getAuthToken, makeAuthenticatedRequest, getUserTokens, getUserEmails } from './helpers/api-client.helper';

/**
 * Apple interactions oluştur - TÜM etkileşimler endpoint'ler üzerinden
 * Her kullanıcı ayrı ayrı token alıp kendi etkileşimlerini oluşturur
 */
export async function seedAppleInteractions(brandId: string): Promise<{
  postInteractions: {
    likes: number;
    comments: number;
    shares: number;
    favorites: number;
  };
  newsInteractions: {
    likes: number;
    comments: number;
    shares: number;
    favorites: number;
  };
}> {
  console.log('💬 [seed] Apple interactions (Endpoint-Based)');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // Apple post'ları bul (sadece okuma - Prisma ile)
  // Product.brandId Brand.externalId'ye referans veriyor
  const applePosts = await prisma.contentPost.findMany({
    where: {
      product: {
        brandId: appleBrand.externalId,
      },
    },
    take: 50, // İlk 50 post'u al
  });

  // Apple news'leri bul (sadece okuma - Prisma ile)
  const appleNews = await prisma.news.findMany({
    where: {
      brandId: brandId,
    },
    take: 10,
  });

  if (applePosts.length === 0 && appleNews.length === 0) {
    console.warn('⚠️  No Apple posts or news found. Skipping interactions.');
    return {
      postInteractions: { likes: 0, comments: 0, shares: 0, favorites: 0 },
      newsInteractions: { likes: 0, comments: 0, shares: 0, favorites: 0 },
    };
  }

  // Gerçek kullanıcı email'lerini al
  const users = getUserEmails();

  // Tüm kullanıcılar için token'ları al
  const tokenMap = await getUserTokens(users);

  if (tokenMap.size === 0) {
    throw new Error('No auth tokens obtained. Please check user credentials.');
  }

  // Ömer kullanıcısını öncelikli olarak al
  const omerToken = tokenMap.get(TEST_USER_ID);
  if (!omerToken) {
    throw new Error('Ömer kullanıcısı için token alınamadı!');
  }

  let postLikesCount = 0;
  let postCommentsCount = 0;
  let postSharesCount = 0;
  let postFavoritesCount = 0;

  let newsLikesCount = 0;
  let newsCommentsCount = 0;
  let newsSharesCount = 0;
  let newsFavoritesCount = 0;

  // Post interactions - Her kullanıcı ayrı ayrı etkileşimde bulunur
  console.log(`\n📝 Post interactions oluşturuluyor (${applePosts.length} post, ${tokenMap.size} kullanıcı)...`);

  const postCommentTexts = [
    'Great post! Thanks for sharing.',
    'I have a similar experience with this product.',
    'Very helpful information, appreciate it!',
    'This is exactly what I was looking for.',
    'Interesting perspective, thanks!',
    'I agree with your points here.',
    'Good review, helped me make a decision.',
    'Thanks for the detailed explanation.',
    'This is really useful, bookmarked!',
    'I learned something new today.',
  ];

  // Her kullanıcı için etkileşimler oluştur
  for (const [userId, authResult] of tokenMap.entries()) {
    const user = users.find(u => u.id === userId);
    if (!user) continue;

    const token = authResult.token;
    const isOmer = userId === TEST_USER_ID;

    // Ömer için daha fazla etkileşim
    const maxInteractions = isOmer ? applePosts.length : Math.floor(applePosts.length * 0.6);
    const postsToInteract = applePosts
      .filter(post => post.userId !== userId) // Kendi postunu etkileşimde bulunma
      .sort(() => Math.random() - 0.5)
      .slice(0, maxInteractions);

    console.log(`  👤 ${user.email}: ${postsToInteract.length} post ile etkileşimde bulunuyor...`);

    for (const post of postsToInteract) {
      // Ömer için: Her post'a TÜM etkileşimleri yap (like, comment, share, favorite)
      // Diğer kullanıcılar için: Rastgele kombinasyonlar
      const interactionChance = Math.random();
      const shouldDoAllInteractions = isOmer;

      // Like (Ömer için her zaman, diğerleri için %80)
      if (shouldDoAllInteractions || interactionChance < 0.8) {
        const result = await makeAuthenticatedRequest(
          'POST',
          `/interactions/posts/${post.id}/like`,
          token
        );
        if (result) postLikesCount++;
      }

      // Comment (Ömer için her zaman, diğerleri için %50)
      if (shouldDoAllInteractions || interactionChance < 0.5) {
        const commentText = postCommentTexts[Math.floor(Math.random() * postCommentTexts.length)];
        const result = await makeAuthenticatedRequest(
          'POST',
          `/interactions/posts/${post.id}/comments`,
          token,
          { comment: commentText }
        );
        if (result) postCommentsCount++;
      }

      // Share (Ömer için her zaman, diğerleri için %30)
      if (shouldDoAllInteractions || interactionChance < 0.3) {
        try {
          const shareType = Math.random() > 0.5 ? 'INTERNAL_REPOST' : 'EXTERNAL_SHARE';
          const platform = shareType === 'EXTERNAL_SHARE' 
            ? (Math.random() > 0.5 ? 'Twitter' : 'Facebook')
            : undefined;
          const result = await makeAuthenticatedRequest(
            'POST',
            `/interactions/posts/${post.id}/share`,
            token,
            { shareType, platform }
          );
          if (result) postSharesCount++;
        } catch (error) {
          // Share endpoint'inde sorun olabilir, atla
          console.warn(`    ⚠️  Post share hatası (${post.id}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Favorite/Bookmark (Ömer için her zaman, diğerleri için %40)
      if (shouldDoAllInteractions || interactionChance < 0.4) {
        const result = await makeAuthenticatedRequest(
          'POST',
          `/interactions/posts/${post.id}/bookmark`,
          token
        );
        if (result) postFavoritesCount++;
      }

      // Rate limiting için delay ekle
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`  ✅ Post interactions: ${postLikesCount} likes, ${postCommentsCount} comments, ${postSharesCount} shares, ${postFavoritesCount} favorites`);

  // News interactions - Her kullanıcı ayrı ayrı etkileşimde bulunur
  console.log(`\n📰 News interactions oluşturuluyor (${appleNews.length} news, ${tokenMap.size} kullanıcı)...`);

  const newsCommentTexts = [
    'Great article! Very informative.',
    'Thanks for sharing this news.',
    'This is really interesting, thanks!',
    'I learned something new today.',
    'Excellent coverage of the topic.',
    'Looking forward to more updates.',
    'This is helpful information.',
    'Thanks for keeping us informed.',
    'This is exactly what I needed to know.',
    'Very well written article.',
  ];

  // Her kullanıcı için news etkileşimleri oluştur
  for (const [userId, authResult] of tokenMap.entries()) {
    const user = users.find(u => u.id === userId);
    if (!user) continue;

    const token = authResult.token;
    const isOmer = userId === TEST_USER_ID;

    // Ömer için daha fazla etkileşim
    const maxInteractions = isOmer ? appleNews.length : Math.floor(appleNews.length * 0.7);
    const newsToInteract = appleNews
      .sort(() => Math.random() - 0.5)
      .slice(0, maxInteractions);

    console.log(`  👤 ${user.email}: ${newsToInteract.length} news ile etkileşimde bulunuyor...`);

    for (const news of newsToInteract) {
      // Ömer için: Her news'e TÜM etkileşimleri yap (like, comment, share, favorite)
      // Diğer kullanıcılar için: Rastgele kombinasyonlar
      const interactionChance = Math.random();
      const shouldDoAllInteractions = isOmer;

      // Like (Ömer için her zaman, diğerleri için %85)
      if (shouldDoAllInteractions || interactionChance < 0.85) {
        const result = await makeAuthenticatedRequest(
          'POST',
          `/news/${news.id}/like`,
          token
        );
        if (result) newsLikesCount++;
      }

      // Comment (Ömer için her zaman, diğerleri için %55)
      if (shouldDoAllInteractions || interactionChance < 0.55) {
        const commentText = newsCommentTexts[Math.floor(Math.random() * newsCommentTexts.length)];
        try {
          const result = await makeAuthenticatedRequest(
            'POST',
            `/news/${news.id}/comment`,
            token,
            { comment: commentText }
          );
          if (result) newsCommentsCount++;
        } catch (error) {
          // News comment endpoint'inde sorun olabilir, atla
          console.warn(`    ⚠️  News comment hatası (${news.id}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Share (Ömer için her zaman, diğerleri için %35)
      if (shouldDoAllInteractions || interactionChance < 0.35) {
        try {
          const shareType = Math.random() > 0.5 ? 'INTERNAL_REPOST' : 'EXTERNAL_SHARE';
          const platform = shareType === 'EXTERNAL_SHARE'
            ? (Math.random() > 0.5 ? 'Twitter' : 'LinkedIn')
            : undefined;
          const result = await makeAuthenticatedRequest(
            'POST',
            `/news/${news.id}/share`,
            token,
            { shareType, platform }
          );
          if (result) newsSharesCount++;
        } catch (error) {
          // Share endpoint'inde sorun olabilir, atla
          console.warn(`    ⚠️  News share hatası (${news.id}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Favorite (Ömer için her zaman, diğerleri için %45)
      if (shouldDoAllInteractions || interactionChance < 0.45) {
        const result = await makeAuthenticatedRequest(
          'POST',
          `/news/${news.id}/favorite`,
          token
        );
        if (result) newsFavoritesCount++;
      }

      // Kısa bir delay ekle
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log(`  ✅ News interactions: ${newsLikesCount} likes, ${newsCommentsCount} comments, ${newsSharesCount} shares, ${newsFavoritesCount} favorites`);

  console.log(`\n✅ Toplam interactions oluşturuldu (Endpoint-Based)`);

  return {
    postInteractions: {
      likes: postLikesCount,
      comments: postCommentsCount,
      shares: postSharesCount,
      favorites: postFavoritesCount,
    },
    newsInteractions: {
      likes: newsLikesCount,
      comments: newsCommentsCount,
      shares: newsSharesCount,
      favorites: newsFavoritesCount,
    },
  };
}
