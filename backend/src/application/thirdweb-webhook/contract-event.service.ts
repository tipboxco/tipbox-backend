/**
 * ContractEventService
 * 
 * Thirdweb Contract Subscriptions üzerinden gelen blockchain event'lerini işler.
 * Transfer, Mint, Approval gibi contract event'lerini dinler ve database'e kaydeder.
 * 
 * @see https://portal.thirdweb.com/engine/v2/features/contract-subscriptions
 */

import crypto from 'crypto';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { ContractEventLogPrismaRepository } from '../../infrastructure/repositories/contract-event-log-prisma.repository';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction-prisma.repository';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import {
  ContractEventPayload,
  TransactionReceiptPayload,
  ThirdwebContractSubscriptionPayload,
  EventProcessResult,
  parseTransferEvent,
  parseApprovalEvent,
  isContractSupported,
  TokenType,
  weiToToken,
  isSignificantTransfer,
  ZERO_ADDRESS
} from '../../interfaces/thirdweb-webhook/contract-event.dto';
import { WalletService } from '../wallet/wallet.service';
import logger from '../../infrastructure/logger/logger';

// Token decimals configuration
const TOKEN_DECIMALS = parseInt(process.env.TIPS_TOKEN_DECIMALS || '18', 10);

// ============================================================================
// SERVICE
// ============================================================================

export class ContractEventService {
  private webhookSecret: string;
  private expirationSeconds: number;

  constructor(
    private readonly eventLogRepo = new ContractEventLogPrismaRepository(),
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly transactionRepo = new TransactionPrismaRepository(),
    private readonly transactionService = new TransactionService(),
    private readonly walletService = new WalletService()
  ) {
    this.webhookSecret = process.env.THIRDWEB_WEBHOOK_SECRET || '';
    this.expirationSeconds = parseInt(process.env.THIRDWEB_WEBHOOK_EXPIRATION_SECONDS || '300', 10);
  }

  // ==========================================================================
  // SIGNATURE VERIFICATION (Same as transaction webhooks)
  // ==========================================================================

