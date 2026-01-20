import { seedAppleInteractions } from './apple-interactions.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testAppleInteractions() {
  console.log('🧪 Testing Apple Interactions Seed...\n');

  try {
    // Önce brand'ı oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // Interactions seed'i çalıştır
    const result = await seedAppleInteractions(brandResult.brandId);
    console.log('\n✅ Interactions seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    // Apple brand'ı bul
    const appleBrand = await prisma.brand.findUnique({
      where: { id: brandResult.brandId },
    });

    if (!appleBrand) {
      throw new Error('Apple brand not found');
    }

    // Post interactions kontrolü
    const applePosts = await prisma.contentPost.findMany({
      where: {
        product: {
          brandId: appleBrand.externalId,
        },
      },
      take: 5,
      include: {
        likes: {
          take: 3,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        comments: {
          take: 3,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        shares: {
          take: 2,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        favorites: {
          take: 2,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    console.log('📝 Post Interactions Örnekleri:');
    for (const post of applePosts.slice(0, 3)) {
      console.log(`\n   Post: ${post.title.substring(0, 50)}...`);
      console.log(`   Likes: ${post.likesCount} (${post.likes.length} örnek gösteriliyor)`);
      console.log(`   Comments: ${post.commentsCount} (${post.comments.length} örnek gösteriliyor)`);
      console.log(`   Shares: ${post.sharesCount} (${post.shares.length} örnek gösteriliyor)`);
      console.log(`   Favorites: ${post.favoritesCount} (${post.favorites.length} örnek gösteriliyor)`);
      if (post.comments.length > 0) {
        console.log(`   Sample Comment: "${post.comments[0].comment}" by ${post.comments[0].user.profile?.userName || 'Unknown'}`);
      }
    }

    // News interactions kontrolü
    const appleNews = await prisma.news.findMany({
      where: {
        brandId: brandResult.brandId,
      },
      take: 3,
      include: {
        likes: {
          take: 2,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        comments: {
          take: 2,
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        shares: {
          take: 2,
        },
        favorites: {
          take: 2,
        },
      },
    });

    console.log('\n📰 News Interactions Örnekleri:');
    for (const news of appleNews) {
      console.log(`\n   News: ${news.title.substring(0, 50)}...`);
      console.log(`   Likes: ${news.likesCount} (${news.likes.length} örnek gösteriliyor)`);
      console.log(`   Comments: ${news.commentsCount} (${news.comments.length} örnek gösteriliyor)`);
      console.log(`   Shares: ${news.sharesCount} (${news.shares.length} örnek gösteriliyor)`);
      console.log(`   Favorites: ${news.favoritesCount} (${news.favorites.length} örnek gösteriliyor)`);
      if (news.comments.length > 0) {
        console.log(`   Sample Comment: "${news.comments[0].comment}" by ${news.comments[0].user.profile?.userName || 'Unknown'}`);
      }
    }

    // İstatistikler
    const totalPostLikes = await prisma.contentLike.count({
      where: {
        post: {
          product: {
            brandId: appleBrand.externalId,
          },
        },
      },
    });

    const totalPostComments = await prisma.contentComment.count({
      where: {
        post: {
          product: {
            brandId: appleBrand.externalId,
          },
        },
      },
    });

    const totalNewsLikes = await prisma.newsLike.count({
      where: {
        news: {
          brandId: brandResult.brandId,
        },
      },
    });

    const totalNewsComments = await prisma.newsComment.count({
      where: {
        news: {
          brandId: brandResult.brandId,
        },
      },
    });

    console.log('\n📈 Toplam İstatistikler:');
    console.log(`   Post Likes: ${totalPostLikes}`);
    console.log(`   Post Comments: ${totalPostComments}`);
    console.log(`   News Likes: ${totalNewsLikes}`);
    console.log(`   News Comments: ${totalNewsComments}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleInteractions();
