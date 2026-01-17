/**
 * Sadece explore marketplace banner'larını seed eder
 * Mevcut banner'ları temizleyip yeni banner'ları oluşturur
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function seedExploreBanners() {
  try {
    console.log('🔍 Explore marketplace banner\'ları seed ediliyor...\n');

    // Mevcut marketplace banner'ları temizle (duplicate hatası olmaması için)
    const existingBanners = await prisma.marketplaceBanner.findMany({
      where: {
        title: {
          in: ['Yeni Sezon NFT Koleksiyonu', 'Epic Rarity İndirimi'],
        },
      },
    });

    if (existingBanners.length > 0) {
      console.log(`🗑️  ${existingBanners.length} mevcut banner siliniyor...`);
      await prisma.marketplaceBanner.deleteMany({
        where: {
          id: {
            in: existingBanners.map((b) => b.id),
          },
        },
      });
      console.log('✅ Mevcut banner\'lar temizlendi\n');
    }

    // Marketplace banner görsellerini MinIO'ya yükle
    const s3Service = new S3Service();
    const exploreImagePaths: string[] = [];
    
    const imageFiles = [
      { localPath: path.join(__dirname, '../tests/assets/explore/hottest.jpg'), fileName: 'hottest.jpg' },
      { localPath: path.join(__dirname, '../tests/assets/explore/hottest2.jpg'), fileName: 'hottest2.jpg' },
    ];
    
    console.log('📸 Marketplace banner görselleri MinIO\'ya yükleniyor...');
    for (const imageFile of imageFiles) {
      try {
        if (!existsSync(imageFile.localPath)) {
          console.warn(`⚠️  Görsel dosyası bulunamadı: ${imageFile.localPath}`);
          continue;
        }
        
        const minioPath = `Explore/${imageFile.fileName}`;
        
        // MinIO'da dosyanın mevcut olup olmadığını kontrol et
        const exists = await s3Service.fileExists(minioPath);
        
        if (!exists) {
          const fileBuffer = readFileSync(imageFile.localPath);
          await s3Service.uploadFile(minioPath, fileBuffer, 'image/jpeg');
          console.log(`✅ Görsel yüklendi: ${minioPath}`);
        } else {
          console.log(`⏭️  Görsel zaten mevcut: ${minioPath}`);
        }
        
        exploreImagePaths.push(minioPath);
      } catch (error) {
        console.error(`❌ Görsel yüklenemedi: ${imageFile.fileName}`, error);
      }
    }
    
    // Marketplace banners - 2 tane oluştur
    if (exploreImagePaths.length >= 2) {
      await Promise.all([
        prisma.marketplaceBanner.create({
          data: {
            title: 'Yeni Sezon NFT Koleksiyonu',
            description: "Sınırlı sayıda özel avatar ve badge NFT'leri şimdi satışta!",
            imageUrl: exploreImagePaths[0]!,
            linkUrl: '/marketplace/listings?type=BADGE',
            isActive: true,
            displayOrder: 1,
          },
        }),
        prisma.marketplaceBanner.create({
          data: {
            title: 'Epic Rarity İndirimi',
            description: "%30 indirimli EPIC rarity NFT'lere göz at",
            imageUrl: exploreImagePaths[1]!,
            linkUrl: '/marketplace/listings?rarity=EPIC',
            isActive: true,
            displayOrder: 2,
          },
        }),
      ]).catch((error) => {
        console.warn('⚠️  Marketplace banner oluşturulurken hata:', error);
      });
      console.log('✅ Marketplace banner\'lar oluşturuldu');
    } else {
      console.warn('⚠️  Yeterli görsel yüklenemedi, marketplace banner\'lar oluşturulamadı');
    }

    // Oluşturulan banner'ları göster
    const banners = await prisma.marketplaceBanner.findMany({
      where: {
        title: {
          in: ['Yeni Sezon NFT Koleksiyonu', 'Epic Rarity İndirimi'],
        },
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        linkUrl: true,
        displayOrder: true,
      },
    });

    if (banners.length > 0) {
      console.log(`\n📋 Oluşturulan banner'lar:`);
      banners.forEach((banner) => {
        console.log(`   ${banner.displayOrder}. ${banner.title}`);
        console.log(`      Description: ${banner.description || '(yok)'}`);
        console.log(`      Image: ${banner.imageUrl || '(boş)'}`);
        console.log(`      Link: ${banner.linkUrl || '(yok)'}`);
        console.log('');
      });
    }

    console.log('✅ Explore marketplace banner seed işlemi tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedExploreBanners();