  /**
   * HMAC-SHA256 ile signature oluşturur
   */
  private generateSignature(body: string, timestamp: string): string {
    const payload = `${timestamp}.${body}`;
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Webhook signature'ını doğrular
   */
  verifySignature(body: string, timestamp: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.error('Webhook secret is not configured');
      return false;
    }

    try {
      const expectedSignature = this.generateSignature(body, timestamp);
      
      if (expectedSignature.length !== signature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Timestamp kontrolü
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
  // EVENT PROCESSING
  // ==========================================================================

  /**
   * Ana event işleme fonksiyonu
   */
  async processEvent(payload: ThirdwebContractSubscriptionPayload): Promise<EventProcessResult> {
    try {
      if (payload.type === 'event-log') {
        return this.processEventLog(payload);
      } else if (payload.type === 'transaction-receipt') {
        return this.processTransactionReceipt(payload);
      }

      return {
        success: false,
        action: 'skipped',
        message: `Unknown payload type: ${(payload as any).type}`
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        payload: JSON.stringify(payload).substring(0, 500),
        message: 'Failed to process contract event'
      });
      throw error;
    }
  }

  /**
   * Event Log işleme (Transfer, Mint, Approval vb.)
   */
  private async processEventLog(payload: ContractEventPayload): Promise<EventProcessResult> {
    const { data } = payload;
    const prisma = getPrisma();

    // Contract destekleniyor mu kontrol et
    if (!isContractSupported(data.contractAddress)) {
      logger.debug({
        contractAddress: data.contractAddress,
        message: 'Contract not in supported list, skipping'
      });
      return {
        success: true,
        action: 'skipped',
        message: 'Contract not supported'
      };
    }

    // Daha önce işlenmiş mi kontrol et
    const existing = await this.eventLogRepo.findByHashAndLogIndex(
      data.transactionHash,
      data.logIndex
    );

    if (existing) {
      logger.debug({
        transactionHash: data.transactionHash,
        logIndex: data.logIndex,
        message: 'Event already processed'
      });
      return {
        success: true,
        action: 'skipped',
        message: 'Event already exists',
        eventLogId: existing.id
      };
    }

    // Wallet eşleştirmesi yap
    let walletId: string | undefined;
    let transactionId: string | undefined;

    // Transfer event'i özel işleme
    if (data.eventName === 'Transfer') {
      const result = await this.handleTransferEvent(data, prisma);
      walletId = result.walletId;
      transactionId = result.transactionId;
    }
    
    // Approval event'i özel işleme
    else if (data.eventName === 'Approval') {
      const result = await this.handleApprovalEvent(data);
      walletId = result.walletId;
    }

    // Event log'u kaydet
    const eventLog = await this.eventLogRepo.create({
      chainId: data.chainId,
      contractAddress: data.contractAddress,
      blockNumber: data.blockNumber,
      transactionHash: data.transactionHash,
      transactionIndex: data.transactionIndex,
      logIndex: data.logIndex,
      eventName: data.eventName,
      decodedLog: data.decodedLog,
      topics: data.topics,
      data: data.data,
      timestamp: new Date(data.timestamp),
      rawPayload: payload as any,
      transactionId,
      walletId,
      processed: !!transactionId // Eğer transaction eşleştiyse processed
    });

    logger.info({
      eventLogId: eventLog.id,
      eventName: data.eventName,
      contractAddress: data.contractAddress,
      transactionHash: data.transactionHash,
      walletId,
      transactionId,
      message: 'Contract event logged'
    });

    return {
      success: true,
      action: 'created',
      message: `Event ${data.eventName} logged`,
      eventLogId: eventLog.id,
      transactionId,
      walletId
    };
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Transfer event handler - ERC20 ve ERC721 destekler
   */
  private async handleTransferEvent(
    data: ContractEventPayload['data'],
    prisma: ReturnType<typeof getPrisma>
  ): Promise<{ walletId?: string; transactionId?: string }> {
    const transferEvent = parseTransferEvent(data.decodedLog, TOKEN_DECIMALS);
    
    if (!transferEvent) {
      return {};
    }

    let walletId: string | undefined;
    let transactionId: string | undefined;

    // To address'i wallet ile eşleştir
    const toWallet = await this.walletRepo.findByPublicAddress(transferEvent.to);
    const fromWallet = await this.walletRepo.findByPublicAddress(transferEvent.from);

    // ===== ERC20 TOKEN TRANSFER =====
    if (transferEvent.tokenType === TokenType.ERC20 && transferEvent.value) {
      const amount = weiToToken(transferEvent.value, TOKEN_DECIMALS);
      
      // Minimum transfer kontrolü
      if (!isSignificantTransfer(transferEvent.value, TOKEN_DECIMALS, 0.0001)) {
        logger.debug({
          amount,
          message: 'Insignificant transfer amount, skipping balance update'
        });
        return { walletId: toWallet?.id || fromWallet?.id };
      }

      // MINT: Token oluşturma (from = 0x0)
      if (transferEvent.isMint && toWallet) {
        walletId = toWallet.id;
        
        // Pending transaction bul
        const pendingTx = await prisma.transaction.findFirst({
          where: {
            walletId: toWallet.id,
            status: 'pending',
            provider: 'thirdweb',
            actionType: { in: ['CLAIM_REWARD', 'AIRDROP', 'TIP_RECEIVE'] }
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true }
        });

        if (pendingTx) {
          transactionId = pendingTx.id;
          await this.transactionService.confirmTransaction(transactionId, data.transactionHash);
        } else {
          // Transaction yoksa direkt balance güncelle (external mint)
          await this.walletService.updateBalance(toWallet.id, amount, {
            reason: 'Token mint from contract event',
            txHash: data.transactionHash
          });
        }

        logger.info({
          walletId,
          amount,
          transactionHash: data.transactionHash,
          message: 'ERC20 Token mint detected'
        });
      }
      
      // BURN: Token yakma (to = 0x0)
      else if (transferEvent.isBurn && fromWallet) {
        walletId = fromWallet.id;
        
        // Balance düş (negatif amount)
        await this.walletService.updateBalance(fromWallet.id, -amount, {
          reason: 'Token burn from contract event',
          txHash: data.transactionHash
        });

        logger.info({
          walletId,
          amount: -amount,
          transactionHash: data.transactionHash,
          message: 'ERC20 Token burn detected'
        });
      }
      
      // TRANSFER: Normal transfer
      else {
        // Alıcı bizim sistemdeyse - balance artır
        if (toWallet) {
          walletId = toWallet.id;
          
          // Pending receive transaction bul
          const pendingReceiveTx = await prisma.transaction.findFirst({
            where: {
              walletId: toWallet.id,
              status: 'pending',
              actionType: 'TIP_RECEIVE'
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
          });

          if (pendingReceiveTx) {
            transactionId = pendingReceiveTx.id;
            await this.transactionService.confirmTransaction(transactionId, data.transactionHash);
          } else {
            // External transfer - direkt balance güncelle
            await this.walletService.updateBalance(toWallet.id, amount, {
              reason: `Token received from ${transferEvent.from}`,
              txHash: data.transactionHash
            });
          }

          logger.info({
            walletId,
            amount,
            from: transferEvent.from,
            message: 'ERC20 Token received'
          });
        }

        // Gönderen bizim sistemdeyse - balance düş
        if (fromWallet) {
          if (!walletId) walletId = fromWallet.id;
          
          // Pending send transaction bul
          const pendingSendTx = await prisma.transaction.findFirst({
            where: {
              walletId: fromWallet.id,
              status: 'pending',
              actionType: 'TIP_SEND'
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
          });

          if (pendingSendTx) {
            if (!transactionId) transactionId = pendingSendTx.id;
            await this.transactionService.confirmTransaction(pendingSendTx.id, data.transactionHash);
          }
          // Not: Balance zaten transaction confirm'de düşülüyor

          logger.info({
            walletId: fromWallet.id,
            amount: -amount,
            to: transferEvent.to,
            message: 'ERC20 Token sent'
          });
        }
      }
    }
    
    // ===== ERC721 NFT TRANSFER =====
    else if (transferEvent.tokenType === TokenType.ERC721 && toWallet) {
      walletId = toWallet.id;
      
      // NFT Mint
      if (transferEvent.isMint) {
        const pendingTx = await prisma.transaction.findFirst({
          where: {
            walletId: toWallet.id,
            status: 'pending',
            provider: 'thirdweb',
            actionType: { in: ['CLAIM_BADGE', 'CLAIM_REWARD'] }
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true }
        });

        if (pendingTx) {
          transactionId = pendingTx.id;
          await this.transactionService.confirmTransaction(transactionId, data.transactionHash);

          logger.info({
            transactionId,
            walletId,
            tokenId: transferEvent.tokenId,
            message: 'NFT Mint confirmed via Transfer event'
          });
        }
      }
    }
    
    // Fallback - herhangi bir wallet eşleşmesi
    if (!walletId && fromWallet) {
      walletId = fromWallet.id;
    }

    return { walletId, transactionId };
  }

  /**
   * Approval event handler - ERC20 token onayları
   */
  private async handleApprovalEvent(
    data: ContractEventPayload['data']
  ): Promise<{ walletId?: string }> {
    const approvalEvent = parseApprovalEvent(data.decodedLog, TOKEN_DECIMALS);
    
    if (!approvalEvent) {
      return {};
    }

    // Owner wallet'ı bul
    const ownerWallet = await this.walletRepo.findByPublicAddress(approvalEvent.owner);
    
    if (ownerWallet) {
      logger.info({
        walletId: ownerWallet.id,
        spender: approvalEvent.spender,
        value: approvalEvent.value,
        tokenType: approvalEvent.tokenType,
        message: 'Token approval detected'
      });

      return { walletId: ownerWallet.id };
    }

    return {};
  }

  /**
   * Transaction Receipt işleme
   */
  private async processTransactionReceipt(payload: TransactionReceiptPayload): Promise<EventProcessResult> {
    const { data } = payload;

    // Contract destekleniyor mu kontrol et
    if (!isContractSupported(data.contractAddress)) {
      return {
        success: true,
        action: 'skipped',
        message: 'Contract not supported'
      };
    }

    // Transaction status kontrolü
    if (data.status !== 1) {
      logger.warn({
        transactionHash: data.transactionHash,
        status: data.status,
        message: 'Transaction receipt indicates failure'
      });

      // İlgili transaction'ı bul ve fail olarak işaretle
      const wallet = await this.walletRepo.findByPublicAddress(data.to);
      if (wallet) {
        const prisma = getPrisma();
        const pendingTx = await prisma.transaction.findFirst({
          where: {
            walletId: wallet.id,
            status: 'pending',
            txHash: data.transactionHash
          },
          select: { id: true }
        });

        if (pendingTx) {
          await this.transactionService.failTransaction(
            pendingTx.id,
            `Transaction reverted on-chain. Block: ${data.blockNumber}`
          );
        }
      }
    }

    logger.debug({
      transactionHash: data.transactionHash,
      blockNumber: data.blockNumber,
      status: data.status,
      message: 'Transaction receipt processed'
    });

    return {
      success: true,
      action: 'processed',
      message: `Receipt processed, status: ${data.status === 1 ? 'success' : 'failed'}`
    };
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Son event loglarını getirir
   */
  async getRecentEvents(limit: number = 20) {
    return this.eventLogRepo.findRecent(limit);
  }

  /**
   * Contract ve event name ile event logları getirir
   */
  async getEventsByContractAndName(
    contractAddress: string,
    eventName: string,
    options?: { limit?: number; cursor?: string }
  ) {
    return this.eventLogRepo.findByContractAndEvent(contractAddress, eventName, options);
  }

  /**
   * Wallet'a ait event logları getirir
   */
  async getEventsByWallet(walletId: string, options?: { limit?: number; cursor?: string }) {
    return this.eventLogRepo.findByWalletId(walletId, options);
  }

  /**
   * Transaction hash ile event logları getirir
   */
  async getEventsByTransactionHash(transactionHash: string) {
    return this.eventLogRepo.findByTransactionHash(transactionHash);
  }

  /**
   * İşlenmemiş event loglarını getirir
   */
  async getUnprocessedEvents(limit: number = 100) {
    return this.eventLogRepo.findUnprocessed(limit);
  }

  /**
   * Event istatistikleri
   */
  async getStats(contractAddress?: string) {
    if (contractAddress) {
      return this.eventLogRepo.getEventStats(contractAddress);
    }

    // Genel istatistikler
    const prisma = getPrisma();
    const [total, processed, unprocessed] = await Promise.all([
      prisma.contractEventLog.count(),
      prisma.contractEventLog.count({ where: { processed: true } }),
      prisma.contractEventLog.count({ where: { processed: false } })
    ]);

    return { total, processed, unprocessed };
  }

  // ==========================================================================
  // REPROCESSING
  // ==========================================================================

  /**
   * İşlenmemiş event'leri yeniden işle
   */
  async reprocessUnprocessedEvents(limit: number = 100): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const unprocessed = await this.eventLogRepo.findUnprocessed(limit);
    
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const event of unprocessed) {
      try {
        // Transfer event'lerini yeniden işle
        if (event.eventName === 'Transfer') {
          const transferEvent = parseTransferEvent(event.decodedLog);
          
          if (transferEvent) {
            const toWallet = await this.walletRepo.findByPublicAddress(transferEvent.to);
            
            if (toWallet) {
              await this.eventLogRepo.markAsProcessed(event.id, undefined, toWallet.id);
              processed++;
              continue;
            }
          }
        }

        // İşlenemedi
        errors.push(`Event ${event.id}: Could not match to wallet`);
        failed++;
      } catch (error) {
        errors.push(`Event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
    }

    return { processed, failed, errors };
  }
}
