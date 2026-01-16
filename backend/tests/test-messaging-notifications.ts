import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import { MessagingService } from './src/application/messaging/messaging.service';
import logger from './src/infrastructure/logger/logger';
import RedisConfigManager from './src/infrastructure/config/redis.config';
import QueueProvider from './src/infrastructure/queue/queue.provider';
import SocketManager from './src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';

const prisma = new PrismaClient();
const notificationService = new NotificationService();
const messagingService = new MessagingService();

// Mesajlaşma bildirim tipleri
const MESSAGING_NOTIFICATION_TYPES = [
  NotificationType.NEW_MESSAGE,
  NotificationType.DM_REQUEST_RECEIVED,
  NotificationType.DM_REQUEST_ACCEPTED,
  NotificationType.SUPPORT_REQUEST_ACCEPTED,
];

// Gerçekçi mesaj metinleri
const MESSAGE_TEXTS = [
  'Merhaba! Nasılsın?',
  'Harika bir gün!',
  'Bir sorum var, yardımcı olabilir misin?',
  'Selam! Nasıl gidiyor?',
  'Merhaba, nasılsın?',
  'Harika bir paylaşım yaptın!',
  'Teşekkürler!',
  'Çok faydalı oldu.',
  'Bir konuda danışmak istiyorum.',
  'Harika bilgiler paylaştın, teşekkürler!',
];

async function initializeServices() {
  try {
    console.log('🔧 Servisler başlatılıyor...');
    await RedisConfigManager.getInstance().initialize();
    await QueueProvider.getInstance().initialize();
    
    const httpServer = http.createServer();
    const io = new Server(httpServer, {
      cors: { origin: '*' },
      transports: ['websocket', 'polling'],
    });
    SocketManager.getInstance().initialize(io);
    
    console.log('✅ Servisler başlatıldı!\n');
  } catch (error: any) {
    console.log(`⚠️  Servis uyarısı: ${error.message}\n`);
  }
}

