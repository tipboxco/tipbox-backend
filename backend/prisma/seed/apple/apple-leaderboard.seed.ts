import { prisma } from '../types';
import { randomUUID } from 'crypto';

/**
 * Apple leaderboard verileri oluştur
 * Trend scoring: likes (1), comments (3), saves (2), shares (2)
 */
export async function seedAppleLeaderboard(brandId: string): Promise<{
  leaderboards: Array<{ userId: string; period: string; rank: number; score: number }>;
}> {
  console.log('🏆 [seed] Apple leaderboard');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // Apple post'ları bul ve kullanıcı istatistiklerini hesapla
  const applePosts = await prisma.contentPost.findMany({
    where: {
      product: {
        brandId: appleBrand.externalId,
      },
    },
    include: {
      likes: true,
      comments: true,
      shares: true,
      favorites: true,
      user: true,
    },
  });

  // Kullanıcı bazında score hesapla
  const userScores = new Map<string, number>();

  for (const post of applePosts) {
    const userId = post.userId;
    const currentScore = userScores.get(userId) || 0;

    // Trend scoring: likes (1), comments (3), saves (2), shares (2)
    const likesScore = post.likes.length * 1;
    const commentsScore = post.comments.length * 3;
    const favoritesScore = post.favorites.length * 2; // saves = favorites
    const sharesScore = post.shares.length * 2;

    const postScore = likesScore + commentsScore + favoritesScore + sharesScore;
    userScores.set(userId, currentScore + postScore);
  }

  // News interactions için de score ekle
  const appleNews = await prisma.news.findMany({
    where: {
      brandId: brandId,
    },
    include: {
      likes: true,
      comments: true,
      shares: true,
      favorites: true,
    },
  });

  // News'ler kullanıcı tarafından oluşturulmadığı için news interactions'ı post sahiplerine eklemiyoruz
  // Ama eğer news'e yorum yapan kullanıcılara da puan vermek istersek, burada ekleyebiliriz

  // Score'a göre sırala
  const sortedUsers = Array.from(userScores.entries())
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20); // Top 20 kullanıcı

  const createdLeaderboards: Array<{ userId: string; period: string; rank: number; score: number }> = [];

  // WEEKLY ve MONTHLY leaderboard oluştur
  const periods: Array<'WEEKLY' | 'MONTHLY'> = ['WEEKLY', 'MONTHLY'];

  for (const period of periods) {
    let rank = 1;
    for (const userScore of sortedUsers) {
      // Mevcut leaderboard kaydını kontrol et
      const existing = await prisma.bridgeLeaderboard.findUnique({
        where: {
          brandId_userId_period: {
            brandId: brandId,
            userId: userScore.userId,
            period: period,
          },
        },
      });

      if (!existing) {
        await prisma.bridgeLeaderboard.create({
          data: {
            id: randomUUID(),
            brandId: brandId,
            userId: userScore.userId,
            period: period,
            rank: rank,
            score: userScore.score,
          },
        });
        console.log(`  ✅ ${period} leaderboard: Rank ${rank} - User ${userScore.userId.substring(0, 8)}... (Score: ${userScore.score})`);
      } else {
        // Güncelle
        await prisma.bridgeLeaderboard.update({
          where: {
            brandId_userId_period: {
              brandId: brandId,
              userId: userScore.userId,
              period: period,
            },
          },
          data: {
            rank: rank,
            score: userScore.score,
          },
        });
        console.log(`  ✅ ${period} leaderboard güncellendi: Rank ${rank} - User ${userScore.userId.substring(0, 8)}... (Score: ${userScore.score})`);
      }

      createdLeaderboards.push({
        userId: userScore.userId,
        period: period,
        rank: rank,
        score: userScore.score,
      });

      rank++;
    }
  }

  console.log(`\n✅ Toplam ${createdLeaderboards.length} leaderboard kaydı oluşturuldu`);

  return {
    leaderboards: createdLeaderboards,
  };
}
