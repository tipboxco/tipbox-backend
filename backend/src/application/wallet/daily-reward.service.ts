import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { getDailyRewardConfig } from '../../infrastructure/config/daily-reward.config';
import { invalidateWalletCache } from '../../infrastructure/cache/cache-invalidation';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';

const DAILY_REWARD_KEY = (userId: string) => `daily-reward:${userId}`;

export class DailyRewardService {
  constructor(
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly userRepo = new UserPrismaRepository(),
    private readonly cache = new CacheService(),
    private readonly prisma = getPrisma(),
  ) {}

  async grantLoginReward(userId: string): Promise<void> {
    const config = getDailyRewardConfig();
    if (!config.enabled) return;

    const rewardKey = DAILY_REWARD_KEY(userId);

    // Atomic cooldown check — false dönerse 12h dolmamış, atla
    const acquired = await this.cache.setNX(rewardKey, '1', config.intervalSeconds);
    if (!acquired) return;

    try {
      // Kullanıcının gerçek smart wallet'ını bul (sendTip ile aynı çözümleme)
      const recipientWallet = await this.walletRepo.findPreferredForReceivingByUserId(userId);
      if (!recipientWallet) {
        // Wallet yok — sonraki girişte tekrar denesin
        await this.cache.delete(rewardKey);
        return;
      }

      if (!recipientWallet.hasSmartAccount()) {
        // Sadece EOA var, smart account yok — ödül verilmez, sonraki girişte denesin
        await this.cache.delete(rewardKey);
        return;
      }

      // Kaynak kullanıcıyı bul
      const sourceUser = await this.userRepo.findByEmail(config.sourceUserEmail);
      if (!sourceUser) {
        logger.warn({ email: config.sourceUserEmail }, 'daily reward: kaynak kullanıcı bulunamadı');
        await this.cache.delete(rewardKey);
        return;
      }

      const sourceWallets = await this.walletRepo.findByUserId(sourceUser.id);
      if (sourceWallets.length === 0) {
        logger.warn({ sourceUserId: sourceUser.id }, 'daily reward: kaynak wallet bulunamadı');
        await this.cache.delete(rewardKey);
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
          'daily reward: kaynak wallet yetersiz bakiye',
        );
        await this.cache.delete(rewardKey);
        return;
      }

      const now = new Date();

      await this.prisma.$transaction(async (tx) => {
        const deductResult = await tx.wallet.updateMany({
          where: { id: sourceWallet.id, balance: { gte: config.amount } },
          data: { balance: { increment: -config.amount } },
        });

        if (deductResult.count === 0) {
          throw new Error('daily reward: kaynak bakiye yetersiz (race condition)');
        }

        await tx.wallet.update({
          where: { id: recipientWallet.id },
          data: { balance: { increment: config.amount } },
        });

        await tx.transaction.create({
          data: {
            walletId: sourceWallet.id,
            actionType: TransactionActionType.TIP_SEND,
            status: TransactionStatus.CONFIRMED,
            amount: config.amount,
            fromAddress: sourceWallet.publicAddress,
            toAddress: recipientWallet.smartAccountAddress ?? recipientWallet.publicAddress,
            metadata: {
              source: 'daily_reward',
              recipientUserId: userId,
              intervalHours: config.intervalSeconds / 3600,
            },
            provider: 'backend',
            confirmedAt: now,
          },
        });

        await tx.transaction.create({
          data: {
            walletId: recipientWallet.id,
            actionType: TransactionActionType.DEPOSIT,
            status: TransactionStatus.CONFIRMED,
            amount: config.amount,
            fromAddress: sourceWallet.publicAddress,
            toAddress: recipientWallet.smartAccountAddress ?? recipientWallet.publicAddress,
            metadata: {
              source: 'daily_reward',
              senderUserId: sourceUser.id,
            },
            provider: 'backend',
            confirmedAt: now,
          },
        });
      });

      invalidateWalletCache(sourceUser.id).catch(() => {});
      invalidateWalletCache(userId).catch(() => {});

      logger.info(
        {
          sourceUserId: sourceUser.id,
          recipientUserId: userId,
          recipientWalletId: recipientWallet.id,
          amount: config.amount,
          intervalHours: config.intervalSeconds / 3600,
        },
        'daily login reward başarıyla tamamlandı',
      );
    } catch (err) {
      // Transfer başarısız — cooldown key'i sil, sonraki girişte tekrar denesin
      await this.cache.delete(rewardKey).catch(() => {});
      throw err;
    }
  }
}
