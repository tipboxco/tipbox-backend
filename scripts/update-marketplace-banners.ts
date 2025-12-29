import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMarketplaceBanners() {
  console.log('🔄 Marketplace banner imageUrl güncelleniyor...');
  
  const bannerImagePath = 'tipbox-media/marketplace/marketplace.jpg';
  
  // Önce boş string olanları bul
  const emptyBanners = await prisma.marketplaceBanner.findMany({
    where: {
      imageUrl: '',
    },
  });
  
  console.log(`📋 ${emptyBanners.length} boş imageUrl'li banner bulundu`);
  
  // Boş string olanları güncelle
  const result = await prisma.marketplaceBanner.updateMany({
    where: {
      imageUrl: '',
    },
    data: {
      imageUrl: bannerImagePath,
    },
  });
  
  console.log(`✅ ${result.count} marketplace banner güncellendi`);
  
  // Tüm banner'ları listele
  const banners = await prisma.marketplaceBanner.findMany({
    select: {
      id: true,
      title: true,
      imageUrl: true,
    },
  });
  
  console.log('\n📋 Mevcut banner\'lar:');
  banners.forEach((banner) => {
    console.log(`  - ${banner.title}: ${banner.imageUrl || '(boş)'}`);
  });
  
  await prisma.$disconnect();
}

updateMarketplaceBanners().catch((error) => {
  console.error('❌ Hata:', error);
  process.exit(1);
});

