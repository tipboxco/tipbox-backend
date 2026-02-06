/**
 * Event Badge Sistemindeki event'in verilerini günceller
 * 
 * Bu script sadece event'in görünür verilerini (title, description, imageUrl, dates) günceller.
 * Badge'ler ve diğer sistem verileri değişmez.
 * 
 * Kullanım:
 *   npx ts-node scripts/update-event-badge-data.ts
 *   veya
 *   docker-compose exec backend npx ts-node scripts/update-event-badge-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EVENT_ID = '00MKFPNIQ30000064YDGL62K7Q';

async function updateEventBadgeData(): Promise<void> {
  console.log('\n📅 Event Badge Event Verileri Güncelleniyor...\n');

  try {
    // Event'i bul
    const event = await prisma.event.findUnique({
      where: { id: EVENT_ID },
      select: { id: true, title: true, description: true, imageUrl: true, startDate: true, endDate: true },
    });

    if (!event) {
      throw new Error(`Event bulunamadı: ${EVENT_ID}`);
    }

    console.log(`✅ Event bulundu: ${event.title}\n`);

    // Event görselini al - Doğrudan Minio path'ini kullan
    const imageKey = 'event.event-batarya';
    const imageKeyParts = imageKey.split('.');
    const imageName = imageKeyParts[imageKeyParts.length - 1]; // 'event-batarya'
    const imageUrl = `events/new-events/${imageName}.png`;

    // Yeni veriler
    const newTitle = 'Akıllı Telefon Batarya Performansı';
    const newDescription = 'Hangi telefon en uzun süre dayanıyor? Günlük kullanımda gerçek batarya deneyiminizi paylaşın. Normal kullanımda kaç saat?, yoğun kullanımda ne kadar?, hızlı şarj var mı?';
    const newStartDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000); // 12 gün önce
    const newEndDate = new Date(Date.now() + 18 * 24 * 60 * 60 * 1000); // 18 gün sonra

    // Değişiklikleri kontrol et
    const hasChanges = 
      event.title !== newTitle ||
      event.description !== newDescription ||
      event.imageUrl !== imageUrl ||
      event.startDate.getTime() !== newStartDate.getTime() ||
      event.endDate.getTime() !== newEndDate.getTime();

    if (!hasChanges) {
      console.log('⏭️  Event verileri zaten güncel, değişiklik yok.\n');
      return;
    }

    // Event'i güncelle
    const updatedEvent = await prisma.event.update({
      where: { id: EVENT_ID },
      data: {
        title: newTitle,
        description: newDescription,
        imageUrl,
        startDate: newStartDate,
        endDate: newEndDate,
      },
    });

    console.log('✅ Event verileri güncellendi:\n');
    console.log(`   📝 Başlık: ${updatedEvent.title}`);
    console.log(`   📄 Açıklama: ${updatedEvent.description?.substring(0, 80)}...`);
    console.log(`   🖼️  Görsel: ${updatedEvent.imageUrl}`);
    console.log(`   📅 Başlangıç: ${updatedEvent.startDate.toLocaleDateString('tr-TR')}`);
    console.log(`   📅 Bitiş: ${updatedEvent.endDate.toLocaleDateString('tr-TR')}`);
    console.log('\n✅ Güncelleme tamamlandı!\n');

  } catch (error) {
    console.error('\n❌ Hata:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateEventBadgeData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
