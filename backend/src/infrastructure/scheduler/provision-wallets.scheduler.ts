import { Queue } from 'bullmq';
import logger from '../logger/logger';
import RedisConfigManager from '../config/redis.config';
import { PROVISION_WALLETS_QUEUE, ProvisionWalletsJobData } from '../workers/provision-wallets.worker';

// Cron saat/dakikasını env ile override edebilirsin:
//   PROVISION_WALLETS_CRON="0 4 * * *"   (default: her gün 04:00)
const DEFAULT_CRON = '0 4 * * *';

export class ProvisionWalletsScheduler {
  private queue: Queue<ProvisionWalletsJobData>;

  constructor() {
    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.queue = new Queue(PROVISION_WALLETS_QUEUE, {
      connection: { host: redisHost, port: redisPort },
    });

    logger.info({ message: 'ProvisionWalletsScheduler initialized', redisHost, redisPort });
  }

  async scheduleDaily(): Promise<void> {
    try {
      // Mevcut tekrarlayan job'ları temizle (duplicate önlemek için)
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === 'provision-wallets-daily') {
          await this.queue.removeRepeatableByKey(job.key);
        }
      }

      const cronPattern = process.env.PROVISION_WALLETS_CRON ?? DEFAULT_CRON;

      await this.queue.add(
        'provision-wallets-daily',
        { type: 'provision-all' },
        {
          repeat: { pattern: cronPattern },
          jobId: 'provision-wallets-daily',
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 2,
        },
      );

      logger.info({
        message: 'Daily provision-wallets job scheduled',
        cronPattern,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to schedule provision-wallets job',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Hemen bir kez çalıştırır. Tarih bazlı jobId ile aynı gün tekrar tetiklenmez
   * (server aynı gün birden fazla restart atsa bile tek çalışır).
   */
  async triggerNow(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10); // "2026-06-27"
    const jobId = `provision-wallets-startup-${today}`;

    // Aynı gün zaten queue'da ya da işlenmiş mi?
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      logger.info({ message: 'provision-wallets startup job bugün zaten çalıştı, atlandı', jobId });
      return;
    }

    await this.queue.add(
      'provision-wallets-startup',
      { type: 'provision-all' },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
      },
    );

    logger.info({ message: 'provision-wallets startup job eklendi', jobId });
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info({ message: 'ProvisionWalletsScheduler closed' });
  }

  getQueue(): Queue<ProvisionWalletsJobData> {
    return this.queue;
  }
}
