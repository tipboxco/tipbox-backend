/**
 * Marketplace banner'ların durumunu kontrol eder
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { PrismaClient } from '@prisma/client';
import { resolveMediaUrl } from '../src/infrastructure/config/media.config';

const prisma = new PrismaClient();

async function checkMarketplaceBanners() {
  try {
    console.log('🔍 Marketplace bannerlar kontrol ediliyor...\n');

    const banners = await prisma.marketplaceBanner.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    console.log(`📋 Toplam ${banners.length} aktif banner bulundu\n`);

    banners.forEach((banner, index) => {
      console.log(`${index + 1}. ${banner.title}`);
      console.log(`   ID: ${banner.id}`);
      console.log(`   Description: ${banner.description || '(yok)'}`);
      console.log(`   Raw ImageUrl (DB): ${banner.imageUrl || '(boş)'}`);
      
      // resolveMediaUrl ile çevir
      const resolvedUrl = resolveMediaUrl(banner.imageUrl);
      console.log(`   Resolved ImageUrl: ${resolvedUrl || '(boş)'}`);
      
      console.log(`   LinkUrl: ${banner.linkUrl || '(yok)'}`);
      console.log(`   DisplayOrder: ${banner.displayOrder}`);
      console.log(`   IsActive: ${banner.isActive}`);
      console.log('');
    });

    // Cache'i temizle (eğer varsa)
    console.log('💡 Not: Cache temizlemek için server\'ı restart edin veya cache key\'ini manuel silin');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMarketplaceBanners();

