import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction-prisma.repository';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import logger from '../../infrastructure/logger/logger';

/**
 * Transaction Processor Worker
 * 
 * Web2 Aşaması:
 * - Created/Pending transaction'ları 2-3 saniye sonra Confirmed yapar
 * - Simulated blockchain behavior
 * 
 * Web3 Aşaması (Future):
 * - Blockchain event listener olarak çalışacak
 * - Real transaction confirmation
 */
export class TransactionProcessor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly transactionRepo = new TransactionPrismaRepository(),
    private readonly processIntervalMs = 1000 // Check every 1 second
  ) {}

  /**
   * Processor'ı başlat
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Transaction processor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Transaction processor started');

    this.intervalId = setInterval(() => {
      this.processPendingTransactions().catch(err => {
        logger.error('Error processing transactions:', err);
      });
    }, this.processIntervalMs);
  }

  /**
   * Processor'ı durdur
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Transaction processor stopped');
  }

  /**
   * Pending transaction'ları işle
   * Web2: 2-3 saniye bekleyip confirm et
   * Web3: Blockchain confirmation'ı bekle
   */
  private async processPendingTransactions(): Promise<void> {
    try {
      const pendingTransactions = await this.transactionRepo.findPendingTransactions(50);

      if (pendingTransactions.length === 0) {
        return;
      }

      logger.info(`Processing ${pendingTransactions.length} pending transactions`);

      for (const transaction of pendingTransactions) {
        try {
          // Web2 Logic: Created → Pending → Confirmed (2-3 seconds delay)
          const now = new Date();
          const createdAt = new Date(transaction.createdAt);
          const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000;

          if (transaction.status === TransactionStatus.CREATED) {
            // Created → Pending immediately
            await this.transactionRepo.updateStatus(transaction.id, TransactionStatus.PENDING);
            logger.info(`Transaction ${transaction.id} moved to PENDING`);
          } else if (transaction.status === TransactionStatus.PENDING && elapsedSeconds >= 2) {
            // Pending → Confirmed after 2+ seconds
            await this.transactionRepo.updateStatus(transaction.id, TransactionStatus.CONFIRMED, {
              txHash: this.generateMockTxHash()
            });
            logger.info(`Transaction ${transaction.id} CONFIRMED`);

            // If there's a linked RECEIVE transaction, confirm it too
            if (transaction.metadata?.linkedTransactionId) {
              const linkedTx = await this.transactionRepo.findById(
                transaction.metadata.linkedTransactionId as string
              );
              if (linkedTx && linkedTx.status !== TransactionStatus.CONFIRMED) {
                await this.transactionRepo.updateStatus(
                  linkedTx.id,
                  TransactionStatus.CONFIRMED,
                  { txHash: this.generateMockTxHash() }
                );
                logger.info(`Linked transaction ${linkedTx.id} CONFIRMED`);
              }
            }
          }
        } catch (error) {
          logger.error(`Error processing transaction ${transaction.id}:`, error);
          
          // Mark as failed after 3 retries or critical error
          const retryCount = (transaction.metadata?.retryCount as number) || 0;
          if (retryCount >= 3) {
            await this.transactionRepo.updateStatus(
              transaction.id,
              TransactionStatus.FAILED,
              { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
            );
            logger.error(`Transaction ${transaction.id} FAILED after retries`);
          }
        }
      }
    } catch (error) {
      logger.error('Fatal error in transaction processor:', error);
    }
  }

  /**
   * Mock transaction hash generator
   * Web3'te gerçek blockchain tx hash kullanılacak
   */
  private generateMockTxHash(): string {
    return '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Manuel olarak bir transaction'ı işle (test için)
   */
  async processTransaction(transactionId: string): Promise<void> {
    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status === TransactionStatus.CONFIRMED || 
        transaction.status === TransactionStatus.FAILED) {
      logger.warn(`Transaction ${transactionId} already completed`);
      return;
    }

    // Immediate confirmation (for testing)
    await this.transactionRepo.updateStatus(
      transactionId,
      TransactionStatus.CONFIRMED,
      { txHash: this.generateMockTxHash() }
    );

    logger.info(`Transaction ${transactionId} manually confirmed`);
  }
}

// Global singleton instance
let processorInstance: TransactionProcessor | null = null;

export function getTransactionProcessor(): TransactionProcessor {
  if (!processorInstance) {
    processorInstance = new TransactionProcessor();
  }
  return processorInstance;
}

export function startTransactionProcessor(): void {
  const processor = getTransactionProcessor();
  processor.start();
}

export function stopTransactionProcessor(): void {
  if (processorInstance) {
    processorInstance.stop();
  }
}

