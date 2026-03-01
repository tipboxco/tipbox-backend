/**
 * Alchemy Notify Webhook Service
 *
 * Alchemy'den gelen webhook isteklerini doğrular ve işler.
 * Signature: HMAC SHA256(signingKey, rawBody) -> hex, header: X-Alchemy-Signature
 *
 * Graph formatında gelen block.logs (ERC20 Transfer) ile EOA ↔ smart wallet
 * transferlerini dinler; DEPOSIT / WITHDRAW transaction ve balance güncellemesi yapar.
 *
 * @see https://docs.alchemy.com/reference/notify-api-quickstart
 */

import crypto from 'crypto';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction-prisma.repository';
import { ContractEventLogPrismaRepository } from '../../infrastructure/repositories/contract-event-log-prisma.repository';
import { TransactionService } from '../transaction/transaction.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import type {
  AlchemyWebhookPayload,
  AlchemyParsedTransfer,
  AlchemyGraphBlock,
  AlchemyGraphLog,
} from '../../interfaces/alchemy-webhook/alchemy-webhook.dto';
import {
  hasAlchemyGraphBlock,
  getAlchemyGraphBlock,
  parseAlchemyGraphTransferLog,
} from '../../interfaces/alchemy-webhook/alchemy-webhook.dto';
import { CONTRACT_ADDRESSES } from '../../infrastructure/config/web3-config/contracts.config';
import { CHAIN_CONFIG } from '../../infrastructure/config/web3-config/chain.config';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionActionType as PrismaTransactionActionType } from '@prisma/client';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import logger from '../../infrastructure/logger/logger';

const TIPS_TOKEN_DECIMALS = parseInt(process.env.TIPS_TOKEN_DECIMALS || '18', 10);
const MIN_TRANSFER_AMOUNT = 0.0001;

function weiToToken(weiValue: string, decimals: number = 18): number {
  try {
    return parseFloat(weiValue) / Math.pow(10, decimals);
  } catch {
    return 0;
  }
}

