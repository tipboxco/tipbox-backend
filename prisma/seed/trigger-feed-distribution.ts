/**
 * Seed sonrası tüm postlar için feed distribution job'larını queue'ya ekler
 * FeedDistributionWorker çalıştığında bu job'lar işlenir ve feed'ler oluşturulur
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { PrismaClient } from '@prisma/client';
import { FeedDistributionScheduler } from '../../src/infrastructure/scheduler/feed-distribution.scheduler';

const prisma = new PrismaClient();

export async function triggerFeedDistributionAfterSeed(): Promise<void> {
  try {
    console.log('\n🚀 Feed distribution job\'ları queue\'ya ekleniyor...\n');

    const scheduler = new FeedDistributionScheduler();

    // Son 14 gün içindeki postları al (feed'e eklenebilir postlar)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const posts = await prisma.contentPost.findMany({
      where: {
        createdAt: {
          gte: fourteenDaysAgo,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        mainCategoryId: true,
        subCategoryId: true,
        productGroupId: true,
        productId: true,
        likesCount: true,
        commentsCount: true,
        viewsCount: true,
        sharesCount: true,
        isBoosted: true,
        boostedUntil: true,
        createdAt: true,
      },
    });

    if (posts.length === 0) {
      console.log('⚠️  Feed\'e eklenebilecek post bulunamadı (14 günden eski postlar feed\'e eklenmez)\n');
      await scheduler.close();
      return;
    }

    console.log(`📝 ${posts.length} post için feed distribution job'ı oluşturuluyor...\n`);

    let successCount = 0;
    let errorCount = 0;

    // Her post için feed distribution job'ını queue'ya ekle
    for (const post of posts) {
      try {
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

        await scheduler.queueFeedDistribution(
          post.id,
          post.userId,
          postData,
          'fast' // Hızlı scoring kullan (seed sonrası için yeterli)
        );

        successCount++;
        if (successCount % 50 === 0) {
          console.log(`   ✅ ${successCount} post işlendi...`);
        }
      } catch (error) {
        errorCount++;
        // Hata olsa bile devam et
        if (errorCount <= 5) {
          console.error(`   ❌ Post ${post.id} için hata:`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    console.log(`\n✅ Feed distribution job'ları oluşturuldu!`);
    console.log(`   Başarılı: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   Hatalı: ${errorCount}`);
    }

    // Queue istatistiklerini göster
    const stats = await scheduler.getQueueStats();
    console.log(`\n📊 Queue istatistikleri:`);
    console.log(`   Bekleyen: ${stats.waiting}`);
    console.log(`   Aktif: ${stats.active}`);
    console.log(`   Tamamlanan: ${stats.completed}`);
    console.log(`   Başarısız: ${stats.failed}`);
    console.log(`\n💡 FeedDistributionWorker çalıştığında bu job'lar işlenecek ve feed'ler oluşturulacak.\n`);

    await scheduler.close();
  } catch (error) {
    console.error('❌ Feed distribution tetikleme hatası:', error);
    // Hata olsa bile seed işlemi devam etsin
  } finally {
    await prisma.$disconnect();
  }
}


