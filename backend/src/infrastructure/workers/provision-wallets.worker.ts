import { Worker, Job } from 'bullmq';
import { WalletService } from '../../application/wallet/wallet.service';
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
  private readonly walletService = new WalletService();
  private readonly prisma = getPrisma();

  constructor() {
    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.worker = new Worker(
      PROVISION_WALLETS_QUEUE,
      async (job: Job<ProvisionWalletsJobData>) => this.processJob(job),
      {
        connection: { host: redisHost, port: redisPort },
        concurrency: 1, // Tek seferde bir job — duplicate wallet yaratmaz
        lockDuration: 10 * 60 * 1000, // 10 dakika lock (büyük kullanıcı listeleri için)
      },
    );

    this.worker.on('completed', (job, result: { processed: number; created: number; failed: number }) => {
      logger.info({
        message: 'provision-wallets job completed',
        jobId: job.id,
        ...result,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error({
        message: 'provision-wallets job failed',
        jobId: job?.id,
        error: err.message,
      });
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
  ): Promise<{ processed: number; created: number; failed: number }> {
    const usersWithoutWallet = await this.prisma.$queryRaw<UserRow[]>`
      SELECT u.id, u.email
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM wallets w WHERE w.user_id = u.id
      )
      ORDER BY u.created_at ASC
    `;

    logger.info({
      message: 'provision-wallets: walletsız kullanıcılar bulundu',
      count: usersWithoutWallet.length,
    });

    if (usersWithoutWallet.length === 0) {
      return { processed: 0, created: 0, failed: 0 };
    }

    let created = 0;
    let failed = 0;

    for (const user of usersWithoutWallet) {
      try {
        await this.walletService.ensureWalletForUser(user.id);

        // Wallet oluşturuldu mu kontrol et
        const wallets = await this.prisma.wallet.findMany({ where: { userId: user.id } });
        if (wallets.length > 0) {
          created++;
          logger.info({
            message: 'provision-wallets: wallet oluşturuldu',
            userId: user.id,
            email: user.email,
            smartAccountAddress: wallets.find((w) => w.smartAccountAddress)?.smartAccountAddress ?? null,
          });
        } else {
          // SDK yapılandırılmamış ya da Thirdweb session yok — sessizce atla
          logger.warn({
            message: 'provision-wallets: wallet oluşturulamadı (SDK/session yok?)',
            userId: user.id,
            email: user.email,
          });
          failed++;
        }
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

    return { processed: usersWithoutWallet.length, created, failed };
  }

  async stop(): Promise<void> {
    await this.worker.close();
    logger.info({ message: 'ProvisionWalletsWorker stopped' });
  }

  getWorker(): Worker {
    return this.worker;
  }
}
