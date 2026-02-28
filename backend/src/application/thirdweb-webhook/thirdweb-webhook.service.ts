/**
 * ThirdwebWebhookService
 * 
 * Thirdweb Engine'den gelen webhook eventlerini işler ve
 * Transaction/Wallet durumlarını günceller.
 * 
 * @see https://portal.thirdweb.com/engine/v2/features/webhooks
 */

import crypto from 'crypto';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { ThirdwebWebhookLogPrismaRepository } from '../../infrastructure/repositories/thirdweb-webhook-log-prisma.repository';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction-prisma.repository';
import { TransactionService } from '../transaction/transaction.service';
import { WalletService } from '../wallet/wallet.service';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionActionType as PrismaTransactionActionType } from '@prisma/client';
// Local enum definitions matching Prisma schema (Prisma client may not have regenerated yet)
enum ThirdwebWebhookStatus {
  sent = 'sent',
  mined = 'mined',
  errored = 'errored',
  cancelled = 'cancelled',
}

enum ThirdwebOnchainStatus {
  success = 'success',
  reverted = 'reverted',
}
import {
  ThirdwebWebhookPayload,
  WebhookProcessResult,
  WEBHOOK_STATUS_PRIORITY
} from '../../interfaces/thirdweb-webhook/thirdweb-webhook.dto';
import logger from '../../infrastructure/logger/logger';

// ============================================================================
// SERVICE
// ============================================================================

export class ThirdwebWebhookService {
  private webhookSecret: string;
  private expirationSeconds: number;

  constructor(
    private readonly webhookLogRepo = new ThirdwebWebhookLogPrismaRepository(),
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly transactionRepo = new TransactionPrismaRepository(),
    private readonly transactionService = new TransactionService(),
    private readonly walletService = new WalletService()
  ) {
    this.webhookSecret = process.env.THIRDWEB_WEBHOOK_SECRET || '';
    this.expirationSeconds = parseInt(process.env.THIRDWEB_WEBHOOK_EXPIRATION_SECONDS || '300', 10);

    if (!this.webhookSecret) {
      logger.warn('THIRDWEB_WEBHOOK_SECRET is not set. Webhook signature verification will fail.');
    }
  }

  // ==========================================================================
  // SIGNATURE VERIFICATION (Thirdweb örneğine uygun)
  // ==========================================================================

