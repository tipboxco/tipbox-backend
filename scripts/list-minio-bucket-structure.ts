/**
 * MinIO Bucket Yapısını Listeleme Script'i
 * 
 * Bu script, tipbox-media bucket'ındaki tüm klasörleri ve dosyaları listeler.
 * 
 * Kullanım:
 *   npx ts-node scripts/list-minio-bucket-structure.ts
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Config } from '../src/infrastructure/config/s3.config';
import fs from 'fs';

// Production sunucusu için endpoint belirleme
// Eğer PRODUCTION_MINIO_ENDPOINT env var set edilmişse onu kullan
// Yoksa local Docker'ı kullan
let effectiveEndpoint = process.env.PRODUCTION_MINIO_ENDPOINT || s3Config.endpoint;

// Production endpoint belirtilmişse direkt kullan
if (process.env.PRODUCTION_MINIO_ENDPOINT) {
  console.log('⚠️  Production MinIO endpoint kullanılıyor:', effectiveEndpoint);
} else {
  // Container dışında çalışıyorsa localhost kullan
  const isContainerEnvironment =
    process.env.DOCKER_CONTAINER === 'true' || fs.existsSync('/.dockerenv');
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (effectiveEndpoint.includes('minio:9000') && !process.env.S3_ENDPOINT) {
    if (!isContainerEnvironment && isDevelopment) {
      effectiveEndpoint = effectiveEndpoint.replace(/minio:9000/g, 'localhost:9000');
    }
  }
}

const s3Client = new S3Client({
  endpoint: effectiveEndpoint,
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
  },
  forcePathStyle: s3Config.forcePathStyle,
});

interface FolderStructure {
  [key: string]: {
    files: number;
    subfolders: string[];
    totalSize: number;
  };
}

async function listBucketStructure(): Promise<void> {
  try {
    console.log('🔍 MinIO bucket yapısı kontrol ediliyor...\n');
    console.log(`📦 Bucket: ${s3Config.bucketName}`);
    console.log(`🌐 Endpoint: ${effectiveEndpoint}\n`);

    const folders: FolderStructure = {};
    let continuationToken: string | undefined;
    let totalObjects = 0;
    let totalSize = 0;

    do {
      const command = new ListObjectsV2Command({
        Bucket: s3Config.bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          if (!object.Key) continue;

          totalObjects++;
          totalSize += object.Size || 0;

          // Klasör yapısını analiz et
          const parts = object.Key.split('/');
          const folderName = parts[0];

          if (!folders[folderName]) {
            folders[folderName] = {
              files: 0,
              subfolders: [],
              totalSize: 0,
            };
          }

          folders[folderName].files++;
          folders[folderName].totalSize += object.Size || 0;

          // Alt klasörleri topla
          if (parts.length > 1) {
            const subfolder = parts.slice(0, 2).join('/');
            if (!folders[folderName].subfolders.includes(subfolder)) {
              folders[folderName].subfolders.push(subfolder);
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Sonuçları göster
    console.log('📊 Bucket Yapısı:\n');
    console.log('═'.repeat(80));

    const sortedFolders = Object.keys(folders).sort();

    for (const folder of sortedFolders) {
      const stats = folders[folder];
      const sizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
      const subfolderCount = stats.subfolders.length;

      console.log(`\n📁 ${folder}/`);
      console.log(`   📄 Dosya sayısı: ${stats.files.toLocaleString()}`);
      console.log(`   💾 Toplam boyut: ${sizeMB} MB`);
      if (subfolderCount > 0) {
        console.log(`   📂 Alt klasör sayısı: ${subfolderCount}`);
        if (subfolderCount <= 10) {
          console.log(`   📋 Alt klasörler:`);
          stats.subfolders.slice(0, 10).forEach((sub) => {
            console.log(`      - ${sub}/`);
          });
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`\n📈 Özet İstatistikler:`);
    console.log(`   📦 Toplam klasör: ${sortedFolders.length}`);
    console.log(`   📄 Toplam dosya: ${totalObjects.toLocaleString()}`);
    console.log(`   💾 Toplam boyut: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Beklenen klasörleri kontrol et
    console.log('\n✅ Beklenen Klasörler:');
    const expectedFolders = [
      'profile-pictures',
      'profile-banners',
      'post-media',
      'post-images',
      'posts',
      'catalog-images',
      'products',
      'expert-requests',
    ];

    for (const expected of expectedFolders) {
      const exists = folders[expected] ? '✅' : '❌';
      const count = folders[expected]?.files || 0;
      console.log(`   ${exists} ${expected}/ (${count.toLocaleString()} dosya)`);
    }

    // post-media klasörü var mı kontrol et
    if (folders['post-media']) {
      console.log('\n🎉 post-media/ klasörü mevcut!');
    } else {
      console.log('\n⚠️  post-media/ klasörü henüz oluşturulmamış.');
      console.log('   Yeni post görselleri yüklendiğinde otomatik oluşturulacak.');
    }

    // post-images vs post-media karşılaştırması
    if (folders['post-images'] && folders['post-media']) {
      console.log('\n📊 post-images vs post-media:');
      console.log(`   post-images/: ${folders['post-images'].files.toLocaleString()} dosya`);
      console.log(`   post-media/: ${folders['post-media'].files.toLocaleString()} dosya`);
    }

  } catch (error) {
    console.error('❌ Hata:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

listBucketStructure()
  .then(() => {
    console.log('\n✅ Bucket yapısı kontrolü tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });
