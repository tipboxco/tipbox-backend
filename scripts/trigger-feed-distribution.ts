import dotenv from 'dotenv';
dotenv.config({ override: false });

import { PrismaClient } from '@prisma/client';
import { FeedDistributionScheduler } from '../src/infrastructure/scheduler/feed-distribution.scheduler';

const prisma = new PrismaClient();
const scheduler = new FeedDistributionScheduler();

async function triggerFeedDistribution() {
  try {
    console.log('🚀 Feed distribution tetikleniyor...\n');

    // Tüm postları al (son 100 post ile başla)
    const posts = await prisma.contentPost.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    console.log(`📝 Toplam ${posts.length} post bulundu\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        // Post data'sını hazırla
        const postData = {
          mainCategoryId: post.mainCategoryId,
          subCategoryId: post.subCategoryId,
          productGroupId: post.productGroupId,
          productId: post.productId,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          viewsCount: post.viewsCount,
          sharesCount: post.sharesCount,
          isBoosted: post.isBoosted,
          boostedUntil: post.boostedUntil,
          createdAt: post.createdAt,
        };

        // Feed distribution job'ını queue'ya ekle
        await scheduler.queueFeedDistribution(
          post.id,
          post.userId,
          postData,
          'fast' // Hızlı scoring kullan
        );

        successCount++;
        if (successCount % 10 === 0) {
          console.log(`✅ ${successCount} post işlendi...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Post ${post.id} için hata:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`\n✅ İşlem tamamlandı!`);
    console.log(`   Başarılı: ${successCount}`);
    console.log(`   Hatalı: ${errorCount}`);

    // Queue istatistiklerini göster
    const stats = await scheduler.getQueueStats();
    console.log(`\n📊 Queue istatistikleri:`);
    console.log(`   Bekleyen: ${stats.waiting}`);
    console.log(`   Aktif: ${stats.active}`);
    console.log(`   Tamamlanan: ${stats.completed}`);
    console.log(`   Başarısız: ${stats.failed}`);
  } catch (error) {
    console.error('❌ Genel hata:', error);
  } finally {
    await prisma.$disconnect();
    // Scheduler'ı kapat
    await scheduler.close();
  }
}

triggerFeedDistribution();

