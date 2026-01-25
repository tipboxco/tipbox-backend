import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const REQUEST_ID = '1f10a2f3-1dca-4e1e-86c6-3cbfa76213ae';
const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function georgiaCloseRequest() {
  const prisma = getPrisma();

  try {
    logger.info('🔒 Georgia close request oluşturuyor...');

    await prisma.dMRequest.update({
      where: { id: REQUEST_ID },
      data: {
        status: 'AWAITING_COMPLETION',
        fromUserRating: 5,
        closedByFromUserAt: new Date(),
      },
    });

    logger.info('✅ Georgia close request oluşturdu');
    console.log('\n✅ Georgia close request oluşturdu!');
    console.log(`   Request ID: ${REQUEST_ID}`);
    console.log(`   Status: AWAITING_COMPLETION`);
    console.log(`   Rating: 5`);
  } catch (error) {
    logger.error('❌ Close request oluşturulurken hata oluştu:', error);
    console.error('❌ Close request oluşturulurken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  georgiaCloseRequest()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { georgiaCloseRequest };
