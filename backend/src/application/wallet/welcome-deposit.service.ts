import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { getWelcomeDepositConfig } from '../../infrastructure/config/welcome-deposit.config';
import { invalidateWalletCache } from '../../infrastructure/cache/cache-invalidation';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { getWalletProvider } from './provider/wallet-provider.factory';
import logger from '../../infrastructure/logger/logger';

const TIPS_DECIMALS = parseInt(process.env.TIPS_TOKEN_DECIMALS || '18', 10);

function extractTxHash(receipt: unknown): string | undefined {
  if (!receipt || typeof receipt !== 'object') return undefined;
  const r = receipt as Record<string, unknown>;
  const inner = (r as { receipt?: { transactionHash?: string } }).receipt;
  const candidates = [r.transactionHash, r.transaction_hash, inner?.transactionHash].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  return candidates[0];
}

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
      logger.warn({ email: config.sourceUserEmail }, 'welcome deposit: kaynak kullanıcı bulunamadı');
      return;
    }

    const recipientWallet = await this.walletRepo.findById(recipientWalletId);
    if (!recipientWallet) {
      logger.warn({ recipientWalletId }, 'welcome deposit: alıcı wallet bulunamadı');
      return;
    }

    const sdk = getWalletProvider();
    const now = new Date();

    // ── ON-CHAIN PATH ────────────────────────────────────────────────────────
    if (sdk.isConfigured() && recipientWallet.smartAccountAddress) {
      const amountWei = BigInt(Math.round(config.amount * 10 ** TIPS_DECIMALS));

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
            recipientSmartAccount: recipientWallet.smartAccountAddress,
          },
          'welcome deposit: on-chain ERC20 transfer başarısız',
        );
        return;
      }

      const txHash = extractTxHash(result.receipt) ?? null;

      await this.prisma.$transaction(async (tx) => {
        // Alıcı DB bakiyesi — anlık UX için (balance sync on-chain'den doğrular)
        await tx.wallet.update({
          where: { id: recipientWalletId },
          data: { balance: { increment: config.amount } },
        });

        await tx.transaction.create({
          data: {
            walletId: recipientWalletId,
            actionType: TransactionActionType.DEPOSIT,
            status: TransactionStatus.CONFIRMED,
            amount: config.amount,
            fromAddress: result.smartAccountAddress ?? null,
            toAddress: recipientWallet.smartAccountAddress,
            txHash,
            metadata: { source: 'welcome_deposit', senderUserId: sourceUser.id },
            provider: 'thirdweb',
            confirmedAt: now,
          },
        });
      });

      invalidateWalletCache(recipientUserId).catch(() => {});
      invalidateWalletCache(sourceUser.id).catch(() => {});

      logger.info(
        {
          sourceUserId: sourceUser.id,
          recipientUserId,
          recipientSmartAccount: recipientWallet.smartAccountAddress,
          amount: config.amount,
          txHash,
        },
        'welcome deposit on-chain başarıyla tamamlandı',
      );
      return;
    }

    // ── DB-ONLY FALLBACK ─────────────────────────────────────────────────────
    // SDK yapılandırılmamış veya alıcının smartAccountAddress'i yok
    logger.warn(
      {
        sdkConfigured: sdk.isConfigured(),
        hasSmartAccount: !!recipientWallet.smartAccountAddress,
        recipientWalletId,
      },
      'welcome deposit: on-chain transfer yapılamıyor, DB-only fallback',
    );

    const sourceWallets = await this.walletRepo.findByUserId(sourceUser.id);
    if (sourceWallets.length === 0) {
      logger.warn({ sourceUserId: sourceUser.id }, 'welcome deposit: kaynak wallet bulunamadı');
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
        'welcome deposit: kaynak wallet yetersiz bakiye (DB-only)',
      );
      return;
    }

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
      { sourceUserId: sourceUser.id, recipientUserId, amount: config.amount },
      'welcome deposit DB-only tamamlandı',
    );
  }
}
