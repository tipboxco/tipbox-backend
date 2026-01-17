/**
 * Trending post'ları oluşturur
 * Engagement skorlarına göre en popüler postları seçer ve TrendingPost tablosuna ekler
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateUlid(): string {
  const timestamp = Date.now().toString(36).toUpperCase().padStart(10, '0');
  const randomPart = Math.random().toString(36).substring(2, 18).toUpperCase().padStart(16, '0');
  return (timestamp + randomPart).substring(0, 26);
}

async function createTrendingPosts() {
  console.log('\n🔥 Trending post\'lar oluşturuluyor...\n');
  
  try {
    // Önce mevcut trending post'ları temizle (opsiyonel - yorum satırından çıkarabilirsiniz)
    const existingCount = await prisma.trendingPost.count();
    if (existingCount > 0) {
      console.log(`⚠️  Mevcut ${existingCount} trending post bulundu.`);
      console.log('   Yeni trending post\'lar oluşturulacak (unique constraint nedeniyle mevcutlar korunacak).\n');
    }

    // Farklı post tiplerinden en popüler postları al
    const freePosts = await prisma.contentPost.findMany({
      where: { type: 'FREE' },
      take: 10,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    const tipsPosts = await prisma.contentPost.findMany({
      where: { type: 'TIPS' },
      take: 6,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    const comparePosts = await prisma.contentPost.findMany({
      where: { type: 'COMPARE' },
      take: 6,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    const questionPostsForTrending = await prisma.contentPost.findMany({
      where: { type: 'QUESTION' },
      take: 5,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    const experiencePosts = await prisma.contentPost.findMany({
      where: { type: 'EXPERIENCE' },
      take: 5,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    console.log(`📊 Post istatistikleri:`);
    console.log(`   - FREE: ${freePosts.length}`);
    console.log(`   - TIPS: ${tipsPosts.length}`);
    console.log(`   - COMPARE: ${comparePosts.length}`);
    console.log(`   - QUESTION: ${questionPostsForTrending.length}`);
    console.log(`   - EXPERIENCE: ${experiencePosts.length}\n`);

    // Tüm postları birleştir ve engagement skoruna göre sırala
    const allPostsForTrending = [
      ...freePosts,
      ...tipsPosts,
      ...comparePosts,
      ...questionPostsForTrending,
      ...experiencePosts,
    ];
    
    // Engagement skoruna göre sırala (likes + comments + views)
    allPostsForTrending.sort((a, b) => {
      const scoreA = a.likesCount + a.commentsCount * 2 + a.viewsCount * 0.1;
      const scoreB = b.likesCount + b.commentsCount * 2 + b.viewsCount * 0.1;
      return scoreB - scoreA;
    });
    
    // Top 30 post'u seç
    const topPosts = allPostsForTrending.slice(0, 30);
    
    if (topPosts.length === 0) {
      console.log('⚠️  Trending post için yeterli post bulunamadı');
      return;
    }
    
    console.log(`📊 ${topPosts.length} post trending olarak işaretleniyor...\n`);
    
    const trendingPosts: any[] = [];
    let createdCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i];
      try {
        // Engagement skorunu hesapla (100'den başlayıp azalan)
        const engagementScore = post.likesCount + post.commentsCount * 2 + post.viewsCount * 0.1;
        const baseScore = 100 - i * 3; // Descending scores
        const finalScore = Math.max(baseScore, engagementScore * 0.1); // Minimum engagement-based score
        
        const trendingPost = await prisma.trendingPost.create({
          data: {
            id: generateUlid(),
            postId: post.id,
            score: finalScore,
            trendPeriod: 'DAILY',
            calculatedAt: new Date(),
          },
        });
        trendingPosts.push(trendingPost);
        createdCount++;
        
        if (createdCount % 5 === 0) {
          console.log(`   ✅ ${createdCount}/${topPosts.length} trending post oluşturuldu...`);
        }
      } catch (error) {
        // Skip if already exists (unique constraint)
        if (error instanceof Error) {
          if (error.message.includes('Unique constraint') || error.message.includes('unique')) {
            skippedCount++;
          } else {
            console.error(`   ⚠️  Post ${post.id} için hata:`, error.message);
          }
        }
      }
    }
    
    console.log(`\n✅ ${createdCount} trending post oluşturuldu`);
    if (skippedCount > 0) {
      console.log(`   ⏭️  ${skippedCount} post zaten trending (atlandı)`);
    }
    console.log(`\n📊 Post tipi dağılımı:`);
    console.log(`   - FREE: ${freePosts.filter((p: any) => trendingPosts.some((tp: any) => tp.postId === p.id)).length}`);
    console.log(`   - TIPS: ${tipsPosts.filter((p: any) => trendingPosts.some((tp: any) => tp.postId === p.id)).length}`);
    console.log(`   - COMPARE: ${comparePosts.filter((p: any) => trendingPosts.some((tp: any) => tp.postId === p.id)).length}`);
    console.log(`   - QUESTION: ${questionPostsForTrending.filter((p: any) => trendingPosts.some((tp: any) => tp.postId === p.id)).length}`);
    console.log(`   - EXPERIENCE: ${experiencePosts.filter((p: any) => trendingPosts.some((tp: any) => tp.postId === p.id)).length}`);
    
    // Toplam trending post sayısını göster
    const totalTrending = await prisma.trendingPost.count({
      where: {
        trendPeriod: 'DAILY',
        calculatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Son 7 gün
        },
      },
    });
    console.log(`\n📈 Toplam aktif trending post (son 7 gün): ${totalTrending}`);
    console.log('\n✅ Trending post oluşturma tamamlandı!\n');
  } catch (error) {
    console.error('❌ Trending post oluşturma hatası:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    throw error;
  }
}

async function main() {
  try {
    await createTrendingPosts();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Direkt çalıştırıldığında main olarak çalış
if (require.main === module) {
  main();
}
