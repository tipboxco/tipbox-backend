import { PrismaClient } from '@prisma/client';
import { generateUlid } from '../prisma/seed/types';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Tüm postları tüm aktif kullanıcıların feed\'ine ekleniyor...\n');

  // Tüm aktif kullanıcıları al
  const allActiveUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, email: true },
  });

  console.log(`📋 ${allActiveUsers.length} aktif kullanıcı bulundu`);

  // Tüm postları al (en yeni önce)
  const allPosts = await prisma.contentPost.findMany({
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      isBoosted: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📝 ${allPosts.length} post bulundu\n`);

  let totalAdded = 0;
  let totalSkipped = 0;

  // Her kullanıcı için
  for (const user of allActiveUsers) {
    console.log(`👤 ${user.email} için feed oluşturuluyor...`);

    // Her post için
    for (const post of allPosts) {
      // Kendi postunu feed'ine ekleme
      if (post.userId === user.id) {
        continue;
      }

      // Feed kaydı zaten var mı kontrol et
      const existingFeed = await prisma.feed.findFirst({
        where: {
          userId: user.id,
          postId: post.id,
        },
      });

      if (existingFeed) {
        totalSkipped++;
        continue;
      }

      // Feed source belirle
      const source = post.isBoosted ? 'BOOSTED' : 'CATEGORY_MATCH';

      // Feed kaydı oluştur
      try {
        await prisma.feed.create({
          data: {
            id: generateUlid(),
            userId: user.id,
            postId: post.id,
            source,
            seen: false,
          },
        });

        // unseenFeedCount'u artır
        await prisma.profile.updateMany({
          where: { userId: user.id },
          data: {
            unseenFeedCount: {
              increment: 1,
            },
          } as any,
        }).catch(() => {});

        totalAdded++;
      } catch (error) {
        // Duplicate veya başka hata - devam et
        totalSkipped++;
      }
    }

    console.log(`  ✅ ${user.email} için feed kayıtları oluşturuldu`);
  }

  console.log(`\n🎉 Tamamlandı!`);
  console.log(`   ✅ Eklenen: ${totalAdded}`);
  console.log(`   ⏭️  Atlanan: ${totalSkipped}`);

  await prisma.$disconnect();
}

main().catch(console.error);

