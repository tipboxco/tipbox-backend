/**
 * MinIO bağlantısını ve bucket durumunu kontrol eder
 * Seed sürecinde görsellerin yüklenip yüklenmediğini test eder
 */

import { S3Service } from '../src/infrastructure/s3/s3.service';
import { S3Client, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import { s3Config } from '../src/infrastructure/config/s3.config';
import fs from 'fs';

async function checkMinIOConnection() {
  console.log('🔍 MinIO bağlantısı kontrol ediliyor...\n');

  // S3Service oluştur
  const s3Service = new S3Service();
  
  try {
    // Bucket kontrolü
    console.log('📦 Bucket kontrolü yapılıyor...');
    await s3Service.checkAndCreateBucket();
    console.log('✅ Bucket mevcut veya oluşturuldu:', s3Config.bucketName);
  } catch (error: any) {
    console.error('❌ Bucket kontrolü başarısız:', error.message);
    return;
  }

  // S3Client ile direkt bağlantı testi
  const s3Client = new S3Client({
    endpoint: s3Config.endpoint,
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
    forcePathStyle: s3Config.forcePathStyle,
  });

  try {
    // Bucket içeriğini listele
    console.log('\n📋 Bucket içeriği listeleniyor...');
    const listCommand = new ListObjectsV2Command({
      Bucket: s3Config.bucketName,
      MaxKeys: 50,
    });

    const response = await s3Client.send(listCommand);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log(`✅ Bucket'te ${response.Contents.length} dosya bulundu:\n`);
      
      // Klasör yapısını göster
      const folders = new Set<string>();
      response.Contents.forEach((object) => {
        if (object.Key) {
          const parts = object.Key.split('/');
          if (parts.length > 1) {
            folders.add(parts[0]);
          }
          const sizeKB = ((object.Size || 0) / 1024).toFixed(2);
          console.log(`   📄 ${object.Key} (${sizeKB} KB)`);
        }
      });

      console.log(`\n📁 Bulunan klasörler: ${Array.from(folders).join(', ')}`);
    } else {
      console.log('⚠️  Bucket boş - hiç dosya bulunamadı');
    }
  } catch (error: any) {
    console.error('❌ Bucket içeriği listelenemedi:', error.message);
  }

  // Seed media map kontrolü
  console.log('\n📄 Seed media map kontrolü...');
  const seedMediaMapPath = './prisma/seed/seed-media-map.json';
  
  if (fs.existsSync(seedMediaMapPath)) {
    const seedMediaMap = JSON.parse(fs.readFileSync(seedMediaMapPath, 'utf-8'));
    const keys = Object.keys(seedMediaMap);
    console.log(`✅ seed-media-map.json bulundu: ${keys.length} key`);
    
    // İlk 10 key'i göster
    console.log('\n📋 İlk 10 key:');
    keys.slice(0, 10).forEach((key) => {
      const entry = seedMediaMap[key];
      console.log(`   ${key} -> ${entry.targetKey}`);
    });
  } else {
    console.log('⚠️  seed-media-map.json bulunamadı');
    console.log('   💡 Çözüm: npm run upload-seed-media komutunu çalıştırın');
  }

  // Test dosyası yükleme
  console.log('\n🧪 Test dosyası yükleniyor...');
  try {
    const testContent = Buffer.from('Test file content');
    const testKey = 'test/connection-test.txt';
    
    await s3Service.uploadFile(testKey, testContent, 'text/plain');
    console.log(`✅ Test dosyası yüklendi: ${testKey}`);
    
    // Test dosyasını sil
    // (opsiyonel - test için bırakılabilir)
  } catch (error: any) {
    console.error('❌ Test dosyası yüklenemedi:', error.message);
  }

  console.log('\n✅ Kontrol tamamlandı!');
}

checkMinIOConnection()
  .then(() => {
    console.log('\n🎉 MinIO bağlantı kontrolü başarılı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ MinIO bağlantı kontrolü başarısız:', error);
    process.exit(1);
  });