function isSignificantTransfer(value: string, decimals: number = 18, minAmount: number = 0.0001): boolean {
  return weiToToken(value, decimals) >= minAmount;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class AlchemyWebhookService {
  private signingKey: string;
  private readonly walletRepo = new WalletPrismaRepository();
  private readonly profileRepo = new ProfilePrismaRepository();
  private readonly transactionRepo = new TransactionPrismaRepository();
  private readonly eventLogRepo = new ContractEventLogPrismaRepository();
  private readonly transactionService = new TransactionService();
  private readonly walletService = new WalletService();
  private readonly notificationService = new NotificationService();

  constructor() {
    this.signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY || '';
    if (!this.signingKey) {
      const env = process.env.NODE_ENV || 'development';
      if (env === 'production') {
        logger.warn('ALCHEMY_WEBHOOK_SIGNING_KEY is not set. Alchemy webhook signature verification will fail.');
      } else {
        logger.debug('ALCHEMY_WEBHOOK_SIGNING_KEY is not set (skipped in development).');
      }
    }
  }

  /**
   * Alchemy signature doğrulama: HMAC SHA256(signingKey, body) -> hex
   * Body raw string olmalı (JSON parse edilmiş değil).
   */
  verifySignature(body: string, signature: string, signingKey?: string): boolean {
    const key = signingKey ?? this.signingKey;
    if (!key) {
      logger.error('Alchemy webhook: signing key not configured');
      return false;
    }
    try {
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(body, 'utf8');
      const digest = hmac.digest('hex');
      if (signature.length !== digest.length) {
        return false;
      }
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch (err) {
      logger.warn({ error: String(err), message: 'Alchemy webhook signature verification error' });
      return false;
    }
  }

  /**
   * Webhook payload'ını işler.
   * Graph block.logs varsa ERC20 Transfer'leri işleyip DEPOSIT/WITHDRAW ve balance günceller.
   */
  async processWebhook(payload: AlchemyWebhookPayload): Promise<{ success: boolean; message: string }> {
    if (hasAlchemyGraphBlock(payload)) {
      const block = getAlchemyGraphBlock(payload);
      if (block) {
        const result = await this.processBlockLogs(block);
        logger.info({
          message: 'Alchemy webhook graph block processed',
          webhookId: payload.webhookId,
          blockNumber: block.number,
          logsProcessed: result.processed,
          logsSkipped: result.skipped,
        });
        return { success: true, message: `Processed ${result.processed} transfer(s)` };
      }
    }

    logger.info({
      message: 'Alchemy webhook processed',
      webhookId: payload.webhookId,
      id: payload.id,
      type: payload.type,
      eventKeys: payload.event && typeof payload.event === 'object' ? Object.keys(payload.event) : undefined,
      activityLength: (payload.event as { activity?: unknown[] })?.activity?.length,
    });
    return { success: true, message: 'Webhook received' };
  }

  /**
   * Graph formatındaki block.logs içinden ERC20 Transfer'leri işler.
   * EOA → smart wallet = DEPOSIT, smart wallet → EOA = WITHDRAW.
   */
  private async processBlockLogs(block: AlchemyGraphBlock): Promise<{ processed: number; skipped: number }> {
    const logs = block.logs ?? [];
    const tipsToken = CONTRACT_ADDRESSES.tipsToken.toLowerCase();
    const chainId = CHAIN_CONFIG.chainId;
    const blockTimestamp = block.timestamp != null
      ? new Date(typeof block.timestamp === 'number' ? block.timestamp * 1000 : parseInt(String(block.timestamp), 10) * 1000)
      : new Date();
    let processed = 0;
    let skipped = 0;

    for (const log of logs) {
      const transfer = parseAlchemyGraphTransferLog(log as AlchemyGraphLog, CONTRACT_ADDRESSES.tipsToken);
      if (!transfer) {
        skipped++;
        continue;
      }

      if (!isSignificantTransfer(transfer.value, TIPS_TOKEN_DECIMALS, MIN_TRANSFER_AMOUNT)) {
        skipped++;
        continue;
      }

      const existing = await this.eventLogRepo.findByHashAndLogIndex(transfer.transactionHash, transfer.logIndex);
      if (existing) {
        skipped++;
        continue;
      }

      const fromWallet = await this.walletRepo.findByAddressForTracking(transfer.from);
      const toWallet = await this.walletRepo.findByAddressForTracking(transfer.to);
      const isMint = transfer.from.toLowerCase() === ZERO_ADDRESS;
      const isBurn = transfer.to.toLowerCase() === ZERO_ADDRESS;
      const amount = weiToToken(transfer.value, TIPS_TOKEN_DECIMALS);
      const prisma = getPrisma();

      // DEPOSIT: EOA → smart wallet (bizim wallet)
      if (toWallet && !fromWallet && !isMint) {
        const pendingTx = await prisma.transaction.findFirst({
          where: {
            walletId: toWallet.id,
            status: TransactionStatus.PENDING,
            actionType: { in: [TransactionActionType.TIP_RECEIVE, TransactionActionType.DEPOSIT as string as PrismaTransactionActionType] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });

        let depositTransactionId: string;
        if (pendingTx) {
          await this.transactionService.confirmTransaction(pendingTx.id, transfer.transactionHash);
          depositTransactionId = pendingTx.id;
        } else {
          const depositTx = await prisma.transaction.create({
            data: {
              walletId: toWallet.id,
              actionType: TransactionActionType.DEPOSIT as string as PrismaTransactionActionType,
              status: TransactionStatus.CONFIRMED,
              amount,
              fromAddress: transfer.from,
              toAddress: transfer.to,
              txHash: transfer.transactionHash,
              provider: 'external',
              confirmedAt: new Date(),
              metadata: {
                source: 'alchemy_webhook',
                chainId,
                contractAddress: transfer.contractAddress,
                blockNumber: block.number ?? undefined,
                tokenType: 'ERC20',
              },
            },
          });
          depositTransactionId = depositTx.id;
          await this.walletService.updateBalance(toWallet.id, amount, {
            reason: `Deposit from ${transfer.from} (tx: ${transfer.transactionHash})`,
          });
        }

        // To wallet sahibine deposit bildirimi: fromAddress (UI), gönderen sistemdeyse avatar + senderUsername
        const fromWalletForAvatar = await this.walletRepo.findByAddressForTracking(transfer.from);
        const fromProfile = fromWalletForAvatar
          ? await this.profileRepo.findByUserId(fromWalletForAvatar.userId)
          : null;
        this.notificationService
          .sendNotification(toWallet.userId, NotificationType.TRANSACTION_CONFIRMED, {
            amount,
            actionType: TransactionActionType.DEPOSIT,
            transactionId: depositTransactionId,
            fromAddress: transfer.from,
            ...(fromWalletForAvatar && {
              senderUserId: fromWalletForAvatar.userId,
              senderUsername: fromProfile?.userName || fromProfile?.displayName || null,
            }),
          })
          .catch((err) => {
            logger.warn({
              userId: toWallet.userId,
              transactionId: depositTransactionId,
              error: String(err),
              message: 'Alchemy DEPOSIT notification failed',
            });
          });

        await this.upsertEventLog(transfer, block, blockTimestamp, toWallet.id, chainId);
        processed++;
        logger.info({
          walletId: toWallet.id,
          from: transfer.from,
          to: transfer.to,
          amount,
          txHash: transfer.transactionHash,
          message: 'Alchemy: ERC20 DEPOSIT (EOA → smart wallet)',
        });
        continue;
      }

      // WITHDRAW: smart wallet → EOA
      if (fromWallet && !toWallet && !isBurn) {
        const pendingTx = await prisma.transaction.findFirst({
          where: {
            walletId: fromWallet.id,
            status: TransactionStatus.PENDING,
            actionType: { in: [TransactionActionType.TIP_SEND, TransactionActionType.WITHDRAW as string as PrismaTransactionActionType] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });

        if (pendingTx) {
          await this.transactionService.confirmTransaction(pendingTx.id, transfer.transactionHash);
        } else {
          await prisma.transaction.create({
            data: {
              walletId: fromWallet.id,
              actionType: TransactionActionType.WITHDRAW as string as PrismaTransactionActionType,
              status: TransactionStatus.CONFIRMED,
              amount,
              fromAddress: transfer.from,
              toAddress: transfer.to,
              txHash: transfer.transactionHash,
              provider: 'external',
              confirmedAt: new Date(),
              metadata: {
                source: 'alchemy_webhook',
                chainId,
                contractAddress: transfer.contractAddress,
                blockNumber: block.number ?? undefined,
                tokenType: 'ERC20',
              },
            },
          });
          await this.walletService.updateBalance(fromWallet.id, -amount, {
            reason: `Withdraw to ${transfer.to} (tx: ${transfer.transactionHash})`,
          });
        }
        await this.upsertEventLog(transfer, block, blockTimestamp, fromWallet.id, chainId);
        processed++;
        logger.info({
          walletId: fromWallet.id,
          from: transfer.from,
          to: transfer.to,
          amount,
          txHash: transfer.transactionHash,
          message: 'Alchemy: ERC20 WITHDRAW (smart wallet → EOA)',
        });
        continue;
      }

      // İç transfer (tip): her iki taraf da bizim wallet
      if (fromWallet && toWallet) {
        const byTxHash = await this.transactionRepo.findByTxHash(transfer.transactionHash);
        const toConfirm = byTxHash.filter(
          (tx) => tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.CREATED
        );
        for (const tx of toConfirm) {
          await this.transactionService.confirmTransaction(tx.id, transfer.transactionHash);
        }
        await this.upsertEventLog(transfer, block, blockTimestamp, undefined, chainId);
        processed++;
        logger.info({
          txHash: transfer.transactionHash,
          message: 'Alchemy: internal transfer (tip) confirmed by txHash',
        });
        continue;
      }

      skipped++;
    }

    return { processed, skipped };
  }

  private async upsertEventLog(
    transfer: AlchemyParsedTransfer,
    block: AlchemyGraphBlock,
    blockTimestamp: Date,
    walletId: string | undefined,
    chainId: number
  ): Promise<void> {
    await this.eventLogRepo.create({
      chainId,
      contractAddress: transfer.contractAddress,
      blockNumber: typeof block.number === 'number' ? block.number : parseInt(String(block.number ?? '0'), 10),
      transactionHash: transfer.transactionHash,
      transactionIndex: 0,
      logIndex: transfer.logIndex,
      eventName: 'Transfer',
      decodedLog: {
        from: { type: 'address', value: transfer.from },
        to: { type: 'address', value: transfer.to },
        value: { type: 'uint256', value: transfer.value },
      },
      topics: [],
      data: null,
      timestamp: blockTimestamp,
      rawPayload: JSON.parse(JSON.stringify({ source: 'alchemy_webhook', transfer, blockNumber: block.number ?? null })),
      walletId: walletId ?? null,
      processed: true,
    });
  }
}
