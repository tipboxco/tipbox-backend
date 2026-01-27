import { NotificationWorker } from './notification.worker';
import { FeedCleanupWorker } from './feed-cleanup.worker';
import { FeedDistributionWorker } from './feed-distribution.worker';
import { TrustBackfillWorker } from './trust-backfill.worker';
import { SupportRequestAutoCompleteWorker } from './support-request-auto-complete.worker';
import { FeedCleanupScheduler } from '../scheduler/feed-cleanup.scheduler';
import { TrustBackfillScheduler } from '../scheduler/trust-backfill.scheduler';
import { SupportRequestAutoCompleteScheduler } from '../scheduler/support-request-auto-complete.scheduler';
import { getTransactionProcessor } from './transaction-processor';
import logger from '../logger/logger';

class WorkerManager {
  private notificationWorker: NotificationWorker;
  private feedCleanupWorker: FeedCleanupWorker;
  private feedDistributionWorker: FeedDistributionWorker;
  private trustBackfillWorker: TrustBackfillWorker;
  private supportRequestAutoCompleteWorker: SupportRequestAutoCompleteWorker;
  private feedCleanupScheduler: FeedCleanupScheduler;
  private trustBackfillScheduler: TrustBackfillScheduler;
  private supportRequestAutoCompleteScheduler: SupportRequestAutoCompleteScheduler;
  private transactionProcessor: ReturnType<typeof getTransactionProcessor>;

  constructor() {
    this.notificationWorker = new NotificationWorker();
    this.feedCleanupWorker = new FeedCleanupWorker();
    this.feedDistributionWorker = new FeedDistributionWorker();
    this.trustBackfillWorker = new TrustBackfillWorker();
    this.supportRequestAutoCompleteWorker = new SupportRequestAutoCompleteWorker();
    this.feedCleanupScheduler = new FeedCleanupScheduler();
    this.trustBackfillScheduler = new TrustBackfillScheduler();
    this.supportRequestAutoCompleteScheduler = new SupportRequestAutoCompleteScheduler();
    this.transactionProcessor = getTransactionProcessor();
  }

  /**
   * Tüm worker'ları başlatır
   */
  public async startAll(): Promise<void> {
    try {
      logger.info('Starting all workers...');

      // Notification worker'ı başlat
      await this.notificationWorker.start();

      // Feed cleanup worker'ı başlat (zaten constructor'da aktif)
      logger.info('FeedCleanupWorker started');

      // Feed distribution worker'ı başlat
      await this.feedDistributionWorker.start();
      logger.info('FeedDistributionWorker started');

      // Trust backfill worker'ı başlat
      await this.trustBackfillWorker.start();
      logger.info('TrustBackfillWorker started');

      // Support request auto-complete worker'ı başlat
      await this.supportRequestAutoCompleteWorker.start();
      logger.info('SupportRequestAutoCompleteWorker started');

      // Feed cleanup scheduler'ı başlat (günlük job schedule et)
      await this.feedCleanupScheduler.scheduleDaily();
      logger.info('FeedCleanupScheduler started');

      // Support request auto-complete scheduler'ı başlat (her saat başı job schedule et)
      await this.supportRequestAutoCompleteScheduler.scheduleHourly();
      logger.info('SupportRequestAutoCompleteScheduler started');

      // Transaction processor'ı başlat
      this.transactionProcessor.start();
      logger.info('TransactionProcessor started');

      logger.info('All workers started successfully');

      // Graceful shutdown handlers
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start workers:', error);
      process.exit(1);
    }
  }

  /**
   * Tüm worker'ları durdurur
   */
  public async stopAll(): Promise<void> {
    try {
      logger.info('Stopping all workers...');

      await this.notificationWorker.stop();
      await this.feedCleanupWorker.stop();
      await this.feedDistributionWorker.stop();
      await this.trustBackfillWorker.stop();
      await this.supportRequestAutoCompleteWorker.stop();
      await this.feedCleanupScheduler.close();
      await this.trustBackfillScheduler.close();
      await this.supportRequestAutoCompleteScheduler.close();
      this.transactionProcessor.stop();

      logger.info('All workers stopped successfully');
    } catch (error) {
      logger.error('Error stopping workers:', error);
    }
  }

  /**
   * Graceful shutdown işleyicilerini kurar
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stopAll();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // SIGTERM ve SIGINT sinyallerini yakala
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Uncaught exception ve unhandled rejection'ları yakala
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.stopAll().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.stopAll().then(() => process.exit(1));
    });
  }
}

// Worker manager'ı başlat
const workerManager = new WorkerManager();

// Eğer bu dosya doğrudan çalıştırılıyorsa worker'ları başlat
if (require.main === module) {
  workerManager.startAll().catch((error) => {
    logger.error('Failed to start worker manager:', error);
    process.exit(1);
  });
}

export default WorkerManager;

