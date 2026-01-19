import { S3Service } from '../../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * News banner görselini MinIO'ya yükle
 * marketplace.jpg dosyasını news/marketplace.jpg path'inde saklar
 */
export async function seedNewsBanner(): Promise<void> {
  console.log('📰 [seed] news banner (marketplace.jpg)');

  const s3Service = new S3Service();
  
  // Marketplace.jpg dosya yolu
  const marketplaceImagePath = path.join(
    __dirname,
    '../../../tests/assets/marketplace/marketplace.jpg'
  );

  // Dosya varlık kontrolü
  if (!existsSync(marketplaceImagePath)) {
    console.warn(`⚠️  marketplace.jpg dosyası bulunamadı: ${marketplaceImagePath}`);
    return;
  }

  try {
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
      // uploadFile() artık sadece path döndürür (tam URL değil)
      // DB'de sadece path tutulacak, response'larda resolveMediaUrl ile tam URL'ye çevrilecek
      const uploadedPath = await s3Service.uploadFile(
        minioPath,
        marketplaceImageBuffer,
        'image/jpeg'
      );
      console.log(`✅ News banner görseli ${containerName} container'ına yüklendi: ${uploadedPath}`);
    } else {
      console.log(`⏭️  News banner görseli zaten mevcut: ${minioPath}`);
    }

    console.log(`✅ News banner seed işlemi tamamlandı`);
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ News banner görsel yükleme hatası: ${errorMsg}`);
    throw error;
  }
}
