import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

/**
 * Wallet Balance Migration Script
 * 
 * Bu script mevcut wallet'ların balance'larını hesaplayıp DB'ye kaydeder.
 * İki yöntemle hesaplama yapar:
 * 1. TipsTokenTransfer tablosundan (TIPS transfers)
 * 2. Transaction tablosundan (Confirmed transactions)
 */

interface BalanceCalculation {
  walletId: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  method: 'tips' | 'transaction';
}

async function calculateTipsBasedBalance(userId: string): Promise<number> {
  const prisma = getPrisma();

  // Alınan TIPS'ler
  const receivedTips = await prisma.tipsTokenTransfer.aggregate({
    where: { toUserId: userId },
    _sum: { amount: true },
  });

  // Gönderilen TIPS'ler
  const sentTips = await prisma.tipsTokenTransfer.aggregate({
    where: { fromUserId: userId },
    _sum: { amount: true },
  });

  // Expert Request'lerde harcanan
  const spentOnExpertRequests = await prisma.expertRequest.aggregate({
    where: {
      userId,
      status: { in: ['ANSWERED', 'CLOSED'] },
    },
    _sum: { tipsAmount: true },
  });

  const received = receivedTips._sum.amount || 0;
  const sent = sentTips._sum.amount || 0;
  const spent = spentOnExpertRequests._sum.tipsAmount || 0;

  const balance = received - sent - spent;

  return Math.max(0, balance);
}

async function calculateLockedBalance(userId: string): Promise<number> {
  const prisma = getPrisma();

  // Lootbox'larda kilitli TIPS'ler
  const lockedTips = await prisma.lootbox.aggregate({
    where: {
      userId,
      status: { in: ['LOCKED', 'OPENABLE'] },
    },
    _sum: { tipsLocked: true },
  });

  return lockedTips._sum.tipsLocked || 0;
}

async function calculateTransactionBasedBalance(walletId: string): Promise<number> {
  const prisma = getPrisma();

  const transactions = await prisma.transaction.findMany({
    where: {
      walletId,
      status: 'confirmed',
      amount: { not: null },
    },
  });

  let balance = 0;
  for (const tx of transactions) {
    if (!tx.amount) continue;

    // RECEIVE types
    if ([
      'TIP_RECEIVE',
      'CLAIM_REWARD',
      'CLAIM_BADGE',
      'NFT_SELL',
      'SWAP_SOL_TO_TIP',
      'AIRDROP',
    ].includes(tx.actionType)) {
      balance += tx.amount;
    }
    // SEND types
    else if ([
      'TIP_SEND',
      'NFT_BUY',
      'SWAP_TIP_TO_SOL',
      'FEE',
    ].includes(tx.actionType)) {
      balance -= tx.amount;
    }
  }

  return Math.max(0, balance);
}

async function migrateWalletBalances() {
  const prisma = getPrisma();

  try {
    logger.info('Starting wallet balance migration...');

    // Tüm wallet'ları getir
    const wallets = await prisma.wallet.findMany({
      include: {
        user: true,
      },
    });

    logger.info(`Found ${wallets.length} wallets to migrate`);

    const results: BalanceCalculation[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const wallet of wallets) {
      try {
        // Her iki yöntemle de balance'ı hesapla
        const tipsBalance = await calculateTipsBasedBalance(wallet.userId);
        const transactionBalance = await calculateTransactionBasedBalance(wallet.id);
        const lockedBalance = await calculateLockedBalance(wallet.userId);

        // Hangisi daha büyükse onu kullan (safety için)
        const finalBalance = Math.max(tipsBalance, transactionBalance);

        logger.info({
          walletId: wallet.id,
          userId: wallet.userId,
          tipsBalance,
          transactionBalance,
          lockedBalance,
          finalBalance,
          message: 'Calculated balance for wallet',
        });

        // Wallet'ı güncelle
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: finalBalance,
            lockedBalance: lockedBalance,
          },
        });

        results.push({
          walletId: wallet.id,
          userId: wallet.userId,
          balance: finalBalance,
          lockedBalance: lockedBalance,
          method: tipsBalance >= transactionBalance ? 'tips' : 'transaction',
        });

        successCount++;
        logger.info(`✅ Migrated wallet ${wallet.id} - Balance: ${finalBalance}, Locked: ${lockedBalance}`);
      } catch (error) {
        errorCount++;
        logger.error({
          walletId: wallet.id,
          userId: wallet.userId,
          error: error instanceof Error ? error.message : String(error),
          message: '❌ Failed to migrate wallet balance',
        });
      }
    }

    // Özet
    logger.info('========================================');
    logger.info('Migration Summary:');
    logger.info(`Total Wallets: ${wallets.length}`);
    logger.info(`Successful: ${successCount}`);
    logger.info(`Failed: ${errorCount}`);
    logger.info('========================================');

    // Toplam istatistikler
    const totalBalance = results.reduce((sum, r) => sum + r.balance, 0);
    const totalLocked = results.reduce((sum, r) => sum + r.lockedBalance, 0);
    logger.info(`Total Balance: ${totalBalance} TIPS`);
    logger.info(`Total Locked: ${totalLocked} TIPS`);

    // Yöntem dağılımı
    const tipsCount = results.filter(r => r.method === 'tips').length;
    const transactionCount = results.filter(r => r.method === 'transaction').length;
    logger.info(`Calculated via Tips: ${tipsCount}`);
    logger.info(`Calculated via Transaction: ${transactionCount}`);

    logger.info('✅ Wallet balance migration completed successfully');
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      message: '❌ Wallet balance migration failed',
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
if (require.main === module) {
  migrateWalletBalances()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateWalletBalances };
