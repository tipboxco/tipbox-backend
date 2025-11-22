import cron from 'node-cron';
import { SupportRequestService } from '../../application/messaging/support-request.service';
import logger from '../logger/logger';

/**
 * Scheduled job for auto-completing support requests
 * Her gün saat 02:00'de çalışır (UTC)
 * AWAITING_COMPLETION durumundaki ve 1 günden eski request'leri otomatik olarak COMPLETED yapar
 */
export class SupportRequestAutoCompleteJob {
  private supportRequestService: SupportRequestService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor() {
    this.supportRequestService = new SupportRequestService();
  }

  /**
   * Scheduled job'u başlat
   * Her gün saat 02:00'de çalışır (UTC)
   */
  public start(): void {
    if (this.cronJob) {
      logger.warn('Support request auto-complete job is already running');
      return;
    }

    // Her gün saat 02:00'de çalış (UTC)
    // Format: dakika saat gün ay haftanın_günü
    // 0 2 * * * = Her gün saat 02:00 (UTC)
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      if (this.isRunning) {
        logger.warn('Previous auto-complete job is still running, skipping...');
        return;
      }

      this.isRunning = true;
      logger.info('Starting support request auto-complete job...');

      try {
        await this.supportRequestService.autoCompleteAwaitingRequests();
        logger.info('Support request auto-complete job completed successfully');
      } catch (error: any) {
        logger.error('Error in support request auto-complete job:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    logger.info('Support request auto-complete job started (runs daily at 02:00 UTC)');
  }

  /**
   * Scheduled job'u durdur
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Support request auto-complete job stopped');
    }
  }

  /**
   * Scheduled job'u manuel olarak çalıştır (test için)
   */
  public async runManually(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Auto-complete job is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Manually running support request auto-complete job...');

    try {
      await this.supportRequestService.autoCompleteAwaitingRequests();
      logger.info('Manual support request auto-complete job completed successfully');
    } catch (error: any) {
      logger.error('Error in manual support request auto-complete job:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

