/**
 * App asset klasörlerini MinIO'ya yükler
 * - Avatars/
 * - Badges/
 * - Drawer Premium Selling Banner/
 * - Expert Now Video/
 * - Explore Banners/
 */

import { S3Service } from '../src/infrastructure/s3/s3.service';
import { promises as fs } from 'fs';
import path from 'path';

const s3Service = new S3Service();

interface UploadResult {
  uploaded: number;
  skipped: number;
  errors: number;
}

/**
 * Dosya tipine göre MIME type döndürür
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Bir klasördeki tüm dosyaları recursive olarak yükler
 */
async function uploadFolder(
  localFolderPath: string,
  minioPrefix: string,
  folderName: string
): Promise<UploadResult> {
  const result: UploadResult = {
    uploaded: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const files = await fs.readdir(localFolderPath, { withFileTypes: true });

    for (const file of files) {
      const localPath = path.join(localFolderPath, file.name);

      if (file.isDirectory()) {
        // Recursive olarak alt klasörleri işle
        const subResult = await uploadFolder(
          localPath,
          `${minioPrefix}/${file.name}`,
          `${folderName}/${file.name}`
        );
        result.uploaded += subResult.uploaded;
        result.skipped += subResult.skipped;
        result.errors += subResult.errors;
      } else if (file.isFile()) {
        try {
          const minioKey = `${minioPrefix}/${file.name}`;
          const exists = await s3Service.fileExists(minioKey);

          if (!exists) {
            const fileBuffer = await fs.readFile(localPath);
            const contentType = getContentType(localPath);
            await s3Service.uploadFile(minioKey, fileBuffer, contentType);
            console.log(`   ✅ ${file.name} → ${minioKey}`);
            result.uploaded++;
          } else {
            console.log(`   ⏭️  ${file.name} zaten mevcut`);
            result.skipped++;
          }
        } catch (error) {
          console.error(`   ❌ ${file.name} yüklenemedi:`, error instanceof Error ? error.message : String(error));
          result.errors++;
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ ${folderName} klasörü okunamadı:`, error instanceof Error ? error.message : String(error));
    result.errors++;
  }

  return result;
}

async function uploadAppAssets() {
  console.log('\n📦 App Asset Klasörlerini MinIO\'ya Yükleme Başladı\n');

  const basePath = path.join(__dirname, '../src');
  const folders = [
    { local: 'Avatars', minio: 'app/Avatars' },
    { local: 'Badges', minio: 'app/Badges' },
    { local: 'Drawer Premium Selling Banner', minio: 'app/Drawer Premium Selling Banner' },
    { local: 'Expert Now Video', minio: 'app/Expert Now Video' },
    { local: 'Explore Banners', minio: 'app/Explore Banners' },
  ];

  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Bucket'ı kontrol et ve oluştur
  await s3Service.checkAndCreateBucket();

  for (const folder of folders) {
    const localFolderPath = path.join(basePath, folder.local);

    console.log(`📤 ${folder.local} klasörü yükleniyor...\n`);

    try {
      // Klasörün varlığını kontrol et
      await fs.access(localFolderPath);

      const result = await uploadFolder(localFolderPath, folder.minio, folder.local);

      totalUploaded += result.uploaded;
      totalSkipped += result.skipped;
      totalErrors += result.errors;

      console.log(`\n✅ ${folder.local}: ${result.uploaded} yüklendi, ${result.skipped} atlandı, ${result.errors} hata\n`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`⚠️  ${folder.local} klasörü bulunamadı: ${localFolderPath}\n`);
      } else {
        console.error(`❌ ${folder.local} klasörü işlenirken hata:`, error instanceof Error ? error.message : String(error));
        totalErrors++;
      }
    }
  }

  // Özet
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 App Asset Upload Özeti:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Yüklenen: ${totalUploaded}`);
  console.log(`⏭️  Zaten mevcut (atlandı): ${totalSkipped}`);
  console.log(`❌ Hata: ${totalErrors}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (totalErrors > 0) {
    console.warn('⚠️  Bazı dosyalar yüklenemedi, lütfen hataları kontrol edin.\n');
  }
}

// Script çalıştır
uploadAppAssets()
  .then(() => {
    console.log('✅ App asset upload işlemi tamamlandı!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ App asset upload işlemi başarısız:', error);
    process.exit(1);
  });
