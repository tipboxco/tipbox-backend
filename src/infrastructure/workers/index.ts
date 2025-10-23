import { NotificationWorker } from './notification.worker';
import logger from '../logger/logger';

class WorkerManager {
  private notificationWorker: NotificationWorker;

  constructor() {
    this.notificationWorker = new NotificationWorker();
  }

  /**
   * Tüm worker'ları başlatır
   */
  public async startAll(): Promise<void> {
    try {
      logger.info('Starting all workers...');

      // Notification worker'ı başlat
      await this.notificationWorker.start();

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

