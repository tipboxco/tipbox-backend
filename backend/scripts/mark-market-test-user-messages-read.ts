/**
 * Market Test User'ın tüm mesajlarını okundu olarak işaretle
 */

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { MessagingService } from '../src/application/messaging/messaging.service';

async function markMessagesAsRead() {
  try {
    const prisma = getPrisma();
    const messagingService = new MessagingService();
    
    console.log('📋 Market Test User mesajları okundu olarak işaretleniyor...\n');
    console.log('='.repeat(100));
    
    // Market Test User ID'si
    const MARKET_TEST_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';
    
    // Okunmamış mesajları bul
    const unreadMessages = await prisma.dMMessage.findMany({
      where: {
        thread: {
          OR: [
            { userOneId: MARKET_TEST_USER_ID },
            { userTwoId: MARKET_TEST_USER_ID },
          ],
        },
        senderId: {
          not: MARKET_TEST_USER_ID,
        },
        isRead: false,
      },
      include: {
        thread: {
          select: {
            id: true,
            userOneId: true,
            userTwoId: true,
          },
        },
      },
    });

    console.log(`\n📥 ${unreadMessages.length} okunmamış mesaj bulundu:\n`);
    
    if (unreadMessages.length === 0) {
      console.log('✅ Tüm mesajlar zaten okunmuş!\n');
      return;
    }

    // Her mesajı okundu olarak işaretle
    let successCount = 0;
    let errorCount = 0;

    for (const message of unreadMessages) {
      try {
        console.log(`📖 Mesaj işaretleniyor: ${message.id}`);
        console.log(`   Mesaj: ${message.message || '(boş)'}`);
        console.log(`   Thread: ${message.threadId}`);
        
        await messagingService.markMessageAsRead(message.id, MARKET_TEST_USER_ID);
        
        console.log(`   ✅ Başarılı\n`);
        successCount++;
      } catch (error: any) {
        console.log(`   ❌ Hata: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log('='.repeat(100));
    console.log(`\n📊 Özet:`);
    console.log(`   ✅ Başarılı: ${successCount}`);
    console.log(`   ❌ Hatalı: ${errorCount}`);
    console.log(`   📝 Toplam: ${unreadMessages.length}\n`);

    // Tekrar kontrol et
    const remainingUnread = await prisma.dMMessage.count({
      where: {
        thread: {
          OR: [
            { userOneId: MARKET_TEST_USER_ID },
            { userTwoId: MARKET_TEST_USER_ID },
          ],
        },
        senderId: {
          not: MARKET_TEST_USER_ID,
        },
        isRead: false,
      },
    });

    if (remainingUnread === 0) {
      console.log('✅ Tüm mesajlar başarıyla okundu olarak işaretlendi!\n');
    } else {
      console.log(`⚠️  Hala ${remainingUnread} okunmamış mesaj var.\n`);
    }

  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    const prisma = getPrisma();
    await prisma.$disconnect();
  }
}

// Script çalıştır
markMessagesAsRead();
