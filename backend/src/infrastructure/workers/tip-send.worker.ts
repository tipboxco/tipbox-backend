/**
 * Tip Send Worker
 *
 * Redis tip-send kuyruğundaki işleri işler. Contract (Thirdweb SDK) tip gönderimi
 * burada yapılır; kullanıcı API'den hemen dönüş alır, güncellemeyi transaction history ile takip eder.
 */

import { Worker, Job } from 'bullmq';
import RedisConfigManager from '../config/redis.config';
import { TipSendJobData } from '../queue/queue.provider';
import { TransactionPrismaRepository } from '../repositories/transaction-prisma.repository';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { getThirdwebSdkService } from '../../application/wallet/thirdweb-sdk/thirdweb-sdk.service';
import { WalletService } from '../../application/wallet/wallet.service';
import { TransactionService } from '../../application/transaction/transaction.service';
import logger from '../logger/logger';

const TIPS_DECIMALS = parseInt(process.env.TIPS_TOKEN_DECIMALS || '18', 10);

export class TipSendWorker {
  private worker!: Worker;
  private redisConfig: RedisConfigManager;
  private transactionRepo: TransactionPrismaRepository;
  private walletService: WalletService;
  private transactionService: TransactionService;

  constructor() {
    this.redisConfig = RedisConfigManager.getInstance();
    this.transactionRepo = new TransactionPrismaRepository();
    this.walletService = new WalletService();
    this.transactionService = new TransactionService();
  }

  public async start(): Promise<void> {
    try {
      await this.redisConfig.initialize();
      const redisConfig = this.redisConfig.getConfig();
      const redisHost = RedisConfigManager.parseRedisHost(redisConfig.url);
      const redisPort = RedisConfigManager.parseRedisPort(redisConfig.url);

      this.worker = new Worker<TipSendJobData>(
        'tip-send',
        this.processTipSendJob.bind(this),
        {
          connection: { host: redisHost, port: redisPort },
          concurrency: 2,
        }
      );

      this.worker.on('ready', () => logger.info('TipSend worker is ready'));
      this.worker.on('active', (job) =>
        logger.debug('Processing tip-send job', { jobId: job.id, sendTransactionId: job.data.sendTransactionId })
      );
      this.worker.on('completed', (job) =>
        logger.info('Tip-send job completed', { jobId: job.id })
      );
      this.worker.on('failed', (job, err) =>
        logger.error('Tip-send job failed', { jobId: job?.id, error: err?.message })
      );
      this.worker.on('error', (err) => logger.error('TipSend worker error', err));

      logger.info('TipSend worker started', { redisHost, redisPort });
    } catch (error) {
      logger.error('Failed to start TipSend worker', error);
      throw error;
    }
  }

