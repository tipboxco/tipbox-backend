import { Worker, Job } from 'bullmq';
import { WalletPrismaRepository } from '../repositories/wallet-prisma.repository';
import { WelcomeDepositService } from '../../application/wallet/welcome-deposit.service';
import { getWalletProvider, getActiveWalletProviderEnum } from '../../application/wallet/provider/wallet-provider.factory';
import { getPrisma } from '../repositories/prisma.client';
import logger from '../logger/logger';
import RedisConfigManager from '../config/redis.config';
import QueueProvider from '../queue/queue.provider';

export const PROVISION_WALLETS_QUEUE = 'provision-wallets';

export interface ProvisionWalletsJobData {
  type: 'provision-all';
}

interface UserRow {
  id: string;
  email: string | null;
}

export class ProvisionWalletsWorker {
  private worker: Worker;
  private readonly walletRepo = new WalletPrismaRepository();
  private readonly prisma = getPrisma();

  constructor() {
    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.worker = new Worker(
      PROVISION_WALLETS_QUEUE,
      async (job: Job<ProvisionWalletsJobData>) => this.processJob(job),
      {
        connection: { host: redisHost, port: redisPort },
        concurrency: 1,
        lockDuration: 15 * 60 * 1000, // 15 dakika lock
      },
    );

    this.worker.on('completed', (job, result: { processed: number; created: number; skipped: number; failed: number }) => {
      logger.info({ message: 'provision-wallets job completed', jobId: job.id, ...result });
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ message: 'provision-wallets job failed', jobId: job?.id, error: err.message });
      if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
        QueueProvider.getInstance()
          .addToDLQ(PROVISION_WALLETS_QUEUE, job.data, err.message, job.id)
          .catch(() => {});
      }
    });

    logger.info({ message: 'ProvisionWalletsWorker initialized', redisHost, redisPort });
  }

  private async processJob(
    _job: Job<ProvisionWalletsJobData>,
  ): Promise<{ processed: number; created: number; skipped: number; failed: number }> {
    const provider = getWalletProvider();
    if (!provider.isConfigured()) {
      logger.warn({ message: 'provision-wallets: provider yapılandırılmamış, atlandı' });
      return { processed: 0, created: 0, skipped: 0, failed: 0 };
    }

    // smartAccountAddress'i olmayan tüm kullanıcılar (hiç wallet yok VEYA mock wallet var)
    const users = await this.prisma.$queryRaw<UserRow[]>`
      SELECT u.id, u.email
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM wallets w
        WHERE w.user_id = u.id
          AND w.smart_account_address IS NOT NULL
      )
      ORDER BY u.created_at ASC
    `;

    logger.info({
      message: 'provision-wallets: smart account adresi olmayan kullanıcılar',
      count: users.length,
    });

    if (users.length === 0) {
      return { processed: 0, created: 0, skipped: 0, failed: 0 };
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Thirdweb'den gerçek adresleri al
        const auth = await provider.authenticateAndGetAddresses(user.id);

        if (!auth.success || !auth.eoaAddress || !auth.smartAccountAddress) {
          logger.warn({
            message: 'provision-wallets: Thirdweb adres alınamadı',
            userId: user.id,
            email: user.email,
            authSuccess: auth.success,
          });
          skipped++;
          continue;
        }

        // Bu smartAccountAddress zaten kayıtlı mı?
        const existingWithSmart = await this.walletRepo.findBySmartAccountAddress(
          auth.smartAccountAddress,
        );
        if (existingWithSmart) {
          logger.info({
            message: 'provision-wallets: smart account zaten kayıtlı, atlandı',
            userId: user.id,
            smartAccountAddress: auth.smartAccountAddress,
          });
          skipped++;
          continue;
        }

        // Var olan kayıtlara dokunmadan yeni gerçek wallet oluştur
        const newWallet = await this.walletRepo.create(
          user.id,
          auth.eoaAddress,
          getActiveWalletProviderEnum(),
          true,
          auth.smartAccountAddress,
        );

        logger.info({
          message: 'provision-wallets: wallet oluşturuldu',
          userId: user.id,
          email: user.email,
          eoaAddress: auth.eoaAddress,
          smartAccountAddress: auth.smartAccountAddress,
          walletId: newWallet.id,
        });

        // Welcome deposit daha önce alınmış mı kontrol et (tüm wallet'lar üzerinde)
        const allWallets = await this.prisma.wallet.findMany({ where: { userId: user.id } });
        const allWalletIds = allWallets.map((w) => w.id);

        const hasDeposit = await this.prisma.transaction.findFirst({
          where: {
            walletId: { in: allWalletIds },
            metadata: { path: ['source'], equals: 'welcome_deposit' },
          },
        });

        if (!hasDeposit) {
          try {
            await new WelcomeDepositService().grant(user.id, newWallet.id);
            logger.info({
              message: 'provision-wallets: welcome deposit gönderildi',
              userId: user.id,
              walletId: newWallet.id,
            });
          } catch (depositErr) {
            logger.error({
              message: 'provision-wallets: welcome deposit başarısız',
              userId: user.id,
              error: depositErr instanceof Error ? depositErr.message : String(depositErr),
            });
          }
        } else {
          logger.info({
            message: 'provision-wallets: welcome deposit daha önce alınmış, atlandı',
            userId: user.id,
          });
        }

        created++;
      } catch (err) {
        failed++;
        logger.error({
          message: 'provision-wallets: kullanıcı için hata',
          userId: user.id,
          email: user.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Thirdweb rate limit'e karşı kısa bekleme
      await new Promise((r) => setTimeout(r, 300));
    }

    logger.info({
      message: 'provision-wallets tamamlandı',
      processed: users.length,
      created,
      skipped,
      failed,
    });

    return { processed: users.length, created, skipped, failed };
  }

  async stop(): Promise<void> {
    await this.worker.close();
    logger.info({ message: 'ProvisionWalletsWorker stopped' });
  }

  getWorker(): Worker {
    return this.worker;
  }
}
