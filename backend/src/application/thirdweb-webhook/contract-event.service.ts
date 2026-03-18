/**
 * ContractEventService
 * 
 * Thirdweb Contract Subscriptions üzerinden gelen blockchain event'lerini işler.
 * Transfer, Mint, Approval gibi contract event'lerini dinler ve database'e kaydeder.
 * 
 * @see https://portal.thirdweb.com/engine/v2/features/contract-subscriptions
 */

import crypto from 'crypto';
import { TransactionActionType } from '@prisma/client';
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
  ZERO_ADDRESS,
  NormalizedContractEvent,
  DecodedLogValue
} from '../../interfaces/thirdweb-webhook/contract-event.dto';
import { WalletService } from '../wallet/wallet.service';
import { getThirdwebSdkService } from '../wallet/thirdweb-sdk/thirdweb-sdk.service';
import logger from '../../infrastructure/logger/logger';

// Token decimals configuration
const TOKEN_DECIMALS = parseInt(process.env.TIPS_TOKEN_DECIMALS || '18', 10);

// feeRecipient adresi cache (contract'tan bir kez okunur)
let cachedFeeRecipient: string | null = null;

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
   * Ana event işleme fonksiyonu (legacy format)
   */
  async processEvent(payload: ThirdwebContractSubscriptionPayload): Promise<EventProcessResult> {
    try {
      if ('type' in payload && (payload as ContractEventPayload).type === 'event-log') {
        return this.processEventLog(payload as ContractEventPayload);
      } else if ('type' in payload && (payload as TransactionReceiptPayload).type === 'transaction-receipt') {
        return this.processTransactionReceipt(payload as TransactionReceiptPayload);
      }

      return {
        success: false,
        action: 'skipped',
        message: `Unknown payload type: ${'type' in payload ? String((payload as unknown as Record<string, unknown>).type) : 'unknown'}`
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
   * Normalize edilmiş event'leri işle (v1.events formatı)
   * Birden fazla event'i tek seferde işler
   */
  async processNormalizedEvents(events: NormalizedContractEvent[]): Promise<{
    processed: number;
    skipped: number;
    errors: string[];
  }> {
    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const result = await this.processNormalizedEvent(event);
        
        if (result.action === 'created' || result.action === 'processed') {
          processed++;
        } else {
          skipped++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Event ${event.transactionHash}:${event.logIndex} - ${errorMsg}`);
        logger.error({
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
          error: errorMsg,
          message: 'Error processing normalized event'
        });
      }
    }

    return { processed, skipped, errors };
  }

  /**
   * Tek bir normalized event'i işle
   */
  private async processNormalizedEvent(event: NormalizedContractEvent): Promise<EventProcessResult> {
    const prisma = getPrisma();

    // Contract destekleniyor mu kontrol et
    if (!isContractSupported(event.contractAddress)) {
      logger.debug({
        contractAddress: event.contractAddress,
        message: 'Contract not in supported list, skipping'
      });
      return {
        success: true,
        action: 'skipped',
        message: 'Contract not supported'
      };
    }

    // Wallet relevance check - sistemde tanımlı wallet var mı?
    const relevanceCheck = await this.checkNormalizedEventRelevance(event);
    
    if (!relevanceCheck.isRelevant) {
      logger.debug({
        eventName: event.eventName,
        transactionHash: event.transactionHash,
        addresses: relevanceCheck.addresses,
        message: 'Event skipped - no registered wallet involved'
      });
      return {
        success: true,
        action: 'skipped',
        message: 'No registered wallet involved in this event'
      };
    }

    // Daha önce işlenmiş mi kontrol et
    const existing = await this.eventLogRepo.findByHashAndLogIndex(
      event.transactionHash,
      event.logIndex
    );

    if (existing) {
      logger.debug({
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
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
    let walletIdsToSync: string[] = [];
    if (event.eventName === 'Transfer') {
      const result = await this.handleNormalizedTransferEvent(event, prisma);
      walletId = result.walletId;
      transactionId = result.transactionId;
      walletIdsToSync = result.walletIds ?? (result.walletId ? [result.walletId] : []);
    }
    
    // Approval event'i özel işleme
    else if (event.eventName === 'Approval') {
      const result = await this.handleNormalizedApprovalEvent(event);
      walletId = result.walletId;
      walletIdsToSync = result.walletId ? [result.walletId] : [];
    }

    // Event log'u kaydet
    const eventLog = await this.eventLogRepo.create({
      chainId: event.chainId,
      contractAddress: event.contractAddress,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      transactionIndex: event.transactionIndex,
      logIndex: event.logIndex,
      eventName: event.eventName,
      decodedLog: JSON.parse(JSON.stringify(event.decodedLog)),
      topics: event.topics,
      data: event.data,
      timestamp: event.blockTimestamp,
      rawPayload: JSON.parse(JSON.stringify(event.rawPayload)),
      transactionId,
      walletId,
      processed: !!transactionId
    });

    logger.info({
      eventLogId: eventLog.id,
      eventName: event.eventName,
      contractAddress: event.contractAddress,
      transactionHash: event.transactionHash,
      walletId,
      transactionId,
      message: 'Contract event logged (v1.events)'
    });

    // Contract'tan balance + pendingTips çekip wallet tablosunu güncelle (gelen veriye göre)
    for (const wid of walletIdsToSync) {
      this.walletService.syncWalletBalanceFromChain(wid).catch((err) => {
        logger.warn({ walletId: wid, error: String(err), message: 'syncWalletBalanceFromChain failed after event' });
      });
    }

    return {
      success: true,
      action: 'created',
      message: `Event ${event.eventName} logged`,
      eventLogId: eventLog.id,
      transactionId,
      walletId
    };
  }

  /**
   * Normalized event için relevance check
   */
  private async checkNormalizedEventRelevance(event: NormalizedContractEvent): Promise<{
    isRelevant: boolean;
    addresses: string[];
    matchedWallets: string[];
  }> {
    const addresses: string[] = [];
    const matchedWallets: string[] = [];

    // Transfer event kontrolü
    if (event.eventName === 'Transfer') {
      const transferEvent = parseTransferEvent(event.decodedLog, TOKEN_DECIMALS);
      
      if (transferEvent) {
        if (transferEvent.from && transferEvent.from !== ZERO_ADDRESS) {
          addresses.push(transferEvent.from.toLowerCase());
        }
        if (transferEvent.to && transferEvent.to !== ZERO_ADDRESS) {
          addresses.push(transferEvent.to.toLowerCase());
        }

        for (const addr of addresses) {
          const wallet = await this.walletRepo.findByAddressForTracking(addr);
          if (wallet) {
            matchedWallets.push(wallet.id);
          }
        }

        if (transferEvent.isMint && transferEvent.to) {
          const toWallet = await this.walletRepo.findByAddressForTracking(transferEvent.to);
          if (toWallet) {
            return { isRelevant: true, addresses, matchedWallets: [toWallet.id] };
          }
        }

        if (transferEvent.isBurn && transferEvent.from) {
          const fromWallet = await this.walletRepo.findByAddressForTracking(transferEvent.from);
          if (fromWallet) {
            return { isRelevant: true, addresses, matchedWallets: [fromWallet.id] };
          }
        }
      }
    }
    
    // Approval event kontrolü
    else if (event.eventName === 'Approval') {
      const approvalEvent = parseApprovalEvent(event.decodedLog, TOKEN_DECIMALS);
      
      if (approvalEvent) {
        addresses.push(approvalEvent.owner.toLowerCase());
        
        const ownerWallet = await this.walletRepo.findByAddressForTracking(approvalEvent.owner);
        if (ownerWallet) {
          return { isRelevant: true, addresses, matchedWallets: [ownerWallet.id] };
        }
      }
    }

    return { isRelevant: matchedWallets.length > 0, addresses, matchedWallets };
  }

  /**
   * Normalized Transfer event handler
   */
  private async handleNormalizedTransferEvent(
    event: NormalizedContractEvent,
    prisma: ReturnType<typeof getPrisma>
  ): Promise<{ walletId?: string; transactionId?: string; walletIds?: string[] }> {
    const transferEvent = parseTransferEvent(event.decodedLog, TOKEN_DECIMALS);
    
    if (!transferEvent) {
      return {};
    }

    let walletId: string | undefined;
    let transactionId: string | undefined;
    const walletIds: string[] = [];

    const toWallet = await this.walletRepo.findByAddressForTracking(transferEvent.to);
    const fromWallet = await this.walletRepo.findByAddressForTracking(transferEvent.from);
    if (toWallet?.id) walletIds.push(toWallet.id);
    if (fromWallet?.id && !walletIds.includes(fromWallet.id)) walletIds.push(fromWallet.id);

    // ===== ERC20 TOKEN TRANSFER =====
    if (transferEvent.tokenType === TokenType.ERC20 && transferEvent.value) {
      const amount = weiToToken(transferEvent.value, TOKEN_DECIMALS);
      
      if (!isSignificantTransfer(transferEvent.value, TOKEN_DECIMALS, 0.0001)) {
        return { walletId: toWallet?.id || fromWallet?.id, walletIds };
      }

      // DEPOSIT: External → TipBox
      if (toWallet && !fromWallet && !transferEvent.isMint) {
        walletId = toWallet.id;

        // Cross-source duplicate guard: aynı txHash ile herhangi bir transaction zaten varsa
        // (TIP_SEND, TIP_RECEIVE vb.), bu bir tip transferinin alt-event'idir — DEPOSIT oluşturma.
        const anyExistingByHash = event.transactionHash
          ? await prisma.transaction.findFirst({
              where: { txHash: event.transactionHash },
              select: { id: true, actionType: true },
            })
          : null;

        if (anyExistingByHash) {
          transactionId = anyExistingByHash.id;
          logger.info({
            txHash: event.transactionHash,
            existingActionType: anyExistingByHash.actionType,
            message: 'Contract event (v1): txHash already tracked, skipping DEPOSIT creation',
          });
        }

        // Pending tip guard: wallet'ta pending/created TIP_RECEIVE varsa bu internal tip — DEPOSIT oluşturma
        if (!anyExistingByHash) {
          const pendingTipReceive = await prisma.transaction.findFirst({
            where: {
              walletId: toWallet.id,
              actionType: 'TIP_RECEIVE' as unknown as TransactionActionType,
              status: { in: ['pending', 'created'] as TransactionStatus[] },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });
          if (pendingTipReceive) {
            transactionId = pendingTipReceive.id;
            logger.info({
              walletId: toWallet.id,
              pendingTipReceiveId: pendingTipReceive.id,
              txHash: event.transactionHash,
              message: 'Contract event (v1): pending TIP_RECEIVE found, skipping DEPOSIT creation (internal tip)',
            });
          }
        }

        if (!anyExistingByHash && !transactionId) {
          // Thirdweb DEPOSIT: sadece DEPOSIT action'ından sorumlu; TIP_RECEIVE INTERNAL TRANSFER bölümünde yönetilir
          const pendingTx = await prisma.transaction.findFirst({
            where: {
              walletId: toWallet.id,
              status: { in: ['pending', 'created'] as TransactionStatus[] },
              actionType: 'DEPOSIT' as unknown as TransactionActionType,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

          if (pendingTx) {
            transactionId = pendingTx.id;
            await this.transactionService.confirmTransaction(transactionId, event.transactionHash);
          } else {
            // DEPOSIT transaction oluştur (doğrudan Prisma)
            const depositTx = await prisma.transaction.create({
              data: {
                walletId: toWallet.id,
                actionType: 'DEPOSIT' as unknown as TransactionActionType,
                status: 'confirmed',
                amount: amount,
                fromAddress: transferEvent.from,
                toAddress: transferEvent.to,
                txHash: event.transactionHash,
                provider: 'external',
                confirmedAt: new Date(),
                metadata: {
                  source: 'contract_event_v1',
                  chainId: event.chainId,
                  contractAddress: event.contractAddress,
                  blockNumber: event.blockNumber,
                  tokenType: 'ERC20',
                },
              },
            });
            transactionId = depositTx.id;

            await this.walletService.updateBalance(toWallet.id, amount, {
              reason: `Deposit from ${transferEvent.from} (tx: ${event.transactionHash})`,
            });
          }
        }

        logger.info({
          walletId, transactionId, amount,
          from: transferEvent.from,
          message: 'ERC20 Deposit detected (v1.events)',
        });
      }

      // WITHDRAW veya FEE: TipBox → External
      else if (fromWallet && !toWallet && !transferEvent.isBurn) {
        walletId = fromWallet.id;

        // feeRecipient adresine yapılan transfer → FEE olarak kaydet
        const isFeeTransfer = await this.isFeeRecipientAddress(transferEvent.to);

        if (isFeeTransfer) {
          // Alıcının walletId'sini bul
          // Adım 1: Aynı txHash ile TIP_RECEIVE transaction'ı ara
          const receiveTx = await prisma.transaction.findFirst({
            where: {
              txHash: event.transactionHash,
              actionType: 'TIP_RECEIVE' as unknown as TransactionActionType,
            },
            select: { walletId: true },
          });

          let receiverWalletId: string | null = receiveTx?.walletId ?? null;

          // Adım 2: TIP_RECEIVE bulunamazsa, TIP_SEND metadata'sından recipientUserId ile dene (txHash eşleşmesi)
          if (!receiverWalletId) {
            const sendTxByHash = await prisma.transaction.findFirst({
              where: {
                txHash: event.transactionHash,
                actionType: 'TIP_SEND' as unknown as TransactionActionType,
              },
              select: { metadata: true },
            });
            const metaByHash = sendTxByHash?.metadata as Record<string, unknown> | null;
            const recipientUserIdByHash = metaByHash?.recipientUserId as string | undefined;
            if (recipientUserIdByHash) {
              const rw = await this.walletRepo.findPreferredForReceivingByUserId(recipientUserIdByHash);
              receiverWalletId = rw?.id ?? null;
            }
          }

          // Adım 3: Webhook worker'dan önce gelmiş olabilir (timing race); fromWallet'ın
          // en son TIP_SEND'ine bak (txHash henüz set edilmemiş olabilir)
          if (!receiverWalletId && fromWallet) {
            const recentSendTx = await prisma.transaction.findFirst({
              where: {
                walletId: fromWallet.id,
                actionType: 'TIP_SEND' as unknown as TransactionActionType,
                status: { in: ['pending', 'created', 'confirmed'] as TransactionStatus[] },
              },
              orderBy: { createdAt: 'desc' },
              select: { metadata: true },
            });
            const metaRecent = recentSendTx?.metadata as Record<string, unknown> | null;
            const recipientUserIdRecent = metaRecent?.recipientUserId as string | undefined;
            if (recipientUserIdRecent) {
              const rw = await this.walletRepo.findPreferredForReceivingByUserId(recipientUserIdRecent);
              receiverWalletId = rw?.id ?? null;
            }
          }

          if (!receiverWalletId) {
            logger.warn({
              txHash: event.transactionHash,
              fromAddress: transferEvent.from,
              message: 'FEE transfer detected but receiver wallet not found; skipping FEE transaction',
            });
          } else {
            // BUG-24 fix: FEE metadata'sına ilgili tip bilgilerini ekle
            // TIP_RECEIVE transaction'ından pairedTransactionId, TIP_SEND'den senderUserId alınır
            let feeSenderUserId: string | null = null;
            let feeRelatedReceiveTxId: string | null = null;

            const relatedReceiveTx = await prisma.transaction.findFirst({
              where: { txHash: event.transactionHash, actionType: 'TIP_RECEIVE' as unknown as TransactionActionType },
              select: { id: true, metadata: true },
            });
            if (relatedReceiveTx) {
              feeRelatedReceiveTxId = relatedReceiveTx.id;
              const receiveMeta = relatedReceiveTx.metadata as Record<string, unknown> | null;
              feeSenderUserId = (receiveMeta?.senderUserId as string) ?? null;
            }
            if (!feeSenderUserId) {
              const relatedSendTx = await prisma.transaction.findFirst({
                where: { txHash: event.transactionHash, actionType: 'TIP_SEND' as unknown as TransactionActionType },
                select: { metadata: true, walletId: true },
              });
              if (relatedSendTx) {
                const senderWallet = await this.walletRepo.findById(relatedSendTx.walletId);
                feeSenderUserId = senderWallet?.userId ?? null;
              }
            }

            // Aynı txHash ile zaten FEE kaydı var mı kontrol et (duplicate engelle)
            const existingFee = await prisma.transaction.findFirst({
              where: {
                walletId: receiverWalletId,
                actionType: 'FEE' as unknown as TransactionActionType,
                txHash: event.transactionHash,
              },
              select: { id: true },
            });

            if (!existingFee) {
              const feeTx = await prisma.transaction.create({
                data: {
                  walletId: receiverWalletId,
                  actionType: 'FEE' as unknown as TransactionActionType,
                  status: 'confirmed',
                  amount: amount,
                  fromAddress: transferEvent.from,
                  toAddress: transferEvent.to,
                  txHash: event.transactionHash,
                  provider: 'thirdweb',
                  confirmedAt: new Date(),
                  metadata: {
                    source: 'contract_event_v1',
                    chainId: event.chainId,
                    contractAddress: event.contractAddress,
                    blockNumber: event.blockNumber,
                    tokenType: 'ERC20',
                    description: 'Platform fee',
                    senderUserId: feeSenderUserId,
                    pairedTransactionId: feeRelatedReceiveTxId,
                  },
                },
              });
              transactionId = feeTx.id;
              walletId = receiverWalletId;

              logger.info({
                walletId: receiverWalletId,
                transactionId,
                feeAmount: amount,
                feeRecipient: transferEvent.to,
                txHash: event.transactionHash,
                message: 'FEE transaction created on receiver wallet from contract event',
              });
            } else {
              transactionId = existingFee.id;
              logger.debug({
                walletId: receiverWalletId,
                txHash: event.transactionHash,
                message: 'FEE transaction already exists for this txHash, skipping',
              });
            }
          }
        } else {
          // Normal WITHDRAW akışı
          // Cross-source duplicate guard: aynı txHash ile herhangi bir transaction zaten varsa
          // (TIP_SEND, TIP_RECEIVE vb.), bu bir tip transferinin alt-event'idir — WITHDRAW oluşturma.
          const anyExistingByHash = event.transactionHash
            ? await prisma.transaction.findFirst({
                where: { txHash: event.transactionHash },
                select: { id: true, actionType: true },
              })
            : null;

          if (anyExistingByHash) {
            transactionId = anyExistingByHash.id;
            logger.info({
              txHash: event.transactionHash,
              existingActionType: anyExistingByHash.actionType,
              message: 'Contract event (v1): txHash already tracked, skipping WITHDRAW creation',
            });
          }

          // Pending tip guard: wallet'ta pending/created TIP_SEND varsa bu internal tip — WITHDRAW oluşturma
          if (!anyExistingByHash) {
            const pendingTipSend = await prisma.transaction.findFirst({
              where: {
                walletId: fromWallet.id,
                actionType: 'TIP_SEND' as unknown as TransactionActionType,
                status: { in: ['pending', 'created'] as TransactionStatus[] },
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });
            if (pendingTipSend) {
              transactionId = pendingTipSend.id;
              logger.info({
                walletId: fromWallet.id,
                pendingTipSendId: pendingTipSend.id,
                txHash: event.transactionHash,
                message: 'Contract event (v1): pending TIP_SEND found, skipping WITHDRAW creation (internal tip)',
              });
            }
          }

          if (!anyExistingByHash && !transactionId) {
            // Thirdweb WITHDRAW: sadece WITHDRAW action'ından sorumlu; TIP_SEND INTERNAL TRANSFER bölümünde yönetilir
            const pendingTx = await prisma.transaction.findFirst({
              where: {
                walletId: fromWallet.id,
                status: { in: ['pending', 'created'] as TransactionStatus[] },
                actionType: 'WITHDRAW' as unknown as TransactionActionType,
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });

            if (pendingTx) {
              transactionId = pendingTx.id;
              await this.transactionService.confirmTransaction(pendingTx.id, event.transactionHash);
            } else {
              // WITHDRAW transaction oluştur (doğrudan Prisma)
              const withdrawTx = await prisma.transaction.create({
                data: {
                  walletId: fromWallet.id,
                  actionType: 'WITHDRAW' as unknown as TransactionActionType,
                  status: 'confirmed',
                  amount: amount,
                  fromAddress: transferEvent.from,
                  toAddress: transferEvent.to,
                  txHash: event.transactionHash,
                  provider: 'external',
                  confirmedAt: new Date(),
                  metadata: {
                    source: 'contract_event_v1',
                    chainId: event.chainId,
                    contractAddress: event.contractAddress,
                    blockNumber: event.blockNumber,
                    tokenType: 'ERC20',
                  },
                },
              });
              transactionId = withdrawTx.id;

              await this.walletService.updateBalance(fromWallet.id, -amount, {
                reason: `Withdraw to ${transferEvent.to} (tx: ${event.transactionHash})`,
              });
            }
          }

          logger.info({
            walletId, transactionId, amount: -amount,
            to: transferEvent.to,
            message: 'ERC20 Withdraw detected (v1.events)'
          });
        }
      }

      // MINT
      else if (transferEvent.isMint && toWallet) {
        walletId = toWallet.id;
        
        const pendingTx = await prisma.transaction.findFirst({
          where: {
            walletId: toWallet.id,
            status: 'pending',
            actionType: { in: ['CLAIM_REWARD', 'AIRDROP', 'TIP_RECEIVE'] }
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true }
        });

        if (pendingTx) {
          transactionId = pendingTx.id;
          await this.transactionService.confirmTransaction(transactionId, event.transactionHash);
        } else {
          await this.walletService.updateBalance(toWallet.id, amount, {
            reason: `Token mint (tx: ${event.transactionHash})`
          });
        }
      }

      // BURN
      else if (transferEvent.isBurn && fromWallet) {
        walletId = fromWallet.id;
        await this.walletService.updateBalance(fromWallet.id, -amount, {
          reason: `Token burn (tx: ${event.transactionHash})`
        });
      }

      // INTERNAL TRANSFER (tip send: SEND + RECEIVE aynı txHash ile confirm edilir)
      else if (toWallet && fromWallet) {
        walletId = toWallet.id;
        const hash = event.transactionHash?.trim();
        const byTxHash = hash ? await this.transactionRepo.findByTxHash(hash) : [];
        const toConfirm = byTxHash.filter(
          tx => (tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.CREATED)
        );
        if (toConfirm.length > 0) {
          for (const tx of toConfirm) {
            // BUG-17 fix: TIP_RECEIVE amount'u on-chain gercek tutar ile dogrula/guncelle.
            // Contract event'teki amount, fee dusulmus net tutardir (orn. 75).
            // sendTip() fee'yi hesaplayip net tutari RECEIVE'e yazmis olabilir;
            // burada on-chain gercek deger ile dogrulama/duzeltme yapilir.
            if (
              tx.actionType === TransactionActionType.TIP_RECEIVE &&
              amount > 0 &&
              tx.amount !== null &&
              tx.amount !== amount
            ) {
              const existingMeta = (tx.metadata as Record<string, unknown>) || {};
              await prisma.transaction.update({
                where: { id: tx.id },
                data: {
                  amount: amount,
                  metadata: {
                    ...existingMeta,
                    grossAmount: existingMeta.grossAmount ?? tx.amount,
                    feeAmount: typeof existingMeta.grossAmount === 'number'
                      ? existingMeta.grossAmount - amount
                      : (tx.amount ?? 0) - amount,
                    amountCorrectedByContractEvent: true,
                  },
                },
              });
              logger.info({
                transactionId: tx.id,
                oldAmount: tx.amount,
                newAmount: amount,
                txHash: hash,
                message: 'TIP_RECEIVE amount corrected by contract event (on-chain net amount)',
              });
            }
            await this.transactionService.confirmTransaction(tx.id, hash ?? undefined);
            if (!transactionId) transactionId = tx.id;
          }
          logger.info({
            txHash: hash,
            transactionIds: toConfirm.map(t => t.id),
            message: 'Internal transfer (tip) confirmed by txHash via contract event'
          });
        } else {
          const pendingReceiveTx = await prisma.transaction.findFirst({
            where: { walletId: toWallet.id, status: 'pending', actionType: 'TIP_RECEIVE' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, amount: true, metadata: true }
          });
          if (pendingReceiveTx) {
            // BUG-17 fix: pending receive amount duzeltme
            if (
              amount > 0 &&
              pendingReceiveTx.amount !== null &&
              pendingReceiveTx.amount !== amount
            ) {
              const existingMeta = (pendingReceiveTx.metadata as Record<string, unknown>) || {};
              await prisma.transaction.update({
                where: { id: pendingReceiveTx.id },
                data: {
                  amount: amount,
                  metadata: {
                    ...existingMeta,
                    grossAmount: existingMeta.grossAmount ?? pendingReceiveTx.amount,
                    feeAmount: typeof existingMeta.grossAmount === 'number'
                      ? existingMeta.grossAmount - amount
                      : (pendingReceiveTx.amount ?? 0) - amount,
                    amountCorrectedByContractEvent: true,
                  },
                },
              });
            }
            transactionId = pendingReceiveTx.id;
            await this.transactionService.confirmTransaction(transactionId, event.transactionHash);
          }
          const pendingSendTx = await prisma.transaction.findFirst({
            where: { walletId: fromWallet.id, status: 'pending', actionType: 'TIP_SEND' },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
          });
          if (pendingSendTx) {
            if (!transactionId) transactionId = pendingSendTx.id;
            await this.transactionService.confirmTransaction(pendingSendTx.id, event.transactionHash);
          }
        }
      }
    }
    
    // ===== ERC721 NFT TRANSFER =====
    else if (transferEvent.tokenType === TokenType.ERC721 && toWallet) {
      walletId = toWallet.id;
      
      if (transferEvent.isMint) {
        const pendingTx = await prisma.transaction.findFirst({
          where: {
            walletId: toWallet.id,
            status: 'pending',
            actionType: { in: ['CLAIM_BADGE', 'CLAIM_REWARD'] }
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true }
        });

        if (pendingTx) {
          transactionId = pendingTx.id;
          await this.transactionService.confirmTransaction(transactionId, event.transactionHash);
        }
      }
    }

    if (!walletId && fromWallet) {
      walletId = fromWallet.id;
    }

    return { walletId, transactionId, walletIds };
  }

  /**
   * Normalized Approval event handler
   */
  private async handleNormalizedApprovalEvent(
    event: NormalizedContractEvent
  ): Promise<{ walletId?: string }> {
    const approvalEvent = parseApprovalEvent(event.decodedLog, TOKEN_DECIMALS);
    
    if (!approvalEvent) {
      return {};
    }

    const ownerWallet = await this.walletRepo.findByAddressForTracking(approvalEvent.owner);
    
    if (ownerWallet) {
      logger.info({
        walletId: ownerWallet.id,
        spender: approvalEvent.spender,
        value: approvalEvent.value,
        message: 'Token approval detected (v1.events)'
      });

      return { walletId: ownerWallet.id };
    }

    return {};
  }

  /**
   * Tipbox contract'tan feeRecipient adresini okur ve cache'ler.
   * Transfer event'inin fee mi yoksa normal withdraw mı olduğunu belirler.
   */
  private async isFeeRecipientAddress(address: string): Promise<boolean> {
    if (!address) return false;

    // Cache'ten kontrol
    if (cachedFeeRecipient !== null) {
      return address.toLowerCase() === cachedFeeRecipient.toLowerCase();
    }

    // 1. Önce env var'dan oku (en güvenilir kaynak)
    const envFeeRecipient = process.env.FEE_RECIPIENT_ADDRESS;
    if (envFeeRecipient && envFeeRecipient.startsWith('0x')) {
      cachedFeeRecipient = envFeeRecipient.toLowerCase();
      return address.toLowerCase() === cachedFeeRecipient;
    }

    // 2. Fallback: Contract'tan oku
    try {
      const sdk = getThirdwebSdkService();
      if (sdk.isConfigured()) {
        const feeRecipientRaw = await sdk.getFeeRecipient();
        if (feeRecipientRaw) {
          cachedFeeRecipient = feeRecipientRaw.toLowerCase();
          return address.toLowerCase() === cachedFeeRecipient;
        }
      }
    } catch (err) {
      logger.warn({
        error: err instanceof Error ? err.message : String(err),
        message: 'Failed to read feeRecipient from contract; set FEE_RECIPIENT_ADDRESS env var to avoid this',
      });
    }

    return false;
  }

  /**
   * Event Log işleme (Transfer, Mint, Approval vb.)
   *
   * NOT: Sadece sistemde tanımlı wallet'larla ilgili event'ler işlenir.
   * Tanımsız adresler arasındaki transferler atlanır.
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

    // =========================================================================
    // WALLET RELEVANCE CHECK - Sistemde tanımlı wallet var mı?
    // =========================================================================
    const relevanceCheck = await this.checkEventRelevance(data);
    
    if (!relevanceCheck.isRelevant) {
      logger.debug({
        eventName: data.eventName,
        transactionHash: data.transactionHash,
        addresses: relevanceCheck.addresses,
        message: 'Event skipped - no registered wallet involved'
      });
      return {
        success: true,
        action: 'skipped',
        message: 'No registered wallet involved in this event'
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
    let walletIdsToSync: string[] = [];

    // Transfer event'i özel işleme
    if (data.eventName === 'Transfer') {
      const result = await this.handleTransferEvent(data, prisma);
      walletId = result.walletId;
      transactionId = result.transactionId;
      walletIdsToSync = result.walletIds ?? (result.walletId ? [result.walletId] : []);
    }
    
    // Approval event'i özel işleme
    else if (data.eventName === 'Approval') {
      const result = await this.handleApprovalEvent(data);
      walletId = result.walletId;
      walletIdsToSync = result.walletId ? [result.walletId] : [];
    }

    // Event log'u kaydet (sadece relevant event'ler için)
    const eventLog = await this.eventLogRepo.create({
      chainId: data.chainId,
      contractAddress: data.contractAddress,
      blockNumber: data.blockNumber,
      transactionHash: data.transactionHash,
      transactionIndex: data.transactionIndex,
      logIndex: data.logIndex,
      eventName: data.eventName,
      decodedLog: JSON.parse(JSON.stringify(data.decodedLog)),
      topics: data.topics,
      data: data.data,
      timestamp: new Date(data.timestamp),
      rawPayload: JSON.parse(JSON.stringify(payload)),
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

    // Contract'tan balance + pendingTips çekip wallet tablosunu güncelle (gelen veriye göre)
    for (const wid of walletIdsToSync) {
      this.walletService.syncWalletBalanceFromChain(wid).catch((err) => {
        logger.warn({ walletId: wid, error: String(err), message: 'syncWalletBalanceFromChain failed after event' });
      });
    }

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
  // RELEVANCE CHECK
  // ==========================================================================

  /**
   * Event'in sistemdeki wallet'larla ilgili olup olmadığını kontrol eder.
   * Sadece tanımlı wallet'lar için event işlenir.
   */
  private async checkEventRelevance(data: ContractEventPayload['data']): Promise<{
    isRelevant: boolean;
    addresses: string[];
    matchedWallets: string[];
  }> {
    const addresses: string[] = [];
    const matchedWallets: string[] = [];

    // Transfer event kontrolü
    if (data.eventName === 'Transfer') {
      const transferEvent = parseTransferEvent(data.decodedLog, TOKEN_DECIMALS);
      
      if (transferEvent) {
        // 0x0 adresi hariç (mint/burn için geçerli)
        if (transferEvent.from && transferEvent.from !== ZERO_ADDRESS) {
          addresses.push(transferEvent.from.toLowerCase());
        }
        if (transferEvent.to && transferEvent.to !== ZERO_ADDRESS) {
          addresses.push(transferEvent.to.toLowerCase());
        }

        // Wallet eşleştirmesi
        for (const addr of addresses) {
          const wallet = await this.walletRepo.findByAddressForTracking(addr);
          if (wallet) {
            matchedWallets.push(wallet.id);
          }
        }

        // Mint durumunda sadece to adresi kontrol edilir
        if (transferEvent.isMint && transferEvent.to) {
          const toWallet = await this.walletRepo.findByAddressForTracking(transferEvent.to);
          if (toWallet) {
            return { isRelevant: true, addresses, matchedWallets: [toWallet.id] };
          }
        }

        // Burn durumunda sadece from adresi kontrol edilir
        if (transferEvent.isBurn && transferEvent.from) {
          const fromWallet = await this.walletRepo.findByAddressForTracking(transferEvent.from);
          if (fromWallet) {
            return { isRelevant: true, addresses, matchedWallets: [fromWallet.id] };
          }
        }
      }
    }
    
    // Approval event kontrolü
    else if (data.eventName === 'Approval') {
      const approvalEvent = parseApprovalEvent(data.decodedLog, TOKEN_DECIMALS);
      
      if (approvalEvent) {
        addresses.push(approvalEvent.owner.toLowerCase());
        
        const ownerWallet = await this.walletRepo.findByAddressForTracking(approvalEvent.owner);
        if (ownerWallet) {
          return { isRelevant: true, addresses, matchedWallets: [ownerWallet.id] };
        }
      }
    }

    // Herhangi bir wallet eşleşti mi?
    const isRelevant = matchedWallets.length > 0;

    return { isRelevant, addresses, matchedWallets };
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
  ): Promise<{ walletId?: string; transactionId?: string; walletIds?: string[] }> {
    const transferEvent = parseTransferEvent(data.decodedLog, TOKEN_DECIMALS);
    
    if (!transferEvent) {
      return {};
    }

    let walletId: string | undefined;
    let transactionId: string | undefined;
    const walletIds: string[] = [];

    // To address'i wallet ile eşleştir (takip adresi: smart_account_address önce)
    const toWallet = await this.walletRepo.findByAddressForTracking(transferEvent.to);
    const fromWallet = await this.walletRepo.findByAddressForTracking(transferEvent.from);
    if (toWallet?.id) walletIds.push(toWallet.id);
    if (fromWallet?.id && !walletIds.includes(fromWallet.id)) walletIds.push(fromWallet.id);

    // ===== ERC20 TOKEN TRANSFER =====
    if (transferEvent.tokenType === TokenType.ERC20 && transferEvent.value) {
      const amount = weiToToken(transferEvent.value, TOKEN_DECIMALS);
      
      // Minimum transfer kontrolü
      if (!isSignificantTransfer(transferEvent.value, TOKEN_DECIMALS, 0.0001)) {
        logger.debug({
          amount,
          message: 'Insignificant transfer amount, skipping balance update'
        });
        return { walletId: toWallet?.id || fromWallet?.id, walletIds };
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
            reason: `Token mint from contract event (tx: ${data.transactionHash})`
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
          reason: `Token burn from contract event (tx: ${data.transactionHash})`
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
        // ============================================================
        // DEPOSIT: External wallet (Metamask vb.) → TipBox Wallet
        // from: External (sistemde yok), to: TipBox wallet (sistemde var)
        // ============================================================
        if (toWallet && !fromWallet) {
          walletId = toWallet.id;

          // Cross-source duplicate guard: aynı txHash ile herhangi bir transaction zaten varsa skip et
          const anyExistingByHash = data.transactionHash
            ? await prisma.transaction.findFirst({
                where: { txHash: data.transactionHash },
                select: { id: true, actionType: true },
              })
            : null;

          if (anyExistingByHash) {
            transactionId = anyExistingByHash.id;
            logger.info({
              txHash: data.transactionHash,
              existingActionType: anyExistingByHash.actionType,
              message: 'Contract event (legacy): txHash already tracked, skipping DEPOSIT creation',
            });
          } else {
            // Pending receive transaction bul
            const pendingReceiveTx = await prisma.transaction.findFirst({
              where: {
                walletId: toWallet.id,
                status: 'pending',
                actionType: { in: ['TIP_RECEIVE', 'DEPOSIT'] as TransactionActionType[] }
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true }
            });

            if (pendingReceiveTx) {
              // Mevcut pending transaction'ı onayla
              transactionId = pendingReceiveTx.id;
              await this.transactionService.confirmTransaction(transactionId, data.transactionHash);
            } else {
              // DEPOSIT: External wallet'tan gelen transfer için yeni transaction oluştur
              const depositTx = await prisma.transaction.create({
                data: {
                  walletId: toWallet.id,
                  actionType: 'DEPOSIT' as unknown as TransactionActionType,
                  status: 'confirmed',
                  amount: amount,
                  fromAddress: transferEvent.from,
                  toAddress: transferEvent.to,
                  txHash: data.transactionHash,
                  provider: 'external',
                  confirmedAt: new Date(),
                  metadata: {
                    source: 'contract_event',
                    chainId: data.chainId,
                    contractAddress: data.contractAddress,
                    blockNumber: data.blockNumber,
                    tokenType: 'ERC20'
                  }
                }
              });
              transactionId = depositTx.id;

              // Balance güncelle
              await this.walletService.updateBalance(toWallet.id, amount, {
                reason: `Deposit from external wallet ${transferEvent.from} (tx: ${data.transactionHash})`
              });
            }
          }

          logger.info({
            walletId,
            transactionId,
            amount,
            from: transferEvent.from,
            actionType: 'DEPOSIT',
            message: 'ERC20 Token deposit detected'
          });
        }

        // ============================================================
        // WITHDRAW: TipBox Wallet → External wallet
        // from: TipBox wallet (sistemde var), to: External (sistemde yok)
        // ============================================================
        else if (fromWallet && !toWallet) {
          walletId = fromWallet.id;

          // Cross-source duplicate guard: aynı txHash ile herhangi bir transaction zaten varsa skip et
          const anyExistingByHash = data.transactionHash
            ? await prisma.transaction.findFirst({
                where: { txHash: data.transactionHash },
                select: { id: true, actionType: true },
              })
            : null;

          if (anyExistingByHash) {
            transactionId = anyExistingByHash.id;
            logger.info({
              txHash: data.transactionHash,
              existingActionType: anyExistingByHash.actionType,
              message: 'Contract event (legacy): txHash already tracked, skipping WITHDRAW creation',
            });
          } else {
            // Pending send/withdraw transaction bul
            const pendingSendTx = await prisma.transaction.findFirst({
              where: {
                walletId: fromWallet.id,
                status: 'pending',
                actionType: { in: ['TIP_SEND', 'WITHDRAW'] as TransactionActionType[] }
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true }
            });

            if (pendingSendTx) {
              transactionId = pendingSendTx.id;
              await this.transactionService.confirmTransaction(pendingSendTx.id, data.transactionHash);
            } else {
              // WITHDRAW: External wallet'a gönderilen transfer için yeni transaction oluştur
              const withdrawTx = await prisma.transaction.create({
                data: {
                  walletId: fromWallet.id,
                  actionType: 'WITHDRAW' as unknown as TransactionActionType,
                  status: 'confirmed',
                  amount: amount,
                  fromAddress: transferEvent.from,
                  toAddress: transferEvent.to,
                  txHash: data.transactionHash,
                  provider: 'external',
                  confirmedAt: new Date(),
                  metadata: {
                    source: 'contract_event',
                    chainId: data.chainId,
                    contractAddress: data.contractAddress,
                    blockNumber: data.blockNumber,
                    tokenType: 'ERC20'
                  }
                }
              });
              transactionId = withdrawTx.id;

              // Balance zaten blockchain'de düşmüş, burada da güncelle
              await this.walletService.updateBalance(fromWallet.id, -amount, {
                reason: `Withdraw to external wallet ${transferEvent.to} (tx: ${data.transactionHash})`
              });
            }
          }

          logger.info({
            walletId,
            transactionId,
            amount: -amount,
            to: transferEvent.to,
            actionType: 'WITHDRAW',
            message: 'ERC20 Token withdraw detected'
          });
        }

        // ============================================================
        // INTERNAL TRANSFER: TipBox Wallet → TipBox Wallet (tip send)
        // SEND + RECEIVE aynı txHash ile confirm edilir
        // ============================================================
        else if (toWallet && fromWallet) {
          walletId = toWallet.id;
          const hash = data.transactionHash?.trim();
          const byTxHash = hash ? await this.transactionRepo.findByTxHash(hash) : [];
          const toConfirm = byTxHash.filter(
            tx => (tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.CREATED)
          );
          if (toConfirm.length > 0) {
            for (const tx of toConfirm) {
              await this.transactionService.confirmTransaction(tx.id, hash ?? undefined);
              if (!transactionId) transactionId = tx.id;
            }
            logger.info({
              txHash: hash,
              transactionIds: toConfirm.map(t => t.id),
              fromWalletId: fromWallet.id,
              toWalletId: toWallet.id,
              amount,
              message: 'ERC20 Internal transfer (tip) confirmed by txHash via contract event'
            });
          } else {
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
            }
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
            logger.info({
              fromWalletId: fromWallet.id,
              toWalletId: toWallet.id,
              amount,
              message: 'ERC20 Internal transfer detected (fallback by pending)'
            });
          }
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

    return { walletId, transactionId, walletIds };
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

    // Owner wallet'ı bul (takip adresi: smart_account_address önce)
    const ownerWallet = await this.walletRepo.findByAddressForTracking(approvalEvent.owner);
    
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
      const wallet = await this.walletRepo.findByAddressForTracking(data.to);
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
    // contractEventLog model exists in schema but may not be in generated client yet
    // Use $queryRawUnsafe as a safe fallback until prisma generate is run
    const prisma = getPrisma();
    const result = await prisma.$queryRawUnsafe<Array<{ total: bigint; processed: bigint; unprocessed: bigint }>>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = true) as processed,
        COUNT(*) FILTER (WHERE processed = false) as unprocessed
      FROM contract_event_logs`
    );
    const row = result[0] || { total: 0n, processed: 0n, unprocessed: 0n };

    return {
      total: Number(row.total),
      processed: Number(row.processed),
      unprocessed: Number(row.unprocessed),
    };
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
          const transferEvent = parseTransferEvent(event.decodedLog as unknown as Record<string, DecodedLogValue>);
          
          if (transferEvent) {
            const toWallet = await this.walletRepo.findByAddressForTracking(transferEvent.to);
            
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
