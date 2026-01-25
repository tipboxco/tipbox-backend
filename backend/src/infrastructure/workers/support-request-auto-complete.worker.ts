import { Worker } from 'bullmq';
import logger from '../logger/logger';
import RedisConfigManager from '../config/redis.config';
import { SupportRequestAutoCompleteJobData } from '../scheduler/support-request-auto-complete.scheduler';
import { SupportRequestService } from '../../application/messaging/support-request.service';

export class SupportRequestAutoCompleteWorker {
  private worker: Worker<SupportRequestAutoCompleteJobData>;
  private supportRequestService: SupportRequestService;

  constructor() {
    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.supportRequestService = new SupportRequestService();

    this.worker = new Worker<SupportRequestAutoCompleteJobData>(
      'support-request-auto-complete',
      async (job) => {
        try {
          logger.info({
            message: 'Processing support request auto-complete job',
            jobId: job.id,
            data: job.data,
          });

          // AWAITING_COMPLETION durumundaki request'leri 24 saat sonra otomatik olarak COMPLETED yap
          await this.supportRequestService.autoCompleteAwaitingRequests();

          logger.info({
            message: 'Support request auto-complete job completed',
            jobId: job.id,
          });
        } catch (error) {
          logger.error({
            message: 'Error processing support request auto-complete job',
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error; // Job'ı retry için throw et
        }
      },
      {
        connection: {
          host: redisHost,
          port: redisPort,
        },
        concurrency: 1, // Aynı anda sadece 1 job işle
        limiter: {
          max: 1, // Saniyede maksimum 1 job
          duration: 1000,
        },
      }
    );

    // Worker event'lerini dinle
    this.worker.on('completed', (job) => {
      logger.info({
        message: 'SupportRequestAutoCompleteWorker: Job completed',
        jobId: job.id,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error({
        message: 'SupportRequestAutoCompleteWorker: Job failed',
        jobId: job?.id,
        error: err.message,
        stack: err.stack,
      });
    });

    this.worker.on('error', (err) => {
      logger.error({
        message: 'SupportRequestAutoCompleteWorker: Worker error',
        error: err.message,
        stack: err.stack,
      });
    });

    logger.info({
      message: 'SupportRequestAutoCompleteWorker initialized',
      redisHost,
      redisPort,
    });
  }

  /**
   * Worker'ı başlat
   */
  public async start(): Promise<void> {
    // Worker zaten constructor'da başlatıldı
    logger.info({ message: 'SupportRequestAutoCompleteWorker started' });
  }

  /**
   * Worker'ı durdur
   */
  public async stop(): Promise<void> {
    await this.worker.close();
    logger.info({ message: 'SupportRequestAutoCompleteWorker stopped' });
  }
}