  private async processTipSendJob(job: Job<TipSendJobData>): Promise<void> {
    const {
      sendTransactionId,
      receiveTransactionId,
      useErc20Transfer,
      fromUserId,
      toAddress,
      amount,
    } = job.data;
    const hasReceiveTx = !!receiveTransactionId;
    const useErc20 = !!useErc20Transfer;

    const sendTx = await this.transactionRepo.findById(sendTransactionId);
    if (!sendTx) {
      throw new Error(`Send transaction not found: ${sendTransactionId}`);
    }
    if (sendTx.status !== TransactionStatus.CREATED) {
      logger.info('Tip-send job skipped: transaction already processed', {
        sendTransactionId,
        status: sendTx.status,
      });
      return;
    }

    const sdk = getThirdwebSdkService();
    if (!sdk.isConfigured()) {
      await this.failSendOrBoth(sendTransactionId, receiveTransactionId ?? undefined, 'Thirdweb SDK is not configured.');
      return;
    }

    const amountWei = BigInt(Math.round(amount * 10 ** TIPS_DECIMALS));

    let sdkResult: Awaited<ReturnType<typeof sdk.sendTip>> | Awaited<ReturnType<typeof sdk.transferToAddress>>;
    try {
      if (useErc20) {
        sdkResult = await sdk.transferToAddress(fromUserId, amountWei, toAddress);
      } else {
        sdkResult = await sdk.sendTip(fromUserId, amountWei, toAddress);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({
        sendTransactionId,
        error: msg,
        useErc20Transfer: useErc20,
        message: useErc20 ? 'ERC20 transfer failed' : 'Thirdweb sendTip failed',
      });
      await this.failSendOrBoth(sendTransactionId, receiveTransactionId ?? undefined, msg);
      throw err;
    }

    if (!sdkResult.success) {
      const errMsg = sdkResult.error ?? (useErc20 ? 'ERC20 transfer failed on-chain' : 'Tip send failed on-chain');
      await this.failSendOrBoth(sendTransactionId, receiveTransactionId ?? undefined, errMsg);
      throw new Error(errMsg);
    }

    const rawHash = this.extractTxHashFromReceipt(sdkResult.receipt);
    const txHash = rawHash
      ? (rawHash.trim().toLowerCase().startsWith('0x') ? rawHash.trim().toLowerCase() : '0x' + rawHash.trim().toLowerCase())
      : undefined;

    if (!txHash && sdkResult.receipt && typeof sdkResult.receipt === 'object') {
      logger.warn({
        sendTransactionId,
        receiptKeys: Object.keys(sdkResult.receipt as object),
        message: 'Tip send receipt has no known txHash key; check receipt shape',
      });
    }

    if (txHash) {
      const updates: Promise<unknown>[] = [
        this.transactionRepo.updateStatus(sendTransactionId, TransactionStatus.PENDING, { txHash }),
      ];
      if (hasReceiveTx) {
        updates.push(this.transactionRepo.updateStatus(receiveTransactionId!, TransactionStatus.PENDING, { txHash }));
      }
      await Promise.all(updates);
    }

    // Tip send SDK ile RPC'ye gidiyor (Engine değil); "mined" webhook gelmez. Receipt aldığımız anda CONFIRMED yapıyoruz.
    if (txHash) {
      try {
        await this.transactionService.confirmTransaction(sendTransactionId, txHash);
        if (hasReceiveTx) {
          await this.transactionService.confirmTransaction(receiveTransactionId!, txHash);
        }
        logger.info({
          sendTransactionId,
          receiveTransactionId: hasReceiveTx ? receiveTransactionId : undefined,
          txHash,
          externalRecipient: !hasReceiveTx,
          message: 'Tip send confirmed in worker (receipt received)',
        });
      } catch (err) {
        logger.error({
          sendTransactionId,
          receiveTransactionId: hasReceiveTx ? receiveTransactionId : undefined,
          txHash,
          error: err instanceof Error ? err.message : String(err),
          message: 'Tip send confirmTransaction failed; forcing status to CONFIRMED so tx does not stay PENDING',
        });
        try {
          await this.transactionRepo.updateStatus(sendTransactionId, TransactionStatus.CONFIRMED, { txHash });
          if (hasReceiveTx) {
            await this.transactionRepo.updateStatus(receiveTransactionId!, TransactionStatus.CONFIRMED, { txHash });
          }
          logger.info({
            sendTransactionId,
            receiveTransactionId: hasReceiveTx ? receiveTransactionId : undefined,
            message: 'Tip send status forced to CONFIRMED after confirmTransaction error',
          });
        } catch (forceErr) {
          logger.error({
            sendTransactionId,
            receiveTransactionId: hasReceiveTx ? receiveTransactionId : undefined,
            error: forceErr instanceof Error ? forceErr.message : String(forceErr),
            message: 'Failed to force CONFIRMED status',
          });
        }
      }
    } else {
      logger.warn({
        sendTransactionId,
        receiveTransactionId: hasReceiveTx ? receiveTransactionId : undefined,
        message: 'Tip send succeeded but no txHash in receipt; status left PENDING',
      });
    }

    // Balance sync
    const sendTxUpdated = await this.transactionRepo.findById(sendTransactionId);
    if (sendTxUpdated?.walletId) {
      this.walletService.syncWalletBalanceFromChain(sendTxUpdated.walletId).catch((e) =>
        logger.warn({ error: String(e), message: 'syncWalletBalanceFromChain after tip-send failed' })
      );
    }
  }

  /**
   * Thirdweb/viem receipt farklı yapıda dönebilir; txHash'i mümkün olan tüm alanlardan dener.
   */
  private extractTxHashFromReceipt(receipt: unknown): string | undefined {
    if (!receipt || typeof receipt !== 'object') return undefined;
    const r = receipt as Record<string, unknown>;
    const candidates = [
      r.transactionHash,
      r.transaction_hash,
      (r as { receipt?: { transactionHash?: string } }).receipt?.transactionHash,
    ].filter((v): v is string => typeof v === 'string' && v.length > 0);
    return candidates[0];
  }

  /** Send + opsiyonel receive transaction'ı FAILED yapar (doğrudan adrese tip'te receive yok). */
  private async failSendOrBoth(
    sendTransactionId: string,
    receiveTransactionId: string | undefined,
    errorMessage: string
  ): Promise<void> {
    const updates: Promise<unknown>[] = [
      this.transactionRepo.updateStatus(sendTransactionId, TransactionStatus.FAILED, { errorMessage }),
    ];
    if (receiveTransactionId) {
      updates.push(this.transactionRepo.updateStatus(receiveTransactionId, TransactionStatus.FAILED, { errorMessage }));
    }
    await Promise.all(updates);
  }

  public async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      logger.info('TipSend worker stopped');
    }
  }
}

export default TipSendWorker;
