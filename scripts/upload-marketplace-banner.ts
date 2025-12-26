/**
 * Marketplace banner görselini MinIO'ya yükleyip DB'ye path'ini ekleyen script
 * 
 * Kullanım:
 *   npx ts-node scripts/upload-marketplace-banner.ts
 */

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Marketplace banner görseli
const MARKETPLACE_BANNER_PATH = path.join(process.cwd(), 'tests', 'assets', 'marketplace', 'marketplace.jpg');
const TARGET_KEY = 'marketplace/marketplace.jpg';

// Content type inference
function inferContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'image/jpeg';
}

async function uploadMarketplaceBanner(): Promise<void> {
  console.log('📸 Marketplace banner görseli yükleniyor...\n');

  try {
    // Dosya var mı kontrol et
    try {
      readFileSync(MARKETPLACE_BANNER_PATH, { flag: 'r' });
    } catch {
      console.error(`❌ Dosya bulunamadı: ${MARKETPLACE_BANNER_PATH}`);
      process.exit(1);
    }

    // MinIO'da zaten var mı kontrol et
    const existsInMinio = await s3Service.fileExists(TARGET_KEY);
    if (existsInMinio) {
      console.log(`   ℹ️  Görsel zaten MinIO'da mevcut: ${TARGET_KEY}`);
    } else {
      // Dosyayı oku ve yükle
      const fileBuffer = readFileSync(MARKETPLACE_BANNER_PATH);
      const contentType = inferContentType(MARKETPLACE_BANNER_PATH);
      
      await s3Service.uploadFile(TARGET_KEY, fileBuffer, contentType);
      console.log(`   ✅ Görsel MinIO'ya yüklendi: ${TARGET_KEY}`);
    }

    // Tüm aktif marketplace banner'ları al
    const banners = await prisma.marketplaceBanner.findMany({
      where: {
        isActive: true,
      },
    });

    console.log(`\n📋 ${banners.length} aktif banner bulundu\n`);

    let updatedCount = 0;

    // Tüm banner'lara görseli ekle (eğer imageUrl boşsa)
    for (const banner of banners) {
      if (!banner.imageUrl || banner.imageUrl.trim() === '') {
        await prisma.marketplaceBanner.update({
          where: { id: banner.id },
          data: { imageUrl: TARGET_KEY },
        });
        console.log(`   ✅ Banner güncellendi: ${banner.title} -> ${TARGET_KEY}`);
        updatedCount++;
      } else {
        console.log(`   ℹ️  Banner zaten görsele sahip: ${banner.title} (${banner.imageUrl})`);
      }
    }

    console.log('\n📊 Özet:');
    console.log(`   🔄 Güncellenen: ${updatedCount}`);
    console.log(`   ℹ️  Zaten görsele sahip: ${banners.length - updatedCount}`);
    console.log('\n✨ Marketplace banner görseli yükleme tamamlandı!');
  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    throw error;
  }
}

// Script'i çalıştır
uploadMarketplaceBanner()
  .catch((error) => {
    console.error('❌ Hata:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

