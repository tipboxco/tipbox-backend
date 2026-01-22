/**
 * Market Test User'ın Ömer (Georgia Green) kullanıcısına attığı mesajları sil ve thread'i kapat
 */

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

async function deleteMessagesAndCloseThread() {
  try {
    const prisma = getPrisma();
    
    console.log('📋 Market Test User mesajları siliniyor ve thread kapatılıyor...\n');
    console.log('='.repeat(100));
    
    // Market Test User ID'si
    const MARKET_TEST_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';
    // Georgia Green (Ömer) ID'si
    const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
    
    // Market Test User ve Georgia arasındaki thread'leri bul
    const threads = await prisma.dMThread.findMany({
      where: {
        OR: [
          {
            userOneId: MARKET_TEST_USER_ID,
            userTwoId: GEORGIA_USER_ID,
          },
          {
            userOneId: GEORGIA_USER_ID,
            userTwoId: MARKET_TEST_USER_ID,
          },
        ],
      },
      include: {
        messages: {
          where: {
            senderId: MARKET_TEST_USER_ID,
          },
          select: {
            id: true,
            message: true,
            sentAt: true,
          },
        },
      },
    });

    if (threads.length === 0) {
      console.log('❌ Market Test User ve Georgia arasında thread bulunamadı.\n');
      return;
    }

    console.log(`\n📝 ${threads.length} thread bulundu:\n`);

    for (const thread of threads) {
      console.log(`Thread ID: ${thread.id}`);
      console.log(`   User One: ${thread.userOneId}`);
      console.log(`   User Two: ${thread.userTwoId}`);
      console.log(`   Market Test User'ın gönderdiği mesaj sayısı: ${thread.messages.length}\n`);

      // Market Test User'ın gönderdiği mesajları sil
      if (thread.messages.length > 0) {
        console.log('🗑️  Mesajlar siliniyor...\n');
        
        for (const message of thread.messages) {
          console.log(`   - Mesaj ID: ${message.id}`);
          console.log(`     Mesaj: ${message.message || '(boş)'}`);
          console.log(`     Tarih: ${message.sentAt.toISOString()}`);
          
          // Mesajı sil (soft delete)
          await prisma.dMMessage.update({
            where: { id: message.id },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: MARKET_TEST_USER_ID,
            },
          });
          
          console.log(`     ✅ Silindi\n`);
        }
      }

      // Thread'i kapat (isActive = false)
      console.log('🔒 Thread kapatılıyor...\n');
      await prisma.dMThread.update({
        where: { id: thread.id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
      
      console.log(`   ✅ Thread ${thread.id} kapatıldı\n`);
    }

    console.log('='.repeat(100));
    console.log('\n✅ Tüm işlemler tamamlandı!\n');

    // Kontrol et
    const remainingThreads = await prisma.dMThread.findMany({
      where: {
        OR: [
          {
            userOneId: MARKET_TEST_USER_ID,
            userTwoId: GEORGIA_USER_ID,
          },
          {
            userOneId: GEORGIA_USER_ID,
            userTwoId: MARKET_TEST_USER_ID,
          },
        ],
        isActive: true,
      },
    });

    if (remainingThreads.length === 0) {
      console.log('✅ Tüm thread\'ler başarıyla kapatıldı!\n');
    } else {
      console.log(`⚠️  Hala ${remainingThreads.length} aktif thread var.\n`);
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
deleteMessagesAndCloseThread();
