/**
 * Transaction Notification Service
 *
 * Transaction'a ait bildirimleri webhook/confirm akışı üzerinden kaydeder.
 * sendTip, buyNFT, claimReward vb. işlemlerden doğrudan bildirim gönderilmez;
 * confirmTransaction / failTransaction çağrıldığında bu servis tetiklenir.
 *
 * Wallet→wallet transfer sınıflandırması (contract-event / webhook tarafında):
 * - İki adres de DB'de kayıtlı → TIP_SEND + TIP_RECEIVE (notification gönderilir)
 * - Gönderen DB'de, alıcı değil → WITHDRAW (sadece transaction; notification yok)
 * - Gönderen DB'de değil, alıcı DB'de → DEPOSIT (sadece transaction; notification yok)
 */

import { Transaction } from '../../domain/transaction/transaction.entity';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { NFTPrismaRepository } from '../../infrastructure/repositories/nft-prisma.repository';
import logger from '../../infrastructure/logger/logger';

export class TransactionNotificationService {
  constructor(
    private readonly notificationService = new NotificationService(),
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly profileRepo = new ProfilePrismaRepository(),
    private readonly nftRepo = new NFTPrismaRepository()
  ) {}

  /**
   * Transaction confirm edildiğinde çağrılır.
   * actionType'a göre uygun notification kaydı oluşturur (tips, transfer, deposit, withdraw, NFT, reward vb.).
   */
  async sendTransactionConfirmedNotification(transaction: Transaction): Promise<void> {
    if (transaction.status !== TransactionStatus.CONFIRMED) {
      return;
    }

    const wallet = await this.walletRepo.findById(transaction.walletId);
    if (!wallet) {
      logger.warn({ transactionId: transaction.id, message: 'Wallet not found for transaction notification' });
      return;
    }

    const userId = wallet.userId;
    const metadata = transaction.metadata || {};
    const amount = transaction.amount ?? 0;

    try {
      switch (transaction.actionType) {
        case TransactionActionType.TIP_SEND: {
          const recipientUserId = metadata.recipientUserId as string | undefined;
          const toProfile = recipientUserId
            ? await this.profileRepo.findByUserId(recipientUserId)
            : null;
          const recipientName = toProfile?.displayName || toProfile?.userName || 'Kullanıcı';
          await this.notificationService.sendNotification(userId, NotificationType.TIPS_SENT, {
            amount,
            recipientUserId: recipientUserId ?? null,
            recipientName,
            transactionId: transaction.id,
          });
          break;
        }

        case TransactionActionType.TIP_RECEIVE: {
          const senderUserId = metadata.senderUserId as string | undefined;
          const fromProfile = senderUserId
            ? await this.profileRepo.findByUserId(senderUserId)
            : null;
          await this.notificationService.sendNotification(userId, NotificationType.TIPS_RECEIVED, {
            amount,
            senderUserId: senderUserId ?? null,
            senderUsername: fromProfile?.userName || fromProfile?.displayName || null,
            transactionId: transaction.id,
          });
          break;
        }

        case TransactionActionType.CLAIM_REWARD: {
          await this.notificationService.sendNotification(userId, NotificationType.REWARD_CLAIMED, {
            amount,
            rewardType: metadata.rewardType ?? 'LADDER',
            rewardId: metadata.rewardId ?? null,
            transactionId: transaction.id,
          });
          break;
        }

        case TransactionActionType.NFT_BUY: {
          const nftId = metadata.nftId as string | undefined;
          const sellerId = metadata.sellerId as string | undefined;
          const nft = nftId ? await this.nftRepo.findById(nftId) : null;
          const sellerProfile = sellerId ? await this.profileRepo.findByUserId(sellerId) : null;
          await this.notificationService.sendNotification(userId, NotificationType.NFT_PURCHASED, {
            nftId: nftId ?? null,
            nftName: nft?.name ?? 'NFT',
            price: amount,
            sellerName: sellerProfile?.displayName || sellerProfile?.userName || 'Kullanıcı',
            sellerId: sellerId ?? null,
            transactionId: transaction.id,
          });
          break;
        }

        case TransactionActionType.NFT_SELL: {
          const nftId = metadata.nftId as string | undefined;
          const buyerId = metadata.buyerId as string | undefined;
          const gasFee = (metadata.gasFee as number) ?? 0;
          const nft = nftId ? await this.nftRepo.findById(nftId) : null;
          const buyerProfile = buyerId ? await this.profileRepo.findByUserId(buyerId) : null;
          await this.notificationService.sendNotification(userId, NotificationType.NFT_LISTING_SOLD, {
            nftId: nftId ?? null,
            nftName: nft?.name ?? 'NFT',
            price: amount + gasFee,
            receivedAmount: amount,
            buyerName: buyerProfile?.displayName || buyerProfile?.userName || 'Kullanıcı',
            buyerId: buyerId ?? null,
            transactionId: transaction.id,
            gasFee,
          });
          break;
        }

        case TransactionActionType.DEPOSIT:
        case TransactionActionType.WITHDRAW:
          // Wallet→wallet: biri DB'de değilse sadece transaction yazılır; notification tablosuna yazılmaz
          break;

        case TransactionActionType.SWAP_TIP_TO_SOL:
        case TransactionActionType.SWAP_SOL_TO_TIP:
        case TransactionActionType.AIRDROP:
        case TransactionActionType.FEE:
        case TransactionActionType.CLAIM_BADGE: {
          await this.notificationService.sendNotification(userId, NotificationType.TRANSACTION_CONFIRMED, {
            amount,
            actionType: transaction.actionType,
            transactionId: transaction.id,
          });
          break;
        }

        default:
          logger.debug({
            transactionId: transaction.id,
            actionType: transaction.actionType,
            message: 'No notification mapping for transaction action type',
          });
      }
    } catch (error) {
      logger.error({
        transactionId: transaction.id,
        userId,
        actionType: transaction.actionType,
        error: error instanceof Error ? error.message : String(error),
        message: 'Error sending transaction confirmed notification',
      });
    }
  }

  /**
   * Transaction fail olduğunda çağrılır.
   * DEPOSIT ve WITHDRAW için notification gönderilmez (sadece transaction kaydı).
   */
  async sendTransactionFailedNotification(
    transaction: Transaction,
    errorMessage: string
  ): Promise<void> {
    if (
      transaction.actionType === TransactionActionType.DEPOSIT ||
      transaction.actionType === TransactionActionType.WITHDRAW
    ) {
      return;
    }

    const wallet = await this.walletRepo.findById(transaction.walletId);
    if (!wallet) {
      logger.warn({ transactionId: transaction.id, message: 'Wallet not found for failed notification' });
      return;
    }

    try {
      await this.notificationService.sendNotification(
        wallet.userId,
        NotificationType.TRANSACTION_FAILED,
        {
          transactionId: transaction.id,
          amount: transaction.amount ?? 0,
          actionType: transaction.actionType,
          errorMessage,
        }
      );
    } catch (error) {
      logger.error({
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
        message: 'Error sending transaction failed notification',
      });
    }
  }
}
