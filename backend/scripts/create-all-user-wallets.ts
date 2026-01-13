import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const prisma = getPrisma();

/**
 * TÜM kullanıcılar için wallet oluşturur
 * Zaten wallet'ı olanlar atlanır
 */
async function createAllUserWallets() {
  try {
    logger.info('🚀 Starting wallet creation for all users...');

    // Tüm kullanıcıları al
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            displayName: true
          }
        },
        wallets: {
          where: {
            isConnected: true
          },
          select: {
            id: true,
            publicAddress: true
          }
        }
      }
    });

    logger.info(`📊 Total users found: ${allUsers.length}`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of allUsers) {
      try {
        // Zaten aktif wallet'ı var mı?
        if (user.wallets.length > 0) {
          logger.info(`⏭️  User ${user.profile?.displayName || user.email} already has wallet: ${user.wallets[0].publicAddress}`);
          skipped++;
          continue;
        }

        // Benzersiz wallet adresi oluştur
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const publicAddress = `0xTIPBOX_${user.id.substring(0, 8)}_${timestamp}_${randomSuffix}`;

        // Yeni wallet oluştur
        const wallet = await prisma.wallet.create({
          data: {
            userId: user.id,
            publicAddress,
            provider: 'CUSTOM',
            isConnected: true
          }
        });

        logger.info(`✅ Wallet created for ${user.profile?.displayName || user.email}: ${wallet.publicAddress}`);
        created++;

      } catch (error) {
        logger.error(`❌ Failed to create wallet for user ${user.id}:`, error);
        failed++;
      }
    }

    // Özet rapor
    logger.info('\n' + '='.repeat(60));
    logger.info('📈 WALLET CREATION SUMMARY');
    logger.info('='.repeat(60));
    logger.info(`Total Users:        ${allUsers.length}`);
    logger.info(`✅ Wallets Created:  ${created}`);
    logger.info(`⏭️  Skipped (exists): ${skipped}`);
    logger.info(`❌ Failed:           ${failed}`);
    logger.info('='.repeat(60) + '\n');

    // Tüm wallet'ları listele
    const allWallets = await prisma.wallet.findMany({
      where: {
        isConnected: true
      },
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: {
                displayName: true
              }
            }
          }
        }
      }
    });

    logger.info('📋 ALL ACTIVE WALLETS:');
    logger.info('-'.repeat(80));
    allWallets.forEach((wallet: any, index: number) => {
      const userName = wallet.user.profile?.displayName || wallet.user.email;
      logger.info(`${index + 1}. ${userName.padEnd(30)} | ${wallet.publicAddress}`);
    });
    logger.info('-'.repeat(80));
    logger.info(`Total Active Wallets: ${allWallets.length}\n`);

    return {
      total: allUsers.length,
      created,
      skipped,
      failed
    };

  } catch (error) {
    logger.error('💥 Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script çalıştır
createAllUserWallets()
  .then((result) => {
    logger.info('✅ Wallet creation completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Wallet creation failed:', error);
    process.exit(1);
  });
