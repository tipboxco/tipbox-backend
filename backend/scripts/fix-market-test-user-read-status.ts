/**
 * Market Test User'ın okunmamış mesajlarını okundu olarak işaretle (direkt DB güncelleme)
 */

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

async function fixReadStatus() {
  try {
    const prisma = getPrisma();
    
    console.log('📋 Market Test User okunmamış mesajları düzeltiliyor...\n');
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
      select: {
        id: true,
        message: true,
        threadId: true,
        sentAt: true,
      },
    });

    console.log(`\n📥 ${unreadMessages.length} okunmamış mesaj bulundu:\n`);
    
    if (unreadMessages.length === 0) {
      console.log('✅ Tüm mesajlar zaten okunmuş!\n');
      return;
    }

    // Mesajları listele
    unreadMessages.forEach((msg, index) => {
      console.log(`${index + 1}. Mesaj ID: ${msg.id}`);
      console.log(`   Mesaj: ${msg.message || '(boş)'}`);
      console.log(`   Thread: ${msg.threadId}`);
      console.log(`   Tarih: ${msg.sentAt.toISOString()}\n`);
    });

    // Tüm mesajları okundu olarak işaretle
    console.log('🔄 Mesajlar okundu olarak işaretleniyor...\n');
    
    const result = await prisma.dMMessage.updateMany({
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
      data: {
        isRead: true,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ ${result.count} mesaj okundu olarak işaretlendi!\n`);

    // Thread'lerdeki unread count'ları güncelle
    const threads = await prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: MARKET_TEST_USER_ID },
          { userTwoId: MARKET_TEST_USER_ID },
        ],
      },
    });

    console.log(`🔄 Thread unread count'ları güncelleniyor...\n`);

    for (const thread of threads) {
      const isUserOne = thread.userOneId === MARKET_TEST_USER_ID;
      
      // Unread count'u hesapla
      const unreadCount = await prisma.dMMessage.count({
        where: {
          threadId: thread.id,
          senderId: {
            not: MARKET_TEST_USER_ID,
          },
          isRead: false,
        },
      });

      // Thread'i güncelle
      if (isUserOne) {
        await prisma.dMThread.update({
          where: { id: thread.id },
          data: {
            unreadCountUserOne: unreadCount,
            updatedAt: new Date(),
          } as any,
        });
      } else {
        await prisma.dMThread.update({
          where: { id: thread.id },
          data: {
            unreadCountUserTwo: unreadCount,
            updatedAt: new Date(),
          } as any,
        });
      }

      console.log(`   Thread ${thread.id}: unreadCount = ${unreadCount}`);
    }

    console.log('\n✅ Tüm işlemler tamamlandı!\n');

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

    console.log('='.repeat(100));
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
fixReadStatus();
