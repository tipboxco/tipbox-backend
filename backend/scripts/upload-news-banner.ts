import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function uploadNewsBanner() {
  try {
    console.log('📰 News banner görseli yükleniyor...');

    const s3Service = new S3Service();

    // Marketplace.jpg dosya yolu
    const marketplaceImagePath = path.join(
      __dirname,
      '../tests/assets/marketplace/marketplace.jpg'
    );

    // Dosya varlık kontrolü
    if (!existsSync(marketplaceImagePath)) {
      console.error(`❌ marketplace.jpg dosyası bulunamadı: ${marketplaceImagePath}`);
      process.exit(1);
    }

    const nodeEnv = process.env.NODE_ENV || 'development';
    const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000';
    const containerName = s3Endpoint.includes('minio:9000')
      ? `tipbox_minio_${nodeEnv}`
      : 'Harici MinIO';

    console.log(`📁 marketplace.jpg dosyası bulundu, ${containerName} container'ına yükleniyor...`);

    await s3Service.checkAndCreateBucket();

    const marketplaceImageBuffer = readFileSync(marketplaceImagePath);
    console.log(`📦 Görsel boyutu: ${(marketplaceImageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // MinIO path'i
    const minioPath = 'news/marketplace.jpg';

    // MinIO'da dosyanın mevcut olup olmadığını kontrol et
    const exists = await s3Service.fileExists(minioPath);

    if (!exists) {
      // MinIO'ya yükle
      const uploadedPath = await s3Service.uploadFile(
        minioPath,
        marketplaceImageBuffer,
        'image/jpeg'
      );
      console.log(`✅ News banner görseli ${containerName} container'ına yüklendi: ${uploadedPath}`);
    } else {
      console.log(`⏭️  News banner görseli zaten mevcut: ${minioPath}`);
      console.log(`ℹ️  Mevcut görseli güncellemek için önce MinIO'dan silin veya farklı bir path kullanın.`);
    }

    console.log(`✅ News banner yükleme işlemi tamamlandı`);
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ News banner görsel yükleme hatası: ${errorMsg}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
if (require.main === module) {
  uploadNewsBanner()
    .catch((e) => {
      console.error('❌ Script failed:', e);
      process.exit(1);
    });
}

export { uploadNewsBanner };
