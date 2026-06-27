import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { getWelcomeDepositConfig } from '../../infrastructure/config/welcome-deposit.config';
import { invalidateWalletCache } from '../../infrastructure/cache/cache-invalidation';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';

export class WelcomeDepositService {
  constructor(
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly userRepo = new UserPrismaRepository(),
    private readonly prisma = getPrisma(),
  ) {}

  async grant(recipientUserId: string, recipientWalletId: string): Promise<void> {
    const config = getWelcomeDepositConfig();
    if (!config.enabled) return;

    const sourceUser = await this.userRepo.findByEmail(config.sourceUserEmail);
    if (!sourceUser) {
      logger.warn(
        { email: config.sourceUserEmail },
        'welcome deposit: kaynak kullanıcı bulunamadı',
      );
      return;
    }

    const sourceWallets = await this.walletRepo.findByUserId(sourceUser.id);
    if (sourceWallets.length === 0) {
      logger.warn(
        { sourceUserId: sourceUser.id },
        'welcome deposit: kaynak wallet bulunamadı',
      );
      return;
    }

    const sourceWallet =
      sourceWallets.find((w) => w.isConnected) ?? sourceWallets[0];

    if (sourceWallet.getAvailableBalance() < config.amount) {
      logger.error(
        {
          sourceWalletId: sourceWallet.id,
          available: sourceWallet.getAvailableBalance(),
          required: config.amount,
        },
        'welcome deposit: kaynak wallet yetersiz bakiye',
      );
      return;
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const deductResult = await tx.wallet.updateMany({
        where: { id: sourceWallet.id, balance: { gte: config.amount } },
        data: { balance: { increment: -config.amount } },
      });

      if (deductResult.count === 0) {
        throw new Error('welcome deposit: kaynak bakiye yetersiz (race condition)');
      }

      await tx.wallet.update({
        where: { id: recipientWalletId },
        data: { balance: { increment: config.amount } },
      });

      await tx.transaction.create({
        data: {
          walletId: sourceWallet.id,
          actionType: TransactionActionType.TIP_SEND,
          status: TransactionStatus.CONFIRMED,
          amount: config.amount,
          fromAddress: sourceWallet.publicAddress,
          toAddress: null,
          metadata: { source: 'welcome_deposit', recipientUserId },
          provider: 'backend',
          confirmedAt: now,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: recipientWalletId,
          actionType: TransactionActionType.DEPOSIT,
          status: TransactionStatus.CONFIRMED,
          amount: config.amount,
          fromAddress: sourceWallet.publicAddress,
          toAddress: null,
          metadata: { source: 'welcome_deposit', senderUserId: sourceUser.id },
          provider: 'backend',
          confirmedAt: now,
        },
      });
    });

    invalidateWalletCache(sourceUser.id).catch(() => {});
    invalidateWalletCache(recipientUserId).catch(() => {});

    logger.info(
      {
        sourceUserId: sourceUser.id,
        recipientUserId,
        recipientWalletId,
        amount: config.amount,
      },
      'welcome deposit başarıyla tamamlandı',
    );
  }
}
