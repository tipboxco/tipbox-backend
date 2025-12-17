/**
 * Migration Script: InventoryMedia'dan PostMedia'ya Veri Taşıma
 * 
 * Bu script, InventoryMedia tablosundaki post görsellerini PostMedia tablosuna taşır.
 * 
 * Strateji:
 * 1. Post'un productId'si ve userId'si ile eşleşen inventory'leri bul
 * 2. O inventory'deki görselleri PostMedia'ya taşı
 * 3. Ancak dikkat: Hangi görsellerin post için olduğunu kesin bilemeyiz
 *    Bu yüzden sadece post oluşturulduktan sonra eklenen görselleri taşıyoruz
 * 
 * Kullanım:
 *   npx ts-node scripts/migrate-post-media-from-inventory.ts
 * 
 * ÖNEMLİ: Bu script'i çalıştırmadan önce backup alın!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  postsProcessed: number;
  mediaMigrated: number;
  mediaSkipped: number;
  errors: string[];
}

async function migratePostMediaFromInventory(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    postsProcessed: 0,
    mediaMigrated: 0,
    mediaSkipped: 0,
    errors: [],
  };

  try {
    console.log('🚀 PostMedia migration başlatılıyor...\n');

    // 1. ProductId'si olan tüm postları bul
    const postsWithProduct = await prisma.contentPost.findMany({
      where: {
        productId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        createdAt: true,
      },
    });

    console.log(`📊 ${postsWithProduct.length} adet product bağlantılı post bulundu\n`);

    // 2. Her post için inventory'deki görselleri kontrol et
    for (const post of postsWithProduct) {
      if (!post.productId) continue;

      try {
        // Post'un userId ve productId'si ile eşleşen inventory'yi bul
        const inventory = await prisma.inventory.findUnique({
          where: {
            userId_productId: {
              userId: post.userId,
              productId: post.productId,
            },
          },
          include: {
            media: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        if (!inventory || inventory.media.length === 0) {
          continue;
        }

        // Post oluşturulduktan sonra eklenen görselleri bul
        // (Post'dan sonra eklenen görseller muhtemelen post için eklenmiştir)
        const postMedia = inventory.media.filter(
          (media) => media.createdAt >= post.createdAt
        );

        if (postMedia.length === 0) {
          // Eğer post'tan sonra görsel yoksa, tüm görselleri kontrol et
          // Ama bu riskli, bu yüzden sadece log'layalım
          console.log(
            `⚠️  Post ${post.id}: Post'tan sonra görsel yok, tüm görselleri atlıyoruz`
          );
          stats.mediaSkipped += inventory.media.length;
          continue;
        }

        // PostMedia'da zaten var mı kontrol et
        const existingMedia = await prisma.postMedia.findMany({
          where: { postId: post.id },
        });

        if (existingMedia.length > 0) {
          console.log(
            `⏭️  Post ${post.id}: Zaten ${existingMedia.length} görsel var, atlanıyor`
          );
          stats.mediaSkipped += postMedia.length;
          continue;
        }

        // PostMedia'ya taşı
        const mediaToMigrate = postMedia.map((media, index) => ({
          postId: post.id,
          userId: post.userId,
          mediaUrl: media.mediaUrl,
          orderIndex: index,
          createdAt: media.createdAt,
          updatedAt: media.updatedAt,
        }));

        await prisma.postMedia.createMany({
          data: mediaToMigrate,
          skipDuplicates: true,
        });

        console.log(
          `✅ Post ${post.id}: ${mediaToMigrate.length} görsel PostMedia'ya taşındı`
        );

        stats.postsProcessed++;
        stats.mediaMigrated += mediaToMigrate.length;
      } catch (error) {
        const errorMsg = `Post ${post.id} işlenirken hata: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log('\n📈 Migration İstatistikleri:');
    console.log(`   - İşlenen Post: ${stats.postsProcessed}`);
    console.log(`   - Taşınan Görsel: ${stats.mediaMigrated}`);
    console.log(`   - Atlanan Görsel: ${stats.mediaSkipped}`);
    console.log(`   - Hata: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Hatalar:');
      stats.errors.forEach((error) => console.log(`   - ${error}`));
    }

    return stats;
  } catch (error) {
    console.error('❌ Migration hatası:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
if (require.main === module) {
  migratePostMediaFromInventory()
    .then((stats) => {
      console.log('\n✅ Migration tamamlandı!');
      process.exit(stats.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Migration başarısız:', error);
      process.exit(1);
    });
}

export { migratePostMediaFromInventory };
