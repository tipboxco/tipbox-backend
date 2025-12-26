/**
 * Event görsellerini MinIO'ya yükleyip DB'ye rastgele path'lerini ekleyen script
 * 
 * Kullanım:
 *   npx ts-node scripts/upload-event-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Event görselleri klasörü
const EVENTS_ASSETS_DIR = path.join(process.cwd(), 'tests', 'assets', 'events');

// Community event görselleri (rastgele seçim için)
const COMMUNITY_EVENT_IMAGES = [
  'communityevents-the-gaming-night.jpg',
  'communityevents-the-urban-commuter.jpg',
  'communityevents-the-rainy-day-sanctuary.jpg',
  'communityevents-the-hikers-summit.jpg',
  'communityevents-the-content-creator.jpg',
  'communityevents-the-skincare-ritual.jpg',
  'communityevents-the-digital-nomad-day.jpg',
  'communityevents-the-smart-home-geek.jpg',
  'communityevents-the-masterchef-weekend.jpg',
  'communityevents-the-road-trip-ready.jpg',
];

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

async function uploadEventImages(): Promise<void> {
  console.log('📸 Event gorselleri yukleniyor...\n');

  // Event görselleri klasörünü kontrol et
  if (!readdirSync(EVENTS_ASSETS_DIR).length) {
    console.warn('⚠️  Event görselleri klasörü boş!');
    return;
  }

  // Tüm event'leri al
  const events = await prisma.wishboxEvent.findMany({
    select: {
      id: true,
      title: true,
      imageUrl: true,
    },
  });

  console.log(`📋 ${events.length} event bulundu\n`);

  let uploadedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // Once tum community event gorsellerini MinIO'ya yukle
  console.log('📤 Community event gorselleri MinIO\'ya yukleniyor...\n');
  for (const fileName of COMMUNITY_EVENT_IMAGES) {
    const filePath = path.join(EVENTS_ASSETS_DIR, fileName);
    
    try {
      // Dosya var mı kontrol et
      try {
        readFileSync(filePath, { flag: 'r' });
      } catch {
        console.warn(`⚠️  Dosya bulunamadı: ${fileName}`);
        continue;
      }

      // MinIO'ya yüklenecek path
      const targetKey = `events/${fileName}`;
      
      // MinIO'da zaten var mı kontrol et
      const existsInMinio = await s3Service.fileExists(targetKey);
      if (existsInMinio) {
        console.log(`   ℹ️  Zaten mevcut: ${targetKey}`);
      } else {
        // Dosyayı oku ve yükle
        const fileBuffer = readFileSync(filePath);
        const contentType = inferContentType(filePath);
        
        await s3Service.uploadFile(targetKey, fileBuffer, contentType);
        console.log(`   ✅ Yüklendi: ${targetKey}`);
        uploadedCount++;
      }
    } catch (error: any) {
      console.error(`   ❌ Hata (${fileName}):`, error.message);
      skippedCount++;
    }
  }

  // event.png ve eventcardbg.png'yi de yukle (default ve background icin)
  console.log('\n📤 Default gorseller yukleniyor...\n');
  for (const fileName of ['event.png', 'eventcardbg.png']) {
    const filePath = path.join(EVENTS_ASSETS_DIR, fileName);
    
    try {
      try {
        readFileSync(filePath, { flag: 'r' });
      } catch {
        console.warn(`⚠️  Dosya bulunamadı: ${fileName}`);
        continue;
      }

      const targetKey = `events/${fileName}`;
      const existsInMinio = await s3Service.fileExists(targetKey);
      if (!existsInMinio) {
        const fileBuffer = readFileSync(filePath);
        const contentType = inferContentType(filePath);
        await s3Service.uploadFile(targetKey, fileBuffer, contentType);
        console.log(`   ✅ Yüklendi: ${targetKey}`);
        uploadedCount++;
      } else {
        console.log(`   ℹ️  Zaten mevcut: ${targetKey}`);
      }
    } catch (error: any) {
      console.error(`   ❌ Hata (${fileName}):`, error.message);
      skippedCount++;
    }
  }

  // Simdi tum event'lere rastgele gorseller ata
  console.log('\n🎲 Eventlere rastgele gorseller ataniyor...\n');
  
  const eventsToUpdate = events.filter(e => !e.imageUrl || e.imageUrl === 'events/event.png');
  
  for (const event of eventsToUpdate) {
    // Event ID'sine göre deterministik rastgele seçim (her seed'de aynı görsel)
    const eventIdHash = event.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomIndex = eventIdHash % COMMUNITY_EVENT_IMAGES.length;
    const selectedImage = COMMUNITY_EVENT_IMAGES[randomIndex];
    const imageKey = `events/${selectedImage}`;
    
    await prisma.wishboxEvent.update({
      where: { id: event.id },
      data: { imageUrl: imageKey },
    });
    console.log(`   ✅ ${event.title} -> ${imageKey}`);
    updatedCount++;
  }

  console.log('\n📊 Özet:');
  console.log(`   ✅ Yüklenen: ${uploadedCount}`);
  console.log(`   🔄 Güncellenen: ${updatedCount}`);
  console.log(`   ⏭️  Atlanan: ${skippedCount}`);
  console.log('\n✨ Event görselleri yükleme tamamlandı!');
}

// Script'i çalıştır
uploadEventImages()
  .catch((error) => {
    console.error('❌ Hata:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
