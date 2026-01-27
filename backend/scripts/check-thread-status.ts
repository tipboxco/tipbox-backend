import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const THREAD_ID = '650e7cb4-462f-4162-9656-64c42b86c841';

async function checkThreadStatus() {
  const prisma = getPrisma();

  try {
    logger.info(`🔍 Thread durumu kontrol ediliyor: ${THREAD_ID}`);

    // Thread'i bul
    const thread = await prisma.dMThread.findUnique({
      where: { id: THREAD_ID },
      include: {
        messages: {
          select: {
            id: true,
            message: true,
            sentAt: true,
            senderId: true,
            isDeleted: true,
          },
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!thread) {
      logger.info('❌ Thread bulunamadı (tamamen silinmiş olabilir)');
      console.log('\n❌ Thread bulunamadı (tamamen silinmiş olabilir)');
      
      // Thread olmadan mesajları kontrol et
      const orphanMessages = await prisma.dMMessage.findMany({
        where: { threadId: THREAD_ID },
        select: {
          id: true,
          message: true,
          sentAt: true,
          senderId: true,
        },
      });

      if (orphanMessages.length > 0) {
        console.log(`\n⚠️  Thread silinmiş ama ${orphanMessages.length} mesaj hala var!`);
        console.log('Mesajlar:');
        orphanMessages.forEach((msg, idx) => {
          console.log(`  ${idx + 1}. ID: ${msg.id}`);
          console.log(`     Mesaj: ${msg.message || '(boş)'}`);
          console.log(`     Gönderen: ${msg.senderId}`);
          console.log(`     Tarih: ${msg.sentAt.toISOString()}`);
        });
      } else {
        console.log('\n✅ Thread ve mesajları temizlenmiş');
      }
      return;
    }

    console.log('\n📋 Thread Bilgileri:');
    console.log(`   ID: ${thread.id}`);
    console.log(`   isActive: ${thread.isActive}`);
    console.log(`   isSupportThread: ${thread.isSupportThread}`);
    console.log(`   userOneId: ${thread.userOneId}`);
    console.log(`   userTwoId: ${thread.userTwoId}`);
    console.log(`   Mesaj sayısı: ${thread.messages.length}`);

    if (thread.messages.length > 0) {
      console.log('\n📨 Mesajlar:');
      thread.messages.forEach((msg, idx) => {
        console.log(`  ${idx + 1}. ID: ${msg.id}`);
        console.log(`     Mesaj: ${msg.message || '(boş)'}`);
        console.log(`     Gönderen: ${msg.senderId}`);
        console.log(`     Silinmiş: ${msg.isDeleted || false}`);
        console.log(`     Tarih: ${msg.sentAt.toISOString()}`);
      });
    }

    if (!thread.isActive && thread.messages.length > 0) {
      console.log('\n⚠️  Thread silinmiş (isActive=false) ama mesajlar hala var!');
    }
  } catch (error) {
    logger.error('❌ Thread kontrol edilirken hata oluştu:', error);
    console.error('❌ Thread kontrol edilirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  checkThreadStatus()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { checkThreadStatus };
