import { PrismaClient } from '@prisma/client';
import { WishboxEventStatus } from '../../src/domain/wishbox/wishbox-event-status.enum';

export async function ensureTestEvent(prisma: PrismaClient): Promise<string> {
  console.log('\n📅 Seeding Test Event...');

  try {
    // Check if test event already exists
    const existingEvent = await prisma.wishboxEvent.findFirst({
      where: { 
        title: 'Yeni Yıl İçerik Yarışması',
      },
    });

    if (existingEvent) {
      console.log('  ⏭️  Test event already exists:', existingEvent.id);
      
      // Event'in bitiş tarihini kontrol et, geçmişse güncelle
      const now = new Date();
      if (existingEvent.endDate < now) {
        const newEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 gün sonra
        await prisma.wishboxEvent.update({
          where: { id: existingEvent.id },
          data: {
            endDate: newEndDate,
            status: WishboxEventStatus.PUBLISHED,
          },
        });
        console.log('  ✅ Test event end date updated to:', newEndDate.toISOString());
      }
      
      return existingEvent.id;
    }

    // Create test event
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 gün sonra

    // ULID benzeri ID oluştur (26 karakter)
    const generateEventId = () => {
      const timestamp = Date.now().toString(36).toUpperCase().padStart(10, '0');
      const random = Math.random().toString(36).substring(2, 18).toUpperCase().padEnd(16, '0');
      return timestamp + random;
    };

    const event = await prisma.wishboxEvent.create({
      data: {
        id: generateEventId(),
        title: 'Yeni Yıl İçerik Yarışması',
        description: 'Post paylaş, beğeni topla, rozet kazan! Event süresince aktif ol ve özel rozetleri kap.',
        startDate: now,
        endDate: endDate,
        status: WishboxEventStatus.PUBLISHED,
        imageUrl: 'event/test-event-banner.png', // TODO: Gerçek event görseli eklenebilir
      },
    });

    console.log('  ✅ Test event created:', event.id);
    console.log(`     Start: ${event.startDate.toISOString()}`);
    console.log(`     End: ${event.endDate.toISOString()}`);
    console.log(`     Status: ${event.status}`);

    return event.id;
  } catch (error) {
    console.error('❌ Error seeding test event:', error);
    throw error;
  }
}
