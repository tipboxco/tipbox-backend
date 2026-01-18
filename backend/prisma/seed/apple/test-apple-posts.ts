import { seedApplePosts } from './apple-posts.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testApplePosts() {
  console.log('🧪 Testing Apple Posts Seed...\n');

  try {
    // Önce brand'ı oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // Posts seed'i çalıştır
    const result = await seedApplePosts(brandResult.brandId);
    console.log('\n✅ Posts seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    for (const postInfo of result.posts) {
      const post = await prisma.contentPost.findUnique({
        where: { id: postInfo.id },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          product: true,
          contentPostTags: true,
          question: true,
          tip: true,
          comparison: true,
        },
      });

      if (!post) {
        console.error(`❌ Post bulunamadı: ${postInfo.id}`);
        continue;
      }

      console.log(`📝 ${post.type} Post:`);
      console.log(`   ID: ${post.id}`);
      console.log(`   Title: ${post.title}`);
      console.log(`   User: ${post.user.profile?.userName || post.user.profile?.displayName || 'N/A'}`);
      console.log(`   Product: ${post.product?.name || 'N/A'}`);
      console.log(`   Tags: ${post.contentPostTags.map((t) => t.tag).join(', ') || 'N/A'}`);

      if (post.question) {
        console.log(`   Question Format: ${post.question.expectedAnswerFormat}`);
      }
      if (post.tip) {
        console.log(`   Tip Category: ${post.tip.tipCategory}`);
      }
      if (post.comparison) {
        console.log(`   Comparison: ${post.comparison.product1Id} vs ${post.comparison.product2Id}`);
      }

      console.log('');
    }

    // İstatistikler
    const postsByType = await prisma.contentPost.groupBy({
      by: ['type'],
      where: {
        product: {
          brandId: (await prisma.brand.findFirst({ where: { name: 'Apple' } }))?.externalId,
        },
      },
      _count: true,
    });

    console.log('📈 Post İstatistikleri:');
    postsByType.forEach((stat) => {
      console.log(`   ${stat.type}: ${stat._count}`);
    });

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testApplePosts();
