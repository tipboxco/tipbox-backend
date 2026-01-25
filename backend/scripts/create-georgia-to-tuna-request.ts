import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const TUNA_USER_ID = '7413549b-126e-4b41-a06b-c22600a85f67';

async function createGeorgiaToTunaRequest() {
  const prisma = getPrisma();

  try {
    logger.info('📝 Georgia\'dan Tuna\'ya support request oluşturuluyor...');

    const request = await prisma.dMRequest.create({
      data: {
        fromUserId: GEORGIA_USER_ID,
        toUserId: TUNA_USER_ID,
        description: 'Merhaba Tuna, teknik bir konuda yardıma ihtiyacım var. Yardımcı olabilir misin?',
        type: 'TECHNICAL',
        amount: 200,
        status: 'PENDING',
        sentAt: new Date(),
      },
    });

    logger.info(`✅ Support request oluşturuldu: ${request.id}`);
    console.log(`\n✅ Support request oluşturuldu!`);
    console.log(`   Request ID: ${request.id}`);
    console.log(`   From: Georgia (${GEORGIA_USER_ID})`);
    console.log(`   To: Tuna (${TUNA_USER_ID})`);
    console.log(`   Status: ${request.status}`);
    
    return request.id;
  } catch (error) {
    logger.error('❌ Support request oluşturulurken hata oluştu:', error);
    console.error('❌ Support request oluşturulurken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createGeorgiaToTunaRequest()
    .then((requestId) => {
      console.log(`\nRequest ID: ${requestId}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createGeorgiaToTunaRequest };
