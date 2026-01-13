import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFeedDatabase() {
  try {
    console.log('🔍 Veritabanı durumu kontrol ediliyor...\n');

    // Feed tablosu sayısı
    const feedCount = await prisma.feed.count();
    console.log(`📊 Feed tablosu toplam kayıt: ${feedCount}`);

    // ContentPost tablosu sayısı
    const postCount = await prisma.contentPost.count();
    console.log(`📝 ContentPost tablosu toplam kayıt: ${postCount}`);

    // User tablosu sayısı
    const userCount = await prisma.user.count();
    console.log(`👥 User tablosu toplam kayıt: ${userCount}`);

    // Aktif kullanıcı sayısı
    const activeUserCount = await prisma.user.count({
      where: { status: 'ACTIVE' },
    });
    console.log(`✅ Aktif kullanıcı sayısı: ${activeUserCount}\n`);

    // Örnek feed kayıtları (ilk 5)
    if (feedCount > 0) {
      console.log('📋 İlk 5 feed kaydı:');
      const sampleFeeds = await prisma.feed.findMany({
        take: 5,
        include: {
          post: {
            select: {
              id: true,
              title: true,
              type: true,
              userId: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      sampleFeeds.forEach((feed, index) => {
        console.log(`  ${index + 1}. Feed ID: ${feed.id}`);
        console.log(`     User ID: ${feed.userId}`);
        console.log(`     Post ID: ${feed.postId}`);
        console.log(`     Source: ${feed.source}`);
        console.log(`     Score: ${feed.relevanceScore}`);
        console.log(`     Seen: ${feed.seen}`);
        console.log(`     Post Title: ${feed.post?.title || 'N/A'}`);
        console.log(`     Post Type: ${feed.post?.type || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Feed tablosu boş!\n');
    }

    // Örnek post kayıtları (ilk 5)
    if (postCount > 0) {
      console.log('📋 İlk 5 post kaydı:');
      const samplePosts = await prisma.contentPost.findMany({
        take: 5,
        select: {
          id: true,
          title: true,
          type: true,
          userId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      samplePosts.forEach((post, index) => {
        console.log(`  ${index + 1}. Post ID: ${post.id}`);
        console.log(`     Title: ${post.title}`);
        console.log(`     Type: ${post.type}`);
        console.log(`     User ID: ${post.userId}`);
        console.log(`     Created: ${post.createdAt}`);
        console.log('');
      });
    } else {
      console.log('⚠️  ContentPost tablosu boş!\n');
    }

    // Kullanıcı bazında feed sayıları
    if (feedCount > 0) {
      console.log('📊 Kullanıcı bazında feed sayıları (top 10):');
      const feedsByUser = await prisma.feed.groupBy({
        by: ['userId'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      feedsByUser.forEach((item, index) => {
        console.log(`  ${index + 1}. User ID: ${item.userId} - Feed Sayısı: ${item._count.id}`);
      });
    }

    console.log('\n✅ Kontrol tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFeedDatabase();

