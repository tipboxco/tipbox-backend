/**
 * Veritabanındaki mesajları kontrol et
 */

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

async function checkMessages() {
  try {
    const prisma = getPrisma();
    
    console.log('📋 Veritabanındaki son mesajlar:\n');
    console.log('='.repeat(100));
    
    // Tuna kullanıcısının ID'si
    const TUNA_USER_ID = '7413549b-126e-4b41-a06b-c22600a85f67';
    // Georgia Green kullanıcısının ID'si
    const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
    
    // Tuna'dan Georgia'ya gönderilen mesajları kontrol et
    const messages = await prisma.dMMessage.findMany({
      where: {
        OR: [
          {
            senderId: TUNA_USER_ID,
            thread: {
              OR: [
                { userOneId: GEORGIA_USER_ID },
                { userTwoId: GEORGIA_USER_ID },
              ],
            },
          },
          {
            senderId: GEORGIA_USER_ID,
            thread: {
              OR: [
                { userOneId: TUNA_USER_ID },
                { userTwoId: TUNA_USER_ID },
              ],
            },
          },
        ],
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
      orderBy: {
        sentAt: 'desc',
      },
      take: 20,
    });

    if (messages.length === 0) {
      console.log('❌ Tuna ve Georgia arasında mesaj bulunamadı.\n');
      
      // Tüm son mesajları göster
      console.log('\n📨 Veritabanındaki son 10 mesaj (tüm kullanıcılar):\n');
      const allMessages = await prisma.dMMessage.findMany({
        include: {
          thread: {
            select: {
              id: true,
              userOneId: true,
              userTwoId: true,
            },
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
        take: 10,
      });

      allMessages.forEach((msg, index) => {
        console.log(`${index + 1}. Mesaj ID: ${msg.id}`);
        console.log(`   Gönderen: ${msg.senderId}`);
        console.log(`   Thread ID: ${msg.threadId}`);
        console.log(`   Mesaj: ${msg.message || '(boş)'}`);
        console.log(`   Tarih: ${msg.sentAt.toISOString()}`);
        console.log(`   Thread: UserOne=${msg.thread.userOneId}, UserTwo=${msg.thread.userTwoId}`);
        console.log('');
      });
      
      return;
    }

    console.log(`\n✅ Tuna ve Georgia arasında ${messages.length} mesaj bulundu:\n`);
    
    messages.forEach((msg, index) => {
      const isFromTuna = msg.senderId === TUNA_USER_ID;
      const senderName = isFromTuna ? 'Tuna' : 'Georgia';
      
      console.log(`${index + 1}. ${senderName} → ${isFromTuna ? 'Georgia' : 'Tuna'}`);
      console.log(`   Mesaj ID: ${msg.id}`);
      console.log(`   Gönderen ID: ${msg.senderId}`);
      console.log(`   Thread ID: ${msg.threadId}`);
      console.log(`   Mesaj: ${msg.message || '(boş)'}`);
      console.log(`   Tarih: ${msg.sentAt.toISOString()}`);
      console.log(`   Okundu: ${msg.isRead ? 'Evet' : 'Hayır'}`);
      if (msg.mediaUrl) {
        console.log(`   Medya: ${msg.mediaUrl}`);
      }
      console.log('');
    });

    // Thread bilgisi
    if (messages.length > 0) {
      const thread = messages[0].thread;
      console.log('📝 Thread Bilgisi:');
      console.log(`   Thread ID: ${thread.id}`);
      console.log(`   User One: ${thread.userOneId}`);
      console.log(`   User Two: ${thread.userTwoId}`);
      console.log(`   Tuna ID: ${TUNA_USER_ID}`);
      console.log(`   Georgia ID: ${GEORGIA_USER_ID}`);
      console.log('');
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
checkMessages();
