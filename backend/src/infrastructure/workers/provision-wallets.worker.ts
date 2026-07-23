import { Worker, Job } from 'bullmq';
import { WalletPrismaRepository } from '../repositories/wallet-prisma.repository';
import { WelcomeDepositService } from '../../application/wallet/welcome-deposit.service';
import {
  getWalletProvider,
  getActiveWalletProviderEnum,
} from '../../application/wallet/provider/wallet-provider.factory';
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

// ─── Retry helpers ────────────────────────────────────────────────────────────

const RATE_LIMIT_PATTERNS = ['429', 'too many requests', 'rate limit', 'rate_limit', 'throttl'];

function isRateLimitError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return RATE_LIMIT_PATTERNS.some((p) => msg.includes(p));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Thirdweb çağrılarını exponential backoff ile retry eder.
 * Rate limit → daha uzun bekleme. Diğer hatalar → 3 deneme sonra fırlatır.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRL = isRateLimitError(err);
      const delay = isRL
        ? Math.min(30_000, 5_000 * attempt)   // rate limit: 5s / 10s / 30s
        : Math.min(8_000, 1_000 * attempt);    // diğer: 1s / 2s / 8s

      if (attempt < maxAttempts) {
        logger.warn({
          message: `${label}: deneme ${attempt}/${maxAttempts} başarısız, ${delay}ms bekliyor`,
          isRateLimit: isRL,
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(delay);
      }
    }
  }

  throw lastErr;
}

// ─── Worker ──────────────────────────────────────────────────────────────────

const LOCK_EXTEND_EVERY = 10;       // her 10 kullanıcıda lock'u yenile
const LOCK_DURATION_MS = 20 * 60 * 1000; // 20 dakika
const BASE_DELAY_MS = 500;          // kullanıcılar arası normal bekleme

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
        lockDuration: LOCK_DURATION_MS,
        // Stalled job'ı otomatik retry et (lock süresi dolunca)
        stalledInterval: 30_000,
      },
    );

    this.worker.on(
      'completed',
      (job, result: { processed: number; created: number; skipped: number; failed: number }) => {
        logger.info({ message: 'provision-wallets job completed', jobId: job.id, ...result });
      },
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ message: 'provision-wallets job failed', jobId: job?.id, error: err.message });
      if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
        QueueProvider.getInstance()
          .addToDLQ(PROVISION_WALLETS_QUEUE, job.data, err.message, job.id)
          .catch(() => {});
      }
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn({ message: 'provision-wallets job stalled, yeniden deneniyor', jobId });
    });

    logger.info({ message: 'ProvisionWalletsWorker initialized', redisHost, redisPort });
  }

  private async processJob(
    job: Job<ProvisionWalletsJobData>,
  ): Promise<{ processed: number; created: number; skipped: number; failed: number }> {
    const provider = getWalletProvider();
    if (!provider.isConfigured()) {
      logger.warn({ message: 'provision-wallets: provider yapılandırılmamış, atlandı' });
      return { processed: 0, created: 0, skipped: 0, failed: 0 };
    }

    // CUSTOM olmayan gerçek Thirdweb wallet'ı hiç olmayan kullanıcılar
    const users = await this.prisma.$queryRaw<UserRow[]>`
      SELECT u.id, u.email
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM wallets w
        WHERE w.user_id = u.id
          AND w.provider != 'CUSTOM'
      )
      ORDER BY u.created_at ASC
    `;

    logger.info({
      message: 'provision-wallets: işlenecek kullanıcı sayısı',
      count: users.length,
    });

    if (users.length === 0) {
      return { processed: 0, created: 0, skipped: 0, failed: 0 };
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    let consecutiveRateLimits = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      // BullMQ lock'unu periyodik olarak yenile — job stalled sayılmasın
      if (i > 0 && i % LOCK_EXTEND_EVERY === 0) {
        try {
          await job.extendLock('provision-wallets-token', LOCK_DURATION_MS);
          await job.updateProgress(Math.round((i / users.length) * 100));
          logger.info({
            message: 'provision-wallets: ilerleme',
            progress: `${i}/${users.length}`,
            created,
            skipped,
            failed,
          });
        } catch {
          // lock extend başarısız olursa devam et — job zaten çalışıyor
        }
      }

      try {
        // Thirdweb'den adres al (retry destekli)
        const auth = await withRetry(
          () => provider.authenticateAndGetAddresses(user.id),
          `authenticateAndGetAddresses(${user.email ?? user.id})`,
        );

        consecutiveRateLimits = 0; // başarılı → sayacı sıfırla

        if (!auth.success || !auth.eoaAddress || !auth.smartAccountAddress) {
          logger.warn({
            message: 'provision-wallets: Thirdweb adres alınamadı',
            userId: user.id,
            email: user.email,
          });
          skipped++;
          continue;
        }

        // Bu smartAccountAddress zaten kayıtlı mı?
        const existingWithSmart = await this.walletRepo.findBySmartAccountAddress(
          auth.smartAccountAddress,
        );
        if (existingWithSmart) {
          skipped++;
          continue;
        }

        // Yeni gerçek wallet oluştur (var olan CUSTOM kayıtlara dokunmaz)
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
          smartAccountAddress: auth.smartAccountAddress,
          walletId: newWallet.id,
        });

        // Welcome deposit kontrolü ve gönderimi
        await this.maybeGrantWelcomeDeposit(user.id, newWallet.id);

        created++;
      } catch (err) {
        if (isRateLimitError(err)) {
          consecutiveRateLimits++;
          const pauseMs = Math.min(60_000, 10_000 * consecutiveRateLimits);
          logger.warn({
            message: `provision-wallets: rate limit, ${pauseMs}ms bekleniyor`,
            userId: user.id,
            consecutiveRateLimits,
          });
          await sleep(pauseMs);
          // Bu kullanıcıyı failed değil — bir sonraki cron run'da tekrar denenecek
          skipped++;
        } else {
          consecutiveRateLimits = 0;
          failed++;
          logger.error({
            message: 'provision-wallets: kullanıcı için hata',
            userId: user.id,
            email: user.email,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        continue;
      }

      await sleep(BASE_DELAY_MS);
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

  private async maybeGrantWelcomeDeposit(userId: string, walletId: string): Promise<void> {
    try {
      const allWallets = await this.prisma.wallet.findMany({ where: { userId } });
      const allWalletIds = allWallets.map((w) => w.id);

      const hasDeposit = await this.prisma.transaction.findFirst({
        where: {
          walletId: { in: allWalletIds },
          metadata: { path: ['source'], equals: 'welcome_deposit' },
        },
      });

      if (hasDeposit) {
        logger.info({ message: 'provision-wallets: welcome deposit zaten var', userId });
        return;
      }

      await withRetry(
        () => new WelcomeDepositService().grant(userId, walletId),
        `welcomeDeposit(${userId})`,
      );

      logger.info({ message: 'provision-wallets: welcome deposit gönderildi', userId, walletId });
    } catch (err) {
      // Welcome deposit başarısız olsa bile wallet oluşturuldu — sadece log at
      logger.error({
        message: 'provision-wallets: welcome deposit başarısız (wallet oluşturuldu)',
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async stop(): Promise<void> {
    await this.worker.close();
    logger.info({ message: 'ProvisionWalletsWorker stopped' });
  }

  getWorker(): Worker {
    return this.worker;
  }
}
