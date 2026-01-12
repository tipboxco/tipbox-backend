/**
 * Seed sonrası tüm postlar için feed distribution job'larını queue'ya ekler
 * FeedDistributionWorker çalıştığında bu job'lar işlenir ve feed'ler oluşturulur
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { PrismaClient } from '@prisma/client';
import { FeedDistributionScheduler } from '../../src/infrastructure/scheduler/feed-distribution.scheduler';

const prisma = new PrismaClient();

/**
 * Queue'daki job'ların tamamlanmasını bekler
 */
async function waitForQueueCompletion(
  scheduler: FeedDistributionScheduler,
  expectedJobCount: number,
  timeoutMinutes: number = 15
): Promise<void> {
  const startTime = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  let lastCompletedCount = 0;
  let stuckCounter = 0;

  console.log(`\n⏳ Feed'lerin oluşturulması bekleniyor (max ${timeoutMinutes} dakika)...`);
  console.log(`   Hedef: ${expectedJobCount} job\n`);

  while (true) {
    const elapsed = Date.now() - startTime;
    
    // Timeout kontrolü
    if (elapsed > timeoutMs) {
      console.log(`\n⚠️  Timeout! ${timeoutMinutes} dakika doldu, seed devam ediyor.`);
      console.log(`   Feed'ler arka planda oluşturulmaya devam edecek.\n`);
      break;
    }

    const stats = await scheduler.getQueueStats();
    const totalProcessed = stats.completed + stats.failed;
    const progress = Math.round((totalProcessed / expectedJobCount) * 100);

    // İlerleme göster
    if (totalProcessed !== lastCompletedCount) {
      console.log(`   [${progress}%] İşlenen: ${totalProcessed}/${expectedJobCount} | Aktif: ${stats.active} | Bekleyen: ${stats.waiting}`);
      lastCompletedCount = totalProcessed;
      stuckCounter = 0;
    } else {
      stuckCounter++;
    }

    // Tamamlandı mı?
    if (totalProcessed >= expectedJobCount) {
      console.log(`\n✅ Tüm feed'ler oluşturuldu!`);
      console.log(`   Başarılı: ${stats.completed}`);
      if (stats.failed > 0) {
        console.log(`   Başarısız: ${stats.failed}`);
      }
      
      // Feed sayısını göster
      const feedCount = await prisma.feed.count();
      const postCount = await prisma.contentPost.count();
      console.log(`\n📊 Feed istatistikleri:`);
      console.log(`   Toplam feed: ${feedCount.toLocaleString()}`);
      console.log(`   Toplam post: ${postCount.toLocaleString()}`);
      console.log(`   Post başına ortalama: ${Math.round(feedCount / postCount)} kullanıcı\n`);
      break;
    }

    // 30 saniye boyunca ilerleme yoksa uyar
    if (stuckCounter > 6) { // 6 x 5 saniye = 30 saniye
      console.log(`   ⚠️  İlerleme yavaş (son 30 saniyede değişiklik yok).`);
      console.log(`   💡 Feed worker'ın çalıştığından emin olun: npm run dev:feed-worker`);
      stuckCounter = 0;
    }

    // 5 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

export async function triggerFeedDistributionAfterSeed(waitForCompletion: boolean = false): Promise<void> {
  try {
    console.log('\n🚀 Feed distribution job\'ları queue\'ya ekleniyor...\n');

    const scheduler = new FeedDistributionScheduler();

    // TÜM postları al (seed sonrası için)
    const posts = await prisma.contentPost.findMany({
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
      console.log('⚠️  Feed\'e eklenebilecek post bulunamadı\n');
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

    // Seed'den çağrılıyorsa worker'ın tamamlamasını bekle
    if (waitForCompletion) {
      await waitForQueueCompletion(scheduler, successCount);
    } else {
      console.log(`\n💡 FeedDistributionWorker çalıştığında bu job'lar işlenecek ve feed'ler oluşturulacak.\n`);
    }

    await scheduler.close();
  } catch (error) {
    console.error('❌ Feed distribution tetikleme hatası:', error);
    // Hata olsa bile seed işlemi devam etsin
  } finally {
    await prisma.$disconnect();
  }
}

// Direkt çalıştırıldığında main olarak çalış
if (require.main === module) {
  triggerFeedDistributionAfterSeed()
    .then(() => {
      console.log('✅ Feed distribution trigger tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}


