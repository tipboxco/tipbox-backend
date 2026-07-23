import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { WalletProvider } from '../../domain/wallet/wallet.entity';
import { getDailyRewardConfig } from '../../infrastructure/config/daily-reward.config';
import { invalidateWalletCache } from '../../infrastructure/cache/cache-invalidation';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { getWalletProvider } from './provider/wallet-provider.factory';
import logger from '../../infrastructure/logger/logger';

const TIPS_DECIMALS = parseInt(process.env.TIPS_TOKEN_DECIMALS || '18', 10);
const DAILY_REWARD_KEY = (userId: string) => `daily-reward:${userId}`;

function extractTxHash(receipt: unknown): string | undefined {
  if (!receipt || typeof receipt !== 'object') return undefined;
  const r = receipt as Record<string, unknown>;
  const inner = (r as { receipt?: { transactionHash?: string } }).receipt;
  const candidates = [r.transactionHash, r.transaction_hash, inner?.transactionHash].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  return candidates[0];
}

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
      const recipientWallet = await this.walletRepo.findPreferredForReceivingByUserId(userId);
      if (!recipientWallet) {
        // Wallet yok — sonraki girişte tekrar denesin
        await this.cache.delete(rewardKey);
        return;
      }

      // Mock/CUSTOM cüzdanlar hariç
      if (recipientWallet.provider === WalletProvider.CUSTOM) {
        await this.cache.delete(rewardKey);
        return;
      }

      const sourceUser = await this.userRepo.findByEmail(config.sourceUserEmail);
      if (!sourceUser) {
        logger.warn({ email: config.sourceUserEmail }, 'daily reward: kaynak kullanıcı bulunamadı');
        await this.cache.delete(rewardKey);
        return;
      }

      const sdk = getWalletProvider();
      const now = new Date();
      const amountWei = BigInt(Math.round(config.amount * 10 ** TIPS_DECIMALS));

      // ── ON-CHAIN PATH ──────────────────────────────────────────────────────
      if (sdk.isConfigured() && recipientWallet.smartAccountAddress) {
        const result = await sdk.transferToAddress(
          sourceUser.id,
          amountWei,
          recipientWallet.smartAccountAddress,
        );

        if (!result.success) {
          logger.error(
            {
              error: result.error,
              contractError: result.contractError,
              sourceUserId: sourceUser.id,
              recipientUserId: userId,
              recipientSmartAccount: recipientWallet.smartAccountAddress,
            },
            'daily reward: on-chain ERC20 transfer başarısız',
          );
          await this.cache.delete(rewardKey);
          return;
        }

        const txHash = extractTxHash(result.receipt) ?? null;

        await this.prisma.$transaction(async (tx) => {
          await tx.wallet.update({
            where: { id: recipientWallet.id },
            data: { balance: { increment: config.amount } },
          });

          await tx.transaction.create({
            data: {
              walletId: recipientWallet.id,
              actionType: TransactionActionType.DEPOSIT,
              status: TransactionStatus.CONFIRMED,
              amount: config.amount,
              fromAddress: result.smartAccountAddress ?? null,
              toAddress: recipientWallet.smartAccountAddress,
              txHash,
              metadata: {
                source: 'daily_reward',
                senderUserId: sourceUser.id,
                intervalHours: config.intervalSeconds / 3600,
              },
              provider: 'thirdweb',
              confirmedAt: now,
            },
          });
        });

        invalidateWalletCache(userId).catch(() => {});
        invalidateWalletCache(sourceUser.id).catch(() => {});

        logger.info(
          {
            sourceUserId: sourceUser.id,
            recipientUserId: userId,
            recipientSmartAccount: recipientWallet.smartAccountAddress,
            amount: config.amount,
            txHash,
            intervalHours: config.intervalSeconds / 3600,
          },
          'daily reward on-chain başarıyla tamamlandı',
        );
        return;
      }

      // smartAccountAddress yok → sonraki girişe ertele (smart account oluşunca çalışır)
      if (sdk.isConfigured() && !recipientWallet.smartAccountAddress) {
        logger.warn(
          { recipientUserId: userId, walletId: recipientWallet.id },
          'daily reward: smartAccountAddress yok, sonraki girişe ertelendi',
        );
        await this.cache.delete(rewardKey);
        return;
      }

      // ── DB-ONLY FALLBACK (SDK yapılandırılmamış) ───────────────────────────
      logger.warn({ recipientUserId: userId }, 'daily reward: SDK yapılandırılmamış, DB-only fallback');

      const sourceWallets = await this.walletRepo.findByUserId(sourceUser.id);
      if (sourceWallets.length === 0) {
        logger.warn({ sourceUserId: sourceUser.id }, 'daily reward: kaynak wallet bulunamadı');
        await this.cache.delete(rewardKey);
        return;
      }
      const sourceWallet = sourceWallets.find((w) => w.isConnected) ?? sourceWallets[0];

      if (sourceWallet.getAvailableBalance() < config.amount) {
        logger.error(
          {
            sourceWalletId: sourceWallet.id,
            available: sourceWallet.getAvailableBalance(),
            required: config.amount,
          },
          'daily reward: kaynak wallet yetersiz bakiye (DB-only)',
        );
        await this.cache.delete(rewardKey);
        return;
      }

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
            metadata: { source: 'daily_reward', senderUserId: sourceUser.id },
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
          amount: config.amount,
          intervalHours: config.intervalSeconds / 3600,
        },
        'daily reward DB-only tamamlandı',
      );
    } catch (err) {
      await this.cache.delete(rewardKey).catch(() => {});
      throw err;
    }
  }
}
