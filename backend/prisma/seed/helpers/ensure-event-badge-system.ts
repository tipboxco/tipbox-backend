/**
 * Event Badge Sisteminin tam entegrasyonunu sağlar
 * - Event badge'leri oluşturur
 * - Event badge görsellerini MinIO'ya yükler
 * - Test event oluşturur
 * - EventBadge join table'ı oluşturur
 */

import { PrismaClient, BadgeRarity, BadgeType } from '@prisma/client';
import { S3Service } from '../../../src/infrastructure/s3/s3.service';
import { promises as fs } from 'fs';
import path from 'path';

interface BadgeConfig {
  name: string;
  description: string;
  rarity: BadgeRarity;
  imageFileName: string; // event_badges/ klasöründeki dosya adı
  requirementType: 'POSTS_COUNT' | 'LIKES_RECEIVED';
  threshold: number;
}

const EVENT_BADGE_CONFIGS: BadgeConfig[] = [
  {
    name: '[Event] İlk Adım',
    description: 'Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉',
    rarity: BadgeRarity.COMMON,
    imageFileName: '1.png',
    requirementType: 'POSTS_COUNT',
    threshold: 1
  },
  {
    name: '[Event] İlk Beğeni',
    description: 'Event\'te paylaştığın içerik ilk beğenisini aldı! 👍',
    rarity: BadgeRarity.COMMON,
    imageFileName: '4.png',
    requirementType: 'LIKES_RECEIVED',
    threshold: 1
  },
  {
    name: '[Event] Aktif Katılımcı',
    description: 'Event\'te 3 post paylaştın! Harika bir katılım! ⭐',
    rarity: BadgeRarity.RARE,
    imageFileName: '2.png',
    requirementType: 'POSTS_COUNT',
    threshold: 3
  },
  {
    name: '[Event] Popüler',
    description: 'Event\'te paylaştığın içerikler 3 beğeni aldı! 🌟',
    rarity: BadgeRarity.RARE,
    imageFileName: '5.png',
    requirementType: 'LIKES_RECEIVED',
    threshold: 3
  },
  {
    name: '[Event] İçerik Ustası',
    description: 'Event\'te toplam 5 post paylaştın! İnanılmaz! 🏆',
    rarity: BadgeRarity.EPIC,
    imageFileName: '3.png',
    requirementType: 'POSTS_COUNT',
    threshold: 5
  }
];