  /**
   * HMAC-SHA256 ile signature oluşturur
   * Thirdweb formatı: `${timestamp}.${body}`
   */
  generateSignature(
    body: string,
    timestamp: string,
    secret: string,
  ): string {
    const payload = `${timestamp}.${body}`;
    return crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  };
  /**
   * Webhook signature'ını doğrular
   * Thirdweb örneğine birebir uygun
   */
  isValidSignature(body: string, timestamp: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(body, timestamp, secret);
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature),
    );
  };
  /**
   * Backward compatibility - eski fonksiyon adı
   */
  verifySignature(body: string, timestamp: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.error('Webhook secret is not configured');
      return false;
    }
    return this.isValidSignature(body, timestamp, signature, this.webhookSecret);
  }

  /**
   * Timestamp'in geçerli olup olmadığını kontrol eder (replay attack önleme)
   */
  isExpired(timestamp: string): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);

    if (isNaN(webhookTime)) {
      return true;
    }

    return currentTime - webhookTime > this.expirationSeconds;
  }

  // ==========================================================================
  // WEBHOOK PROCESSING
  // ==========================================================================

  /**
   * Gelen webhook'u işler ve database'i günceller
   */
  async processWebhook(payload: ThirdwebWebhookPayload): Promise<WebhookProcessResult> {
    const prisma = getPrisma();

    try {
      // Daha önce işlenmiş mi kontrol et
      const existingLog = await this.webhookLogRepo.findByQueueId(payload.queueId);

      // Status priority kontrolü
      if (existingLog) {
        const existingPriority = WEBHOOK_STATUS_PRIORITY[existingLog.status] || 0;
        const newPriority = WEBHOOK_STATUS_PRIORITY[payload.status] || 0;

        // Daha düşük öncelikli status gelirse skip et
        if (newPriority <= existingPriority) {
          logger.info({
            queueId: payload.queueId,
            existingStatus: existingLog.status,
            newStatus: payload.status,
            message: 'Skipping lower priority webhook status'
          });

          return {
            success: true,
            action: 'skipped',
            message: `Lower priority status ignored. Current: ${existingLog.status}, Received: ${payload.status}`,
            webhookLogId: existingLog.id
          };
        }
      }

      // Wallet'ı takip adresi ile bul: önce toAddress (alıcı), yoksa fromAddress (gönderen; tip send'de contract toAddress olabilir)
      let wallet = await this.walletRepo.findByAddressForTracking(payload.toAddress);
      if (!wallet) {
        wallet = (await this.walletRepo.findByAddressForTracking(payload.fromAddress)) ?? null;
      }

      // Transaction'ı bul
      let transactionId: string | undefined;

      if (wallet) {
        // 1. Önce metadata'dan internal transaction ID'yi ara
        transactionId = this.extractInternalTransactionId(payload.functionArgs);

        // 2. Bulunamazsa, wallet ve txHash ile eşleştir (hash 0x ile veya olmadan saklanmış olabilir)
        if (!transactionId && payload.transactionHash) {
          const h = (payload.transactionHash || '').trim().toLowerCase();
          const with0x = h.startsWith('0x') ? h : `0x${h}`;
          const without0x = with0x.startsWith('0x') ? with0x.slice(2) : with0x;
          const tx = await prisma.transaction.findFirst({
            where: {
              walletId: wallet.id,
              OR: [{ txHash: with0x }, { txHash: without0x }, { txHash: payload.transactionHash }]
            },
            select: { id: true }
          });
          transactionId = tx?.id;
        }

        // 3. Hala bulunamazsa, pending status'ta ve aynı toAddress'e sahip son transaction'ı bul
        if (!transactionId) {
          const pendingTx = await prisma.transaction.findFirst({
            where: {
              walletId: wallet.id,
              status: 'pending',
              toAddress: payload.toAddress,
              provider: 'thirdweb'
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
          });
          transactionId = pendingTx?.id;
        }
      }

      // 4. Transaction yoksa: from/to smartAccount doğrulaması ile DEPOSIT veya WITHDRAW oluştur (webhook'tan gelen external transfer)
      if (!transactionId) {
        const fromWallet = await this.walletRepo.findByAddressForTracking(payload.fromAddress);
        const toWallet = await this.walletRepo.findByAddressForTracking(payload.toAddress);

        const isMined = payload.status === 'mined';
        const status = isMined ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING;
        const txHash = payload.transactionHash ?? null;

        // DEPOSIT: to = bizim wallet (smartAccount), from = external → alıcı bizim sistemde
        if (toWallet && !fromWallet) {
          const depositTx = await prisma.transaction.create({
            data: {
              walletId: toWallet.id,
              actionType: TransactionActionType.DEPOSIT as string as PrismaTransactionActionType,
              status,
              amount: null,
              fromAddress: payload.fromAddress,
              toAddress: payload.toAddress,
              txHash,
              provider: 'thirdweb',
              errorMessage: null,
              confirmedAt: isMined ? new Date() : null,
              failedAt: null,
              metadata: {
                source: 'thirdweb_webhook',
                queueId: payload.queueId,
                chainId: payload.chainId,
                blockNumber: payload.blockNumber,
              },
            },
          });
          transactionId = depositTx.id;
          logger.info({
            transactionId: depositTx.id,
            walletId: toWallet.id,
            fromAddress: payload.fromAddress,
            toAddress: payload.toAddress,
            txHash,
            message: 'DEPOSIT transaction created from webhook (to = our wallet)',
          });
        }
        // WITHDRAW: from = bizim wallet (smartAccount), to = external → gönderen bizim sistemde
        else if (fromWallet && !toWallet) {
          const withdrawTx = await prisma.transaction.create({
            data: {
              walletId: fromWallet.id,
              actionType: TransactionActionType.WITHDRAW as string as PrismaTransactionActionType,
              status,
              amount: null,
              fromAddress: payload.fromAddress,
              toAddress: payload.toAddress,
              txHash,
              provider: 'thirdweb',
              errorMessage: null,
              confirmedAt: isMined ? new Date() : null,
              failedAt: null,
              metadata: {
                source: 'thirdweb_webhook',
                queueId: payload.queueId,
                chainId: payload.chainId,
                blockNumber: payload.blockNumber,
              },
            },
          });
          transactionId = withdrawTx.id;
          logger.info({
            transactionId: withdrawTx.id,
            walletId: fromWallet.id,
            fromAddress: payload.fromAddress,
            toAddress: payload.toAddress,
            txHash,
            message: 'WITHDRAW transaction created from webhook (from = our wallet)',
          });
        }
      }

      // Status'a göre işlem yap
      if (payload.status === 'mined') {
        logger.info({
          queueId: payload.queueId,
          transactionHash: payload.transactionHash,
          fromAddress: payload.fromAddress,
          toAddress: payload.toAddress,
          walletFound: !!wallet,
          transactionIdFromLookup: transactionId ?? null,
          message: 'Thirdweb mined webhook received (tip send may use worker confirm if SDK-submitted)',
        });
      }
      switch (payload.status) {
        case 'sent':
          await this.handleSentTransaction(payload, transactionId);
          break;

        case 'mined':
          await this.handleMinedTransaction(payload, transactionId);
          break;

        case 'errored':
          await this.handleErroredTransaction(payload, transactionId);
          break;

        case 'cancelled':
          await this.handleCancelledTransaction(payload, transactionId);
          break;
      }

      // Contract'tan balance + pendingTips çekip wallet tablosunu güncelle (gelen veriye göre)
      if (wallet) {
        this.walletService.syncWalletBalanceFromChain(wallet.id).catch((err) => {
          logger.warn({ walletId: wallet.id, error: String(err), message: 'syncWalletBalanceFromChain failed after webhook' });
        });
      }

      // Webhook log'u kaydet veya güncelle
      const webhookLog = await this.webhookLogRepo.upsertByQueueId({
        queueId: payload.queueId,
        status: payload.status as ThirdwebWebhookStatus,
        onchainStatus: payload.onchainStatus as ThirdwebOnchainStatus | null,
        chainId: payload.chainId,
        fromAddress: payload.fromAddress,
        toAddress: payload.toAddress,
        transactionHash: payload.transactionHash,
        blockNumber: payload.blockNumber,
        functionName: payload.functionName,
        functionArgs: payload.functionArgs,
        errorMessage: payload.errorMessage,
        rawPayload: JSON.parse(JSON.stringify(payload)),
        transactionId: transactionId
      });

      logger.info({
        queueId: payload.queueId,
        status: payload.status,
        onchainStatus: payload.onchainStatus,
        transactionHash: payload.transactionHash,
        transactionId,
        webhookLogId: webhookLog.id,
        message: 'Webhook processed successfully'
      });

      return {
        success: true,
        action: existingLog ? 'updated' : 'created',
        message: `Webhook ${payload.status} processed`,
        transactionId,
        webhookLogId: webhookLog.id
      };

    } catch (error) {
      logger.error({
        queueId: payload.queueId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        message: 'Failed to process webhook'
      });

      throw error;
    }
  }

  // ==========================================================================
  // STATUS HANDLERS
  // ==========================================================================

  /**
   * Sent transaction handler - Bulunan transaction ve bağlı (SEND/RECEIVE) kayıt pending + txHash ile güncellenir
   */
  private async handleSentTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    if (!transactionId) {
      logger.debug({
        queueId: payload.queueId,
        message: 'No internal transaction ID found for sent webhook'
      });
      return;
    }

    const prisma = getPrisma();
    const txHash = payload.transactionHash;
    const metaUpdate = {
      thirdweb: {
        queueId: payload.queueId,
        sentAt: payload.sentAt,
        sentAtBlockNumber: payload.sentAtBlockNumber
      }
    };

    const existingMeta = await this.getExistingMetadata(transactionId);

    // Bulunan transaction'ı pending + txHash ile güncelle
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.PENDING,
        txHash,
        metadata: { ...existingMeta, ...metaUpdate }
      }
    });

    // Tip send/receive çifti: bağlı kaydı da aynı txHash ve pending ile güncelle
    const linkedId =
      (existingMeta?.receiveTransactionId as string) || (existingMeta?.linkedTransactionId as string);
    if (linkedId) {
      const linkedMeta = await this.getExistingMetadata(linkedId);
      await prisma.transaction.update({
        where: { id: linkedId },
        data: {
          status: TransactionStatus.PENDING,
          txHash,
          metadata: { ...linkedMeta, ...metaUpdate }
        }
      });
    }

    logger.info({
      transactionId,
      linkedId: linkedId || undefined,
      txHash,
      queueId: payload.queueId,
      message: 'Transaction(s) marked as pending via thirdweb webhook'
    });
  }

  /**
   * Mined transaction handler - Aynı txHash'e sahip tüm transaction'lar (SEND + RECEIVE) confirm/fail edilir
   */
  private async handleMinedTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    const rawHash = (payload.transactionHash || '').trim();
    const txHash = rawHash
      ? (rawHash.toLowerCase().startsWith('0x') ? rawHash.toLowerCase() : '0x' + rawHash.toLowerCase())
      : undefined;
    const errorMessage = `Transaction reverted on-chain. Block: ${payload.blockNumber}, Hash: ${payload.transactionHash}`;

    // Bulunan transaction yoksa txHash ile ara (tip send/receive aynı hash ile iki kayıt)
    let idsToProcess: string[] = transactionId ? [transactionId] : [];
    if (txHash) {
      const byTxHash = await this.transactionRepo.findByTxHash(txHash);
      const pendingIds = byTxHash
        .filter(tx => tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.CREATED)
        .map(tx => tx.id);
      idsToProcess = [...new Set([...idsToProcess, ...pendingIds])];
      logger.debug({
        queueId: payload.queueId,
        txHash,
        byTxHashCount: byTxHash.length,
        pendingIdsCount: pendingIds.length,
        idsToProcessCount: idsToProcess.length,
        message: 'Mined webhook: findByTxHash result',
      });
    }

    if (idsToProcess.length === 0) {
      logger.warn({
        queueId: payload.queueId,
        txHash: txHash ?? payload.transactionHash,
        fromAddress: payload.fromAddress,
        toAddress: payload.toAddress,
        message: 'Mined webhook: no internal transaction found by txHash; DB status may stay PENDING'
      });
      return;
    }

    // mined = blokta onaylandı; onchainStatus 'reverted' değilse success kabul et (bazen null gelir)
    const isReverted = payload.onchainStatus === 'reverted';
    if (isReverted) {
      for (const id of idsToProcess) {
        await this.transactionService.failTransaction(id, errorMessage);
      }
      logger.warn({
        transactionIds: idsToProcess,
        txHash,
        blockNumber: payload.blockNumber,
        message: 'Transaction(s) reverted via thirdweb webhook'
      });
    } else {
      for (const id of idsToProcess) {
        await this.transactionService.confirmTransaction(id, txHash);
      }
      logger.info({
        transactionIds: idsToProcess,
        txHash,
        blockNumber: payload.blockNumber,
        onchainStatus: payload.onchainStatus ?? 'success',
        message: 'Transaction(s) confirmed via thirdweb webhook'
      });
    }
  }

  /**
   * Errored transaction handler - Bulunan + bağlı (SEND/RECEIVE) transaction'lar failed olarak işaretlenir
   */
  private async handleErroredTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    const idsToFail = await this.collectTransactionIdsToUpdate(transactionId);
    if (idsToFail.length === 0) {
      logger.warn({
        queueId: payload.queueId,
        errorMessage: payload.errorMessage,
        message: 'No internal transaction ID found for errored webhook'
      });
      return;
    }

    const errorMessage = payload.errorMessage || 'Transaction failed (thirdweb engine error)';
    for (const id of idsToFail) {
      await this.transactionService.failTransaction(id, errorMessage);
    }

    logger.error({
      transactionIds: idsToFail,
      errorMessage: payload.errorMessage,
      queueId: payload.queueId,
      message: 'Transaction(s) failed via thirdweb webhook'
    });
  }

  /**
   * Cancelled transaction handler - Bulunan + bağlı (SEND/RECEIVE) transaction'lar failed olarak işaretlenir
   */
  private async handleCancelledTransaction(
    payload: ThirdwebWebhookPayload,
    transactionId?: string
  ): Promise<void> {
    const idsToFail = await this.collectTransactionIdsToUpdate(transactionId);
    if (idsToFail.length === 0) {
      logger.warn({
        queueId: payload.queueId,
        message: 'No internal transaction ID found for cancelled webhook'
      });
      return;
    }

    const errorMessage = `Transaction cancelled at ${payload.cancelledAt || 'unknown time'}`;
    for (const id of idsToFail) {
      await this.transactionService.failTransaction(id, errorMessage);
    }

    logger.warn({
      transactionIds: idsToFail,
      cancelledAt: payload.cancelledAt,
      queueId: payload.queueId,
      message: 'Transaction(s) cancelled via thirdweb webhook'
    });
  }

  /**
   * Bulunan transaction + metadata'daki bağlı (receiveTransactionId / linkedTransactionId) id'leri döner
   */
  private async collectTransactionIdsToUpdate(transactionId?: string): Promise<string[]> {
    if (!transactionId) return [];
    const meta = await this.getExistingMetadata(transactionId);
    const linkedId =
      (meta?.receiveTransactionId as string) || (meta?.linkedTransactionId as string);
    const ids = [transactionId];
    if (linkedId) ids.push(linkedId);
    return ids;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Function args'dan internal transaction ID'yi çıkarır
   * Bu, mint işlemi sırasında metadata'ya eklenen ID'dir
   */
  private extractInternalTransactionId(functionArgs: string | null): string | undefined {
    if (!functionArgs) return undefined;

    try {
      // functionArgs format: "address,tokenURI"
      const parts = functionArgs.split(',');
      if (parts.length < 2) return undefined;

      const tokenUri = parts.slice(1).join(','); // Virgül içeren URI'ları birleştir

      // data:application/json;base64, formatını parse et
      if (tokenUri.startsWith('data:application/json;base64,')) {
        const base64Data = tokenUri.replace('data:application/json;base64,', '');
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        const metadata = JSON.parse(jsonString);

        // internal_transaction_id veya tipbox_transaction_id alanını ara
        return metadata.internal_transaction_id ||
          metadata.tipbox_transaction_id ||
          undefined;
      }

      return undefined;
    } catch (error) {
      logger.debug({
        functionArgs,
        error: error instanceof Error ? error.message : String(error),
        message: 'Could not extract internal transaction ID'
      });
      return undefined;
    }
  }

  /**
   * Mevcut transaction metadata'sını getirir
   */
  private async getExistingMetadata(transactionId: string): Promise<Record<string, unknown>> {
    const prisma = getPrisma();
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { metadata: true }
    });
    return (tx?.metadata as Record<string, unknown>) || {};
  }

  // ==========================================================================
  // ADMIN / MONITORING
  // ==========================================================================

  /**
   * Son webhook loglarını getirir
   */
  async getRecentLogs(limit: number = 20) {
    return this.webhookLogRepo.findRecent(limit);
  }

  /**
   * Queue ID ile log getirir
   */
  async getLogByQueueId(queueId: string) {
    return this.webhookLogRepo.findByQueueId(queueId);
  }

  /**
   * Transaction ID ile logları getirir
   */
  async getLogsByTransactionId(transactionId: string) {
    return this.webhookLogRepo.findByTransactionId(transactionId);
  }

  /**
   * Wallet adresi ile logları getirir
   */
  async getLogsByWalletAddress(address: string, options?: { limit?: number; cursor?: string }) {
    return this.webhookLogRepo.findByWalletAddress(address, options);
  }

  /**
   * Status bazlı istatistikler
   */
  async getStats() {
    const [sent, mined, errored, cancelled] = await Promise.all([
      this.webhookLogRepo.countByStatus('sent' as ThirdwebWebhookStatus),
      this.webhookLogRepo.countByStatus('mined' as ThirdwebWebhookStatus),
      this.webhookLogRepo.countByStatus('errored' as ThirdwebWebhookStatus),
      this.webhookLogRepo.countByStatus('cancelled' as ThirdwebWebhookStatus)
    ]);

    return {
      sent,
      mined,
      errored,
      cancelled,
      total: sent + mined + errored + cancelled
    };
  }

  /**
   * Backend wallet balance düşük uyarısını işler
   */
  async handleLowBalanceAlert(walletAddress: string, balance: string): Promise<void> {
    logger.warn({
      walletAddress,
      balance,
      message: 'Backend wallet balance is low! Please top up.'
    });

    // TODO: Burada Slack, Discord, email vb. bildirim gönderilebilir
    // await this.notificationService.sendAdminAlert(...)
  }
}
