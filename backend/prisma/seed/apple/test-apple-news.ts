import { seedAppleNews } from './apple-news.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testAppleNews() {
  console.log('🧪 Testing Apple News Seed...\n');

  try {
    // Önce brand'ı oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // News seed'i çalıştır
    const result = await seedAppleNews(brandResult.brandId);
    console.log('\n✅ News seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    for (const newsInfo of result.news) {
      const news = await prisma.news.findUnique({
        where: { id: newsInfo.id },
        include: {
          brand: true,
        },
      });

      if (!news) {
        console.error(`❌ News bulunamadı: ${newsInfo.id}`);
        continue;
      }

      console.log(`📰 News: ${news.title}`);
      console.log(`   ID: ${news.id}`);
      console.log(`   Brand: ${news.brand.name}`);
      console.log(`   Source: ${news.source}`);
      console.log(`   Author: ${news.author || 'N/A'}`);
      console.log(`   Tags: ${news.tags.join(', ')}`);
      console.log(`   Banner Image: ${news.bannerImageUrl || 'N/A'}`);
      console.log(`   Content Length: ${news.content.length} characters`);
      console.log(`   Likes: ${news.likesCount}, Comments: ${news.commentsCount}, Shares: ${news.sharesCount}, Favorites: ${news.favoritesCount}`);
      console.log(`   Created: ${news.createdAt.toISOString()}`);
      console.log('');
    }

    // İstatistikler
    const totalNews = await prisma.news.count({
      where: { brandId: brandResult.brandId },
    });

    console.log('📈 Toplam İstatistikler:');
    console.log(`   Total News: ${totalNews}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleNews();
