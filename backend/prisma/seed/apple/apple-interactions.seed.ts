import { prisma, generateUlid, TRUST_USER_IDS } from '../types';
import { randomUUID } from 'crypto';

/**
 * Apple interactions oluştur - Post ve news için likes, comments, shares, favorites
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
  console.log('💬 [seed] Apple interactions');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // Apple post'ları bul
  const applePosts = await prisma.contentPost.findMany({
    where: {
      product: {
        brandId: appleBrand.externalId,
      },
    },
    take: 50, // İlk 50 post'u al
  });

  // Apple news'leri bul
  const appleNews = await prisma.news.findMany({
    where: {
      brandId: brandId,
    },
    take: 10,
  });

  // Tüm kullanıcıları al (interaction yapacak kullanıcılar)
  const allUsers = await prisma.user.findMany({
    take: 30, // İlk 30 kullanıcıyı al
  });

  if (allUsers.length === 0) {
    throw new Error('No users found. Please run user seed first.');
  }

  let postLikesCount = 0;
  let postCommentsCount = 0;
  let postSharesCount = 0;
  let postFavoritesCount = 0;

  let newsLikesCount = 0;
  let newsCommentsCount = 0;
  let newsSharesCount = 0;
  let newsFavoritesCount = 0;

  // Post interactions
  console.log(`\n📝 Post interactions oluşturuluyor (${applePosts.length} post)...`);

  for (const post of applePosts) {
    // Her post için farklı sayıda interaction (rastgele ama gerçekçi)
    const likeCount = Math.floor(Math.random() * 15) + 5; // 5-20 arası
    const commentCount = Math.floor(Math.random() * 8) + 2; // 2-10 arası
    const shareCount = Math.floor(Math.random() * 5) + 1; // 1-6 arası
    const favoriteCount = Math.floor(Math.random() * 10) + 3; // 3-13 arası

    // Likes
    const usersForLikes = allUsers
      .sort(() => Math.random() - 0.5)
      .slice(0, likeCount)
      .filter((u) => u.id !== post.userId); // Post sahibi kendi postunu beğenemez

    for (const user of usersForLikes) {
      try {
        await prisma.contentLike.create({
          data: {
            userId: user.id,
            postId: post.id,
          },
        });
        postLikesCount++;
      } catch (e) {
        // Zaten beğenilmiş olabilir
      }
    }

    // Comments
    const usersForComments = allUsers
      .sort(() => Math.random() - 0.5)
      .slice(0, commentCount)
      .filter((u) => u.id !== post.userId);

    const commentTexts = [
      'Great post! Thanks for sharing.',
      'I have a similar experience with this product.',
      'Very helpful information, appreciate it!',
      'This is exactly what I was looking for.',
      'Interesting perspective, thanks!',
      'I agree with your points here.',
      'Good review, helped me make a decision.',
      'Thanks for the detailed explanation.',
    ];

    for (const user of usersForComments) {
      try {
        const commentId = generateUlid();
        await prisma.contentComment.create({
          data: {
            id: commentId,
            postId: post.id,
            userId: user.id,
            comment: commentTexts[Math.floor(Math.random() * commentTexts.length)],
            isAnswer: false,
          },
        });
        postCommentsCount++;
      } catch (e) {
        // Hata olabilir
      }
    }

    // Shares
    const usersForShares = allUsers
      .sort(() => Math.random() - 0.5)
      .slice(0, shareCount)
      .filter((u) => u.id !== post.userId);

    for (const user of usersForShares) {
      try {
        await prisma.contentShare.create({
          data: {
            userId: user.id,
            postId: post.id,
            shareType: Math.random() > 0.5 ? 'INTERNAL_REPOST' : 'EXTERNAL_SHARE',
            platform: Math.random() > 0.5 ? 'Twitter' : 'Facebook',
          },
        });
        postSharesCount++;
      } catch (e) {
        // Zaten paylaşılmış olabilir
      }
    }

    // Favorites
    const usersForFavorites = allUsers
      .sort(() => Math.random() - 0.5)
      .slice(0, favoriteCount)
      .filter((u) => u.id !== post.userId);

    for (const user of usersForFavorites) {
      try {
        await prisma.contentFavorite.create({
          data: {
            userId: user.id,
            postId: post.id,
          },
        });
        postFavoritesCount++;
      } catch (e) {
        // Zaten favorilere eklenmiş olabilir
      }
    }
  }

  // Post count'ları güncelle
  for (const post of applePosts) {
    const [likes, comments, shares, favorites] = await Promise.all([
      prisma.contentLike.count({ where: { postId: post.id } }),
      prisma.contentComment.count({ where: { postId: post.id } }),
      prisma.contentShare.count({ where: { postId: post.id } }),
      prisma.contentFavorite.count({ where: { postId: post.id } }),
    ]);

    await prisma.contentPost.update({
      where: { id: post.id },
      data: {
        likesCount: likes,
        commentsCount: comments,
        sharesCount: shares,
        favoritesCount: favorites,
      },
    });
  }

  console.log(`  ✅ Post interactions: ${postLikesCount} likes, ${postCommentsCount} comments, ${postSharesCount} shares, ${postFavoritesCount} favorites`);

  // News interactions
  console.log(`\n📰 News interactions oluşturuluyor (${appleNews.length} news)...`);

  for (const news of appleNews) {
    // Her news için farklı sayıda interaction
    const likeCount = Math.floor(Math.random() * 20) + 10; // 10-30 arası
    const commentCount = Math.floor(Math.random() * 12) + 3; // 3-15 arası
    const shareCount = Math.floor(Math.random() * 8) + 2; // 2-10 arası
    const favoriteCount = Math.floor(Math.random() * 15) + 5; // 5-20 arası

    // Likes
    const usersForLikes = allUsers.sort(() => Math.random() - 0.5).slice(0, likeCount);

    for (const user of usersForLikes) {
      try {
        await prisma.newsLike.create({
          data: {
            userId: user.id,
            newsId: news.id,
          },
        });
        newsLikesCount++;
      } catch (e) {
        // Zaten beğenilmiş olabilir
      }
    }

    // Comments
    const usersForComments = allUsers.sort(() => Math.random() - 0.5).slice(0, commentCount);

    const newsCommentTexts = [
      'Great article! Very informative.',
      'Thanks for sharing this news.',
      'This is really interesting, thanks!',
      'I learned something new today.',
      'Excellent coverage of the topic.',
      'Looking forward to more updates.',
      'This is helpful information.',
      'Thanks for keeping us informed.',
    ];

    for (const user of usersForComments) {
      try {
        const commentId = generateUlid();
        await prisma.newsComment.create({
          data: {
            id: commentId,
            newsId: news.id,
            userId: user.id,
            comment: newsCommentTexts[Math.floor(Math.random() * newsCommentTexts.length)],
          },
        });
        newsCommentsCount++;
      } catch (e) {
        // Hata olabilir
      }
    }

    // Shares
    const usersForShares = allUsers.sort(() => Math.random() - 0.5).slice(0, shareCount);

    for (const user of usersForShares) {
      try {
        await prisma.newsShare.create({
          data: {
            userId: user.id,
            newsId: news.id,
            shareType: Math.random() > 0.5 ? 'INTERNAL_REPOST' : 'EXTERNAL_SHARE',
            platform: Math.random() > 0.5 ? 'Twitter' : 'LinkedIn',
          },
        });
        newsSharesCount++;
      } catch (e) {
        // Zaten paylaşılmış olabilir
      }
    }

    // Favorites
    const usersForFavorites = allUsers.sort(() => Math.random() - 0.5).slice(0, favoriteCount);

    for (const user of usersForFavorites) {
      try {
        await prisma.newsFavorite.create({
          data: {
            userId: user.id,
            newsId: news.id,
          },
        });
        newsFavoritesCount++;
      } catch (e) {
        // Zaten favorilere eklenmiş olabilir
      }
    }
  }

  // News count'ları güncelle
  for (const news of appleNews) {
    const [likes, comments, shares, favorites] = await Promise.all([
      prisma.newsLike.count({ where: { newsId: news.id } }),
      prisma.newsComment.count({ where: { newsId: news.id } }),
      prisma.newsShare.count({ where: { newsId: news.id } }),
      prisma.newsFavorite.count({ where: { newsId: news.id } }),
    ]);

    await prisma.news.update({
      where: { id: news.id },
      data: {
        likesCount: likes,
        commentsCount: comments,
        sharesCount: shares,
        favoritesCount: favorites,
      },
    });
  }

  console.log(`  ✅ News interactions: ${newsLikesCount} likes, ${newsCommentsCount} comments, ${newsSharesCount} shares, ${newsFavoritesCount} favorites`);

  console.log(`\n✅ Toplam interactions oluşturuldu`);

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
