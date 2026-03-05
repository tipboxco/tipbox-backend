/**
 * Tüm badge görsellerini MinIO'ya yükler
 * - Event badge'leri: tests/assets/event_badges/
 * - Marketplace badge'leri: tests/assets/Badges _ Marketplace/
 */

import { S3Service } from '../src/infrastructure/s3/s3.service';
import { promises as fs } from 'fs';
import path from 'path';

async function uploadAllBadgeImages() {
  // Lazy init: S3Service sadece fonksiyon çalışırken başlatılır
  const s3Service = new S3Service();
  console.log('\n🎨 Badge Görsellerini MinIO\'ya Yükleme Başladı\n');

  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    // 1. Event Badge Görselleri
    console.log('📤 Event Badge Görselleri Yükleniyor...\n');
    
    const eventBadgesPath = path.join(__dirname, '../tests/assets/event_badges');
    
    try {
      const eventFiles = await fs.readdir(eventBadgesPath);
      const eventPngFiles = eventFiles.filter(f => f.endsWith('.png'));

      for (const file of eventPngFiles) {
        try {
          const localPath = path.join(eventBadgesPath, file);
          const targetKey = `badges/event/${file}`;

          const exists = await s3Service.fileExists(targetKey);

          if (!exists) {
            const fileBuffer = await fs.readFile(localPath);
            await s3Service.uploadFile(targetKey, fileBuffer, 'image/png');
            console.log(`   ✅ Event: ${file} → ${targetKey}`);
            totalUploaded++;
          } else {
            console.log(`   ⏭️  Event: ${file} zaten mevcut`);
            totalSkipped++;
          }
        } catch (error) {
          console.error(`   ❌ Event: ${file} yüklenemedi:`, error);
          totalErrors++;
        }
      }

      console.log(`\n✅ Event badge görselleri: ${eventPngFiles.length} dosya işlendi\n`);
    } catch (error) {
      console.warn('⚠️  Event badge görselleri klasörü bulunamadı veya okunamadı');
      console.warn('   Path:', eventBadgesPath);
      console.warn('   Hata:', error instanceof Error ? error.message : String(error), '\n');
    }

    // 2. Marketplace Badge Görselleri
    console.log('📤 Marketplace Badge Görselleri Yükleniyor...\n');

    const marketplaceBadgesPath = path.join(__dirname, '../tests/assets/Badges _ Marketplace');

    try {
      const marketplaceFiles = await fs.readdir(marketplaceBadgesPath);
      const marketplacePngFiles = marketplaceFiles.filter(f => f.endsWith('.png'));

      for (const file of marketplacePngFiles) {
        try {
          const localPath = path.join(marketplaceBadgesPath, file);
          const targetKey = `badges/marketplace/${file}`;

          const exists = await s3Service.fileExists(targetKey);

          if (!exists) {
            const fileBuffer = await fs.readFile(localPath);
            await s3Service.uploadFile(targetKey, fileBuffer, 'image/png');
            console.log(`   ✅ Marketplace: ${file} → ${targetKey}`);
            totalUploaded++;
          } else {
            console.log(`   ⏭️  Marketplace: ${file} zaten mevcut`);
            totalSkipped++;
          }
        } catch (error) {
          console.error(`   ❌ Marketplace: ${file} yüklenemedi:`, error);
          totalErrors++;
        }
      }

      console.log(`\n✅ Marketplace badge görselleri: ${marketplacePngFiles.length} dosya işlendi\n`);
    } catch (error) {
      console.warn('⚠️  Marketplace badge görselleri klasörü bulunamadı veya okunamadı');
      console.warn('   Path:', marketplaceBadgesPath);
      console.warn('   Hata:', error instanceof Error ? error.message : String(error), '\n');
    }

    // 3. Özet
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 Badge Görsel Upload Özeti:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Yüklenen: ${totalUploaded}`);
    console.log(`⏭️  Zaten mevcut (atlandı): ${totalSkipped}`);
    console.log(`❌ Hata: ${totalErrors}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (totalErrors > 0) {
      console.warn('⚠️  Bazı görseller yüklenemedi, ancak işlem devam etti.');
      console.warn('   Seed işlemi badge görselleri olmadan da çalışabilir.\n');
    }

  } catch (error) {
    console.error('❌ Badge görselleri yüklenirken genel hata:', error);
    throw error;
  }
}

// Script çalıştır
uploadAllBadgeImages()
  .then(() => {
    console.log('✅ Badge görselleri upload işlemi tamamlandı!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Badge görselleri upload işlemi başarısız:', error);
    process.exit(1);
  });
