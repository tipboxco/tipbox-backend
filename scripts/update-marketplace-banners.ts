/**
 * Mevcut marketplace banner'ların görsellerini günceller
 * Seed'i tekrar çalıştırmadan görselleri ekler
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { PrismaClient } from '@prisma/client';
import { getSeedMediaPath } from '../prisma/seed/helpers/media.helper';
import type { SeedMediaKey } from '../prisma/seed/helpers/media.helper';

const prisma = new PrismaClient();

async function updateMarketplaceBanners() {
  try {
    console.log('🖼️  Marketplace banner görselleri güncelleniyor...\n');

    // Banner konfigürasyonları
    const bannerConfigs: Array<{
      title: string;
      imageKey: SeedMediaKey;
    }> = [
      { title: 'Yeni Sezon NFT Koleksiyonu', imageKey: 'marketplace.marketplace' },
      { title: 'Epic Rarity İndirimi', imageKey: 'marketplace.marketplace' },
      { title: 'Yeni Markalar Platformda', imageKey: 'marketplace.marketplace' },
    ];

    let updatedCount = 0;
    let createdCount = 0;

    for (const config of bannerConfigs) {
      // Görsel path'ini al
      const imagePath = getSeedMediaPath(config.imageKey, true);

      if (!imagePath) {
        console.warn(`⚠️  "${config.title}" için görsel bulunamadı (key: ${config.imageKey})`);
        continue;
      }

      // Mevcut banner'ı bul
      const existing = await prisma.marketplaceBanner.findFirst({
        where: { title: config.title },
      });

      if (existing) {
        // Mevcut banner'ın imageUrl'si boş veya farklı ise güncelle
        if (!existing.imageUrl || existing.imageUrl.trim() === '' || existing.imageUrl !== imagePath) {
          await prisma.marketplaceBanner.update({
            where: { id: existing.id },
            data: {
              imageUrl: imagePath,
            },
          });
          console.log(`✅ "${config.title}" görseli güncellendi`);
          updatedCount++;
        } else {
          console.log(`⏭️  "${config.title}" zaten güncel`);
        }
      } else {
        // Banner yoksa oluştur (diğer bilgileri de ekle)
        const defaultConfig: Record<string, any> = {
          'Yeni Sezon NFT Koleksiyonu': {
            description: 'Sınırlı sayıda özel avatar ve badge NFT\'leri şimdi satışta!',
            linkUrl: '/marketplace/listings?type=BADGE',
            displayOrder: 1,
          },
          'Epic Rarity İndirimi': {
            description: '%30 indirimli EPIC rarity NFT\'lere göz at',
            linkUrl: '/marketplace/listings?rarity=EPIC',
            displayOrder: 2,
          },
          'Yeni Markalar Platformda': {
            description: 'Ünlü markalar TipBox\'a katıldı! Hemen keşfet.',
            linkUrl: '/explore/brands/new',
            displayOrder: 3,
          },
        };

        const bannerData = defaultConfig[config.title];
        if (bannerData) {
          await prisma.marketplaceBanner.create({
            data: {
              title: config.title,
              description: bannerData.description,
              imageUrl: imagePath,
              linkUrl: bannerData.linkUrl,
              isActive: true,
              displayOrder: bannerData.displayOrder,
            },
          });
          console.log(`✅ "${config.title}" banner'ı oluşturuldu`);
          createdCount++;
        }
      }
    }

    console.log(`\n✅ İşlem tamamlandı!`);
    console.log(`   Güncellenen: ${updatedCount}`);
    console.log(`   Oluşturulan: ${createdCount}`);

    // Güncellenmiş banner'ları göster
    const allBanners = await prisma.marketplaceBanner.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        linkUrl: true,
      },
    });

    if (allBanners.length > 0) {
      console.log(`\n📋 Aktif banner'lar:`);
      allBanners.forEach((banner, index) => {
        console.log(`   ${index + 1}. ${banner.title}`);
        console.log(`      Image: ${banner.imageUrl || '(boş)'}`);
        console.log(`      Link: ${banner.linkUrl || '(yok)'}`);
      });
    }
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateMarketplaceBanners();