export async function ensureEventBadgeSystem(prisma: PrismaClient): Promise<void> {
  console.log('\n🎖️  Event Badge Sistemi Hazırlanıyor...\n');

  const s3Service = new S3Service();

  try {
    // 1. Badge Category oluştur
    let eventCategory = await prisma.badgeCategory.findFirst({
      where: { name: 'Event' }
    });

    if (!eventCategory) {
      eventCategory = await prisma.badgeCategory.create({
        data: {
          name: 'Event',
          description: 'Event etkinliklerinde kazanılan özel rozetler'
        }
      });
      console.log('✅ Event Badge Category oluşturuldu');
    } else {
      console.log('⏭️  Event Badge Category zaten var');
    }

    // 2. Event Badge Görsellerini MinIO'ya yükle
    console.log('\n📤 Event Badge Görselleri MinIO\'ya Yükleniyor...\n');
    
    const eventBadgesPath = path.join(__dirname, '../../../tests/assets/badge/eventbadges');
    let uploadedImageUrls: Map<string, string> = new Map();

    try {
      const files = await fs.readdir(eventBadgesPath);
      const pngFiles = files.filter(f => f.endsWith('.png'));

      for (const file of pngFiles) {
        const localPath = path.join(eventBadgesPath, file);
        const targetKey = `badges/event/${file}`;

        // MinIO'da zaten var mı kontrol et
        const exists = await s3Service.fileExists(targetKey);

        if (!exists) {
          const fileBuffer = await fs.readFile(localPath);
          await s3Service.uploadFile(targetKey, fileBuffer, 'image/png');
          console.log(`   ✅ ${file} → ${targetKey}`);
        } else {
          console.log(`   ⏭️  ${file} zaten mevcut`);
        }

        uploadedImageUrls.set(file, targetKey);
      }

      console.log(`\n✅ ${uploadedImageUrls.size} event badge görseli hazır\n`);
    } catch (error) {
      console.warn('⚠️  Event badge görselleri yüklenemedi, devam ediliyor...');
      console.warn('   Hata:', error instanceof Error ? error.message : String(error));
    }

    // 3. Event Badge'leri Oluştur
    console.log('🏆 Event Badge\'leri Oluşturuluyor...\n');

    const createdBadges: Array<{ 
      id: string; 
      name: string; 
      requirementType: string; 
      threshold: number 
    }> = [];

    for (const config of EVENT_BADGE_CONFIGS) {
      let badge = await prisma.badge.findFirst({
        where: { name: config.name }
      });

      if (!badge) {
        const imageUrl = uploadedImageUrls.get(config.imageFileName) || null;
        
        badge = await prisma.badge.create({
          data: {
            name: config.name,
            description: config.description,
            imageUrl,
            type: BadgeType.EVENT,
            rarity: config.rarity,
            categoryId: eventCategory.id
          }
        });
        console.log(`   ✅ ${badge.name}`);
      } else {
        console.log(`   ⏭️  ${badge.name} zaten var`);
      }

      createdBadges.push({
        id: badge.id,
        name: badge.name,
        requirementType: config.requirementType,
        threshold: config.threshold
      });
    }

    console.log(`\n✅ ${createdBadges.length} event badge hazır\n`);

    // 4. Test Event Oluştur
    console.log('📅 Test Event Oluşturuluyor...\n');

    const eventId = '00MKFPNIQ30000064YDGL62K7Q';
    let event = await prisma.wishboxEvent.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      // Event görselini al - Doğrudan Minio path'ini kullan
      const imageKey = 'event.event-batarya';
      const imageKeyParts = imageKey.split('.');
      const imageName = imageKeyParts[imageKeyParts.length - 1]; // 'event-batarya'
      const imageUrl = `events/${imageName}.png`;

      event = await prisma.wishboxEvent.create({
        data: {
          id: eventId,
          title: 'Akıllı Telefon Batarya Performansı',
          description: 'Hangi telefon en uzun süre dayanıyor? Günlük kullanımda gerçek batarya deneyiminizi paylaşın. Normal kullanımda kaç saat?, yoğun kullanımda ne kadar?, hızlı şarj var mı?',
          startDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
          status: 'PUBLISHED',
          imageUrl,
          brandId: null
        }
      });
      console.log(`   ✅ Test Event: ${event.title}`);
    } else {
      console.log(`   ⏭️  Test Event zaten var: ${event.title}`);
    }

    // 5. EventBadge Join Table Kayıtlarını Oluştur
    console.log('\n📋 EventBadge Kayıtları Oluşturuluyor...\n');

    for (let i = 0; i < createdBadges.length; i++) {
      const badge = createdBadges[i];

      const existing = await prisma.eventBadge.findUnique({
        where: {
          eventId_badgeId: {
            eventId: event.id,
            badgeId: badge.id
          }
        }
      });

      if (!existing) {
        await prisma.eventBadge.create({
          data: {
            eventId: event.id,
            badgeId: badge.id,
            requirementType: badge.requirementType,
            threshold: badge.threshold,
            displayOrder: i + 1,
            enabled: true
          }
        });
        console.log(`   ✅ ${badge.name} → Event'e atandı (Threshold: ${badge.threshold})`);
      } else {
        console.log(`   ⏭️  ${badge.name} zaten atanmış`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Event Badge Sistemi Hazır!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   📊 Badge Sayısı: ${createdBadges.length}`);
    console.log(`   📊 Event: ${event.title}`);
    console.log(`   📊 EventBadge Kayıtları: ${createdBadges.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Event Badge Sistemi hazırlanırken hata:', error);
    throw error;
  }
}
