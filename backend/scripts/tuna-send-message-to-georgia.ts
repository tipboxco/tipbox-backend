import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';
import { MessagingService } from '../src/application/messaging/messaging.service';

const TUNA_ID = '7413549b-126e-4b41-a06b-c22600a85f67';
const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function tunaSendMessageToGeorgia() {
  const prisma = getPrisma();

  try {
    logger.info(`💬 Tuna (${TUNA_ID}) kullanıcısından Georgia'ya (${GEORGIA_ID}) mesaj gönderiliyor...`);

    // Thread oluştur veya bul
    let thread = await prisma.dMThread.findFirst({
      where: {
        isSupportThread: false,
        OR: [
          { userOneId: TUNA_ID, userTwoId: GEORGIA_ID },
          { userOneId: GEORGIA_ID, userTwoId: TUNA_ID },
        ],
      },
    });

    if (!thread) {
      thread = await prisma.dMThread.create({
        data: {
          userOneId: TUNA_ID,
          userTwoId: GEORGIA_ID,
          isActive: true,
          isSupportThread: false,
          startedAt: new Date(),
        },
      });
      logger.info(`✅ Yeni thread oluşturuldu: ${thread.id}`);
    } else {
      logger.info(`✅ Mevcut thread bulundu: ${thread.id}`);
    }

    // Mesaj oluştur
    const message = await prisma.dMMessage.create({
      data: {
        threadId: thread.id,
        senderId: TUNA_ID,
        message: 'Merhaba Georgia! Nasılsın? Uzun zamandır görüşemedik.',
        isRead: false,
        context: 'DM',
        sentAt: new Date(),
      },
    });

    // Thread'i güncelle
    await prisma.dMThread.update({
      where: { id: thread.id },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.sentAt,
        updatedAt: new Date(),
        unreadCountUserTwo: { increment: 1 }, // Georgia için unread count artır
      },
    });

    logger.info('✅ Mesaj başarıyla gönderildi!');
    console.log('\n✅ Mesaj başarıyla gönderildi!');
    console.log('   Gönderen: Tuna');
    console.log('   Alıcı: Georgia');
    console.log('   Mesaj: "Merhaba Georgia! Nasılsın? Uzun zamandır görüşemedik."');
    console.log(`   Thread ID: ${thread.id}`);
    console.log(`   Message ID: ${message.id}`);
  } catch (error) {
    logger.error('❌ Mesaj gönderilirken hata oluştu:', error);
    console.error('❌ Mesaj gönderilirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  tunaSendMessageToGeorgia()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { tunaSendMessageToGeorgia };
