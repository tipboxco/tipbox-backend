import { PrismaClient } from '@prisma/client';
import { readdirSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ULID generator (seed.ts'den kopyalandı)
function generateUlid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 11);
  return timestamp + randomPart.toUpperCase();
}

// Event görselleri klasörü
const EVENTS_ASSETS_DIR = path.join(__dirname, '../tests/assets/events');

// Community event görselleri
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

// Apple brand ID
const APPLE_BRAND_ID = '081d5660-a6d6-412a-b0ae-1557acaaa028';

// Survey event'leri (SURVEY tipinde)
const SURVEY_EVENTS = [
  {
    title: 'Apple Ürün Deneyimi Anketi',
    description: 'Apple ürünlerinizi kullanırken yaşadığınız deneyimleri paylaşın. iPhone, iPad, MacBook ve diğer Apple ürünleri hakkındaki görüşleriniz bizim için değerli.',
    eventType: 'SURVEY' as const,
  },
  {
    title: 'Apple Ekosistem Memnuniyeti',
    description: 'Apple ekosisteminin (iPhone, Mac, iPad, Apple Watch) birlikte kullanım deneyiminizi değerlendirin.',
    eventType: 'SURVEY' as const,
  },
  {
    title: 'Apple Watch Kullanım Anketi',
    description: 'Apple Watch kullanıcıları! Sağlık takibi, bildirimler ve diğer özellikler hakkındaki görüşlerinizi paylaşın.',
    eventType: 'SURVEY' as const,
  },
  {
    title: 'AirPods Deneyim Anketi',
    description: 'AirPods kullanıcıları! Ses kalitesi, konfor ve günlük kullanım deneyiminizi bizimle paylaşın.',
    eventType: 'SURVEY' as const,
  },
  {
    title: 'MacBook Performans Değerlendirmesi',
    description: 'MacBook kullanıcıları! Performans, pil ömrü ve kullanım deneyiminizi değerlendirin.',
    eventType: 'SURVEY' as const,
  },
];

// Diğer event'ler (CONTEST, CHALLENGE, POLL)
const OTHER_EVENTS = [
  {
    title: 'Apple Ürün Fotoğraf Yarışması',
    description: 'En güzel Apple ürün fotoğrafınızı paylaşın ve ödüller kazanın!',
    eventType: 'CONTEST' as const,
  },
  {
    title: 'Apple Kullanım İpuçları Challenge',
    description: 'Apple ürünlerinizle ilgili en yararlı ipuçlarınızı paylaşın ve topluluğa ilham verin.',
    eventType: 'CHALLENGE' as const,
  },
  {
    title: 'En İyi Apple Ürünü Anketi',
    description: 'Hangi Apple ürününü en çok seviyorsunuz? iPhone, iPad, MacBook, Apple Watch veya AirPods?',
    eventType: 'POLL' as const,
  },
  {
    title: 'Apple Yeni Özellik İstekleri',
    description: 'Apple\'dan hangi yeni özellikleri görmek istersiniz? Fikirlerinizi paylaşın!',
    eventType: 'POLL' as const,
  },
  {
    title: 'Apple Ürün Karşılaştırma Challenge',
    description: 'Farklı Apple ürün modellerini karşılaştırın ve topluluğa rehberlik edin.',
    eventType: 'CHALLENGE' as const,
  },
];

// Rastgele event görseli seç
function getRandomEventImage(): string {
  const availableImages = readdirSync(EVENTS_ASSETS_DIR).filter(file => 
    COMMUNITY_EVENT_IMAGES.includes(file)
  );
  
  if (availableImages.length === 0) {
    return 'events/event.png'; // Fallback
  }
  
  const randomIndex = Math.floor(Math.random() * availableImages.length);
  return `events/${availableImages[randomIndex]}`;
}

async function addAppleBrandEvents(): Promise<void> {
  console.log('🍎 Apple brand event\'leri ekleniyor...\n');

  try {
    // Apple brand'ini kontrol et
    const appleBrand = await prisma.brand.findUnique({
      where: { id: APPLE_BRAND_ID },
    });

    if (!appleBrand) {
      console.warn(`⚠️  Apple brand bulunamadı: ${APPLE_BRAND_ID}`);
      return;
    }

    console.log(`✅ Apple brand bulundu: ${appleBrand.name}\n`);

    // Mevcut event'leri kontrol et
    const existingEvents = await prisma.wishboxEvent.findMany({
      where: { brandId: APPLE_BRAND_ID } as any,
      select: { title: true },
    });

    const existingTitles = new Set(existingEvents.map(e => e.title));
    console.log(`📋 Mevcut event sayısı: ${existingEvents.length}\n`);

    const today = new Date();
    let createdSurveys = 0;
    let createdEvents = 0;

    // Survey event'lerini oluştur
    console.log('📝 Survey event\'leri oluşturuluyor...\n');
    for (let i = 0; i < SURVEY_EVENTS.length; i++) {
      const survey = SURVEY_EVENTS[i];
      
      if (existingTitles.has(survey.title)) {
        console.log(`   ⏭️  Zaten mevcut: ${survey.title}`);
        continue;
      }

      const startDate = new Date(today);
      startDate.setDate(today.getDate() + i * 2); // Her survey için 2 gün arayla
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 14); // 14 gün süre

      const event = await prisma.wishboxEvent.create({
        data: {
          id: generateUlid(),
          title: survey.title,
          description: survey.description,
          imageUrl: getRandomEventImage(),
          startDate,
          endDate,
          status: 'PUBLISHED',
          eventType: survey.eventType,
          brandId: APPLE_BRAND_ID,
        } as any,
      });

      console.log(`   ✅ Survey oluşturuldu: ${survey.title} (${event.id})`);
      createdSurveys++;
      existingTitles.add(survey.title);
    }

    // Diğer event'leri oluştur
    console.log('\n🎯 Diğer event\'ler oluşturuluyor...\n');
    for (let i = 0; i < OTHER_EVENTS.length; i++) {
      const eventData = OTHER_EVENTS[i];
      
      if (existingTitles.has(eventData.title)) {
        console.log(`   ⏭️  Zaten mevcut: ${eventData.title}`);
        continue;
      }

      const startDate = new Date(today);
      startDate.setDate(today.getDate() + (SURVEY_EVENTS.length * 2) + (i * 2));
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 10); // 10 gün süre

      const event = await prisma.wishboxEvent.create({
        data: {
          id: generateUlid(),
          title: eventData.title,
          description: eventData.description,
          imageUrl: getRandomEventImage(),
          startDate,
          endDate,
          status: 'PUBLISHED',
          eventType: eventData.eventType,
          brandId: APPLE_BRAND_ID,
        } as any,
      });

      console.log(`   ✅ Event oluşturuldu: ${eventData.title} (${event.id})`);
      createdEvents++;
      existingTitles.add(eventData.title);
    }

    console.log('\n📊 Özet:');
    console.log(`   ✅ Oluşturulan survey: ${createdSurveys}`);
    console.log(`   ✅ Oluşturulan event: ${createdEvents}`);
    console.log(`   📋 Toplam event sayısı: ${existingEvents.length + createdSurveys + createdEvents}`);

    console.log('\n✨ Apple brand event ekleme tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
addAppleBrandEvents()
  .then(() => {
    console.log('✅ Script başarıyla tamamlandı');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  });