async function ensureUsers() {
  console.log('👤 Kullanıcılar kontrol ediliyor...');
  
  // Ömer kullanıcısını bul
  const omer = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'omer', mode: 'insensitive' } },
        { profile: { displayName: { contains: 'omer', mode: 'insensitive' } } },
      ],
    },
    include: {
      profile: true,
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!omer) {
    throw new Error('Ömer kullanıcısı bulunamadı!');
  }

  console.log(`✅ Ömer bulundu: ${omer.profile?.displayName || omer.email} (${omer.id})`);

  // Farklı kullanıcılar bul (Trust User 1, 2, 3 vb.)
  const otherUsers = await prisma.user.findMany({
    where: {
      id: { not: omer.id },
      email: { contains: 'trust', mode: 'insensitive' },
    },
    include: {
      profile: true,
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
    take: 5,
  });

  if (otherUsers.length === 0) {
    throw new Error('Diğer kullanıcılar bulunamadı!');
  }

  console.log(`✅ ${otherUsers.length} kullanıcı bulundu:\n`);
  otherUsers.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.profile?.displayName || user.email} (${user.id})`);
  });
  console.log('');

  return { omer, otherUsers };
}

async function sendMessagingNotification(
  type: NotificationType,
  omerId: string,
  senderId: string,
  senderName: string
) {
  try {
    console.log(`\n📨 ${type} bildirimi gönderiliyor...`);
    console.log(`   Gönderen: ${senderName} (${senderId})`);

    switch (type) {
      case NotificationType.NEW_MESSAGE: {
        // Senaryo: Sender'dan Ömer'e mesaj gönder
        const messageText = MESSAGE_TEXTS[Math.floor(Math.random() * MESSAGE_TEXTS.length)];
        
        // Mevcut thread var mı kontrol et
        let thread = await prisma.dMThread.findFirst({
          where: {
            OR: [
              { userOneId: senderId, userTwoId: omerId },
              { userOneId: omerId, userTwoId: senderId },
            ],
            isActive: true,
          },
        });

        if (!thread) {
          // Yeni thread oluştur
          thread = await prisma.dMThread.create({
            data: {
              userOneId: senderId,
              userTwoId: omerId,
              isActive: true,
              startedAt: new Date(),
            },
          });
          console.log(`   ✅ Yeni thread oluşturuldu: ${thread.id}`);
        }

        // Gerçek mesaj gönder
        await messagingService.sendDirectMessage(senderId, omerId, messageText);
        console.log(`   ✅ Mesaj gönderildi: "${messageText.substring(0, 50)}..."`);
        break;
      }

      case NotificationType.DM_REQUEST_RECEIVED: {
        // Senaryo: Sender Ömer'e DM isteği gönderiyor
        // Önce mevcut thread var mı kontrol et
        const existingThread = await prisma.dMThread.findFirst({
          where: {
            OR: [
              { userOneId: senderId, userTwoId: omerId },
              { userOneId: omerId, userTwoId: senderId },
            ],
          },
        });

        if (!existingThread) {
          // DM isteği için thread oluştur (isActive: false olabilir veya özel bir durum)
          // Bu durumda direkt mesaj göndererek istek simüle ediyoruz
          // Gerçek sistemde DM_REQUEST için özel bir mekanizma olabilir
          const messageText = 'Merhaba! Sana mesaj göndermek istiyorum.';
          await messagingService.sendDirectMessage(senderId, omerId, messageText);
          console.log(`   ✅ DM isteği gönderildi (mesaj ile simüle edildi)`);
        } else {
          // Thread varsa direkt mesaj gönder
          const messageText = 'Yeni bir mesajım var!';
          await messagingService.sendDirectMessage(senderId, omerId, messageText);
          console.log(`   ✅ DM isteği gönderildi (mevcut thread üzerinden)`);
        }
        break;
      }

      case NotificationType.DM_REQUEST_ACCEPTED: {
        // Senaryo: Ömer'in gönderdiği DM isteği kabul edildi
        // Önce Ömer'den sender'a bir mesaj gönder (istek simülasyonu)
        const requestMessage = 'Merhaba! Sana mesaj göndermek istiyorum.';
        
        // Thread oluştur veya bul
        let thread = await prisma.dMThread.findFirst({
          where: {
            OR: [
              { userOneId: omerId, userTwoId: senderId },
              { userOneId: senderId, userTwoId: omerId },
            ],
          },
        });

        if (!thread) {
          thread = await prisma.dMThread.create({
            data: {
              userOneId: omerId,
              userTwoId: senderId,
              isActive: true,
              startedAt: new Date(),
            },
          });
        }

        // Önce Ömer'den mesaj gönder (istek)
        await messagingService.sendDirectMessage(omerId, senderId, requestMessage);
        
        // Sonra sender'dan cevap gönder (kabul)
        const acceptMessage = 'Tabii ki! Mesajlaşabiliriz.';
        await messagingService.sendDirectMessage(senderId, omerId, acceptMessage);
        
        console.log(`   ✅ DM isteği kabul edildi (thread: ${thread.id})`);
        break;
      }

      case NotificationType.SUPPORT_REQUEST_ACCEPTED: {
        // Senaryo: Ömer'in destek talebi kabul edildi
        // Support thread oluştur
        let supportThread = await prisma.dMThread.findFirst({
          where: {
            OR: [
              { userOneId: omerId, userTwoId: senderId, isSupportThread: true },
              { userOneId: senderId, userTwoId: omerId, isSupportThread: true },
            ],
          },
        });

        if (!supportThread) {
          supportThread = await prisma.dMThread.create({
            data: {
              userOneId: omerId,
              userTwoId: senderId,
              isActive: true,
              isSupportThread: true,
              startedAt: new Date(),
            },
          });
        }

        // Önce Ömer'den destek talebi gönder
        const supportRequest = 'Bir sorunum var, yardımcı olabilir misiniz?';
        await messagingService.sendDirectMessage(omerId, senderId, supportRequest);
        
        // Sonra sender'dan kabul mesajı gönder
        const acceptMessage = 'Tabii ki! Size nasıl yardımcı olabilirim?';
        await messagingService.sendDirectMessage(senderId, omerId, acceptMessage);
        
        console.log(`   ✅ Destek talebi kabul edildi (support thread: ${supportThread.id})`);
        break;
      }
    }

    console.log(`   ✅ ${type} bildirimi gönderildi!`);
    
  } catch (error: any) {
    console.error(`   ❌ ${type} bildirimi gönderilirken hata:`, error.message);
    logger.error(`Error sending ${type} notification:`, error);
  }
}

async function startMessagingNotifications() {
  try {
    await initializeServices();
    const { omer, otherUsers } = await ensureUsers();

    console.log('🚀 Mesajlaşma bildirim testi başlatılıyor...');
    console.log(`📊 Toplam 10 adet mesajlaşma bildirimi gönderilecek\n`);
    console.log('⏰ Her 5 saniyede bir bildirim gönderilecek\n');
    console.log('📋 Senaryolar:\n');
    console.log('   - NEW_MESSAGE: Farklı kullanıcılardan gerçek mesajlar');
    console.log('   - DM_REQUEST_RECEIVED: DM istekleri');
    console.log('   - DM_REQUEST_ACCEPTED: DM isteklerinin kabul edilmesi');
    console.log('   - SUPPORT_REQUEST_ACCEPTED: Destek taleplerinin kabul edilmesi\n');

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 10 adet bildirim gönder (her tip 2-3 kez, farklı kullanıcılardan)
    for (let i = 0; i < 10; i++) {
      const type = MESSAGING_NOTIFICATION_TYPES[i % MESSAGING_NOTIFICATION_TYPES.length];
      const sender = otherUsers[i % otherUsers.length];
      const senderName = sender.profile?.displayName || sender.email || 'Kullanıcı';
      
      await sendMessagingNotification(type, omer.id, sender.id, senderName);
      
      if (i < 9) {
        console.log(`\n⏳ 5 saniye bekleniyor...\n`);
        await delay(5000);
      }
    }

    console.log('\n✅ Tüm mesajlaşma bildirimleri gönderildi!');
    console.log(`📊 Toplam: 10 bildirim`);
    console.log(`   - NEW_MESSAGE: ${Math.ceil(10 / 4)} adet`);
    console.log(`   - DM_REQUEST_RECEIVED: ${Math.ceil(10 / 4)} adet`);
    console.log(`   - DM_REQUEST_ACCEPTED: ${Math.floor(10 / 4)} adet`);
    console.log(`   - SUPPORT_REQUEST_ACCEPTED: ${Math.floor(10 / 4)} adet\n`);

    await prisma.$disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Hata:', error);
    logger.error('Messaging notification test error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Script'i çalıştır
startMessagingNotifications().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
