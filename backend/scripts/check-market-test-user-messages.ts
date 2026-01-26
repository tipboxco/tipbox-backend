/**
 * Market Test User kullanıcısının mesajlarını ve okundu durumlarını kontrol et
 */

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

async function checkMarketTestUserMessages() {
  try {
    const prisma = getPrisma();
    
    console.log('📋 Market Test User mesajları kontrol ediliyor...\n');
    console.log('='.repeat(100));
    
    // Market Test User ID'si
    const MARKET_TEST_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';
    
    // Kullanıcı bilgisini al
    const user = await prisma.user.findUnique({
      where: { id: MARKET_TEST_USER_ID },
      include: {
        profile: true,
      },
    });

    if (!user) {
      console.log('❌ Market Test User bulunamadı!');
      return;
    }

    console.log(`👤 Kullanıcı: ${user.profile?.displayName || 'Market Test User'}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user.id}\n`);

    // Gönderilen mesajlar
    const sentMessages = await prisma.dMMessage.findMany({
      where: {
        senderId: MARKET_TEST_USER_ID,
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
      take: 10,
    });

    console.log(`\n📤 Gönderilen mesajlar (${sentMessages.length}):\n`);
    sentMessages.forEach((msg, index) => {
      console.log(`${index + 1}. Mesaj ID: ${msg.id}`);
      console.log(`   Thread ID: ${msg.threadId}`);
      console.log(`   Mesaj: ${msg.message || '(boş)'}`);
      console.log(`   Tarih: ${msg.sentAt.toISOString()}`);
      console.log(`   isRead: ${msg.isRead}`);
      console.log(`   Alıcı: ${msg.thread.userOneId === MARKET_TEST_USER_ID ? msg.thread.userTwoId : msg.thread.userOneId}`);
      console.log('');
    });

    // Alınan mesajlar
    const receivedMessages = await prisma.dMMessage.findMany({
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
      take: 10,
    });

    console.log(`\n📥 Alınan mesajlar (${receivedMessages.length}):\n`);
    receivedMessages.forEach((msg, index) => {
      console.log(`${index + 1}. Mesaj ID: ${msg.id}`);
      console.log(`   Gönderen: ${msg.senderId}`);
      console.log(`   Thread ID: ${msg.threadId}`);
      console.log(`   Mesaj: ${msg.message || '(boş)'}`);
      console.log(`   Tarih: ${msg.sentAt.toISOString()}`);
      console.log(`   isRead: ${msg.isRead}`);
      console.log('');
    });

    // Read receipts kontrolü
    const readReceipts = await prisma.messageReadReceipt.findMany({
      where: {
        userId: MARKET_TEST_USER_ID,
      },
      include: {
        message: {
          select: {
            id: true,
            message: true,
            sentAt: true,
          },
        },
      },
      orderBy: {
        readAt: 'desc',
      },
      take: 10,
    });

    console.log(`\n✅ Okundu işaretleri (Read Receipts) (${readReceipts.length}):\n`);
    readReceipts.forEach((receipt, index) => {
      console.log(`${index + 1}. Receipt ID: ${receipt.id}`);
      console.log(`   Mesaj ID: ${receipt.messageId}`);
      console.log(`   Mesaj: ${receipt.message?.message || '(boş)'}`);
      console.log(`   Okundu Tarihi: ${receipt.readAt.toISOString()}`);
      console.log('');
    });

    // Thread'lerdeki okunmamış mesaj sayısı
    const threads = await prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: MARKET_TEST_USER_ID },
          { userTwoId: MARKET_TEST_USER_ID },
        ],
      },
      include: {
        messages: {
          where: {
            senderId: {
              not: MARKET_TEST_USER_ID,
            },
            isRead: false,
          },
          select: {
            id: true,
            message: true,
            sentAt: true,
          },
        },
      },
    });

    console.log(`\n💬 Thread'ler ve okunmamış mesajlar:\n`);
    threads.forEach((thread, index) => {
      const otherUserId = thread.userOneId === MARKET_TEST_USER_ID 
        ? thread.userTwoId 
        : thread.userOneId;
      console.log(`${index + 1}. Thread ID: ${thread.id}`);
      console.log(`   Diğer Kullanıcı: ${otherUserId}`);
      console.log(`   Okunmamış Mesaj Sayısı: ${thread.messages.length}`);
      if (thread.messages.length > 0) {
        thread.messages.forEach((msg, msgIndex) => {
          console.log(`      ${msgIndex + 1}. Mesaj ID: ${msg.id} - ${msg.message || '(boş)'} (${msg.sentAt.toISOString()})`);
        });
      }
      console.log('');
    });

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
checkMarketTestUserMessages();
