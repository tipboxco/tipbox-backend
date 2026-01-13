import { Transaction } from '../../domain/transaction/transaction.entity';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction-prisma.repository';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { NFTPrismaRepository } from '../../infrastructure/repositories/nft-prisma.repository';
import { NFTTransactionPrismaRepository } from '../../infrastructure/repositories/nft-transaction-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { ValidationError, NotFoundError } from '../../infrastructure/errors/custom-errors';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NFTTransactionType } from '../../domain/crypto/nft-transaction-type.enum';
import { WalletService } from '../wallet/wallet.service';
import logger from '../../infrastructure/logger/logger';

export interface SendTipRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason?: string;
}

export interface TransactionHistoryOptions {
  cursor?: string;
  limit?: number;
}

export interface GroupedTransactions {
  today: Transaction[];
  yesterday: Transaction[];
  lastWeek: Transaction[];
  lastMonth: Transaction[];
  older: Transaction[];
}

export class TransactionService {
  constructor(
    private readonly transactionRepo = new TransactionPrismaRepository(),
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly nftRepo = new NFTPrismaRepository(),
    private readonly nftTransactionRepo = new NFTTransactionPrismaRepository(),
    private readonly notificationService = new NotificationService(),
    private readonly profileRepo = new ProfilePrismaRepository(),
    private readonly walletService = new WalletService()
  ) {}

  /**
   * TIPS gönderme işlemi
   * - Bakiye kontrolü yapar
   * - İki transaction oluşturur (SEND ve RECEIVE)
   * - İşlemleri pending durumuna getirir
   */
  async sendTip(request: SendTipRequest): Promise<{ transaction: Transaction }> {
    // Validation
    if (request.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0');
    }

    if (request.fromUserId === request.toUserId) {
      throw new ValidationError('Cannot send tips to yourself');
    }

    // Get wallets
    const fromWallet = await this.walletRepo.findActiveByUserId(request.fromUserId);
    if (!fromWallet) {
      throw new NotFoundError('Sender wallet not found');
    }

    const toWallet = await this.walletRepo.findActiveByUserId(request.toUserId);
    if (!toWallet) {
      throw new NotFoundError('Recipient wallet not found');
    }

    // Check balance - artık DB'den okuyoruz
    if (!fromWallet.hasBalance(request.amount)) {
      throw new ValidationError(
        `Insufficient balance. Available: ${fromWallet.getAvailableBalance()} TIPS`
      );
    }

    // Get user profiles for notifications
    const [fromProfile, toProfile] = await Promise.all([
      this.profileRepo.findByUserId(request.fromUserId),
      this.profileRepo.findByUserId(request.toUserId),
    ]);

    // Create SEND transaction
    const sendTransaction = await this.transactionRepo.create({
      walletId: fromWallet.id,
      actionType: TransactionActionType.TIP_SEND,
      amount: request.amount,
      fromAddress: fromWallet.publicAddress,
      toAddress: toWallet.publicAddress,
      metadata: {
        reason: request.reason || null,
        recipientUserId: request.toUserId
      },
      provider: 'backend'
    });

    // Create RECEIVE transaction
    const receiveTransaction = await this.transactionRepo.create({
      walletId: toWallet.id,
      actionType: TransactionActionType.TIP_RECEIVE,
      amount: request.amount,
      fromAddress: fromWallet.publicAddress,
      toAddress: toWallet.publicAddress,
      metadata: {
        reason: request.reason || null,
        senderUserId: request.fromUserId,
        linkedTransactionId: sendTransaction.id
      },
      provider: 'backend'
    });

    // Confirm transactions immediately (update balances)
    await Promise.all([
      this.confirmTransaction(sendTransaction.id),
      this.confirmTransaction(receiveTransaction.id)
    ]);

    logger.info(`Tip sent: ${request.amount} TIPS from ${request.fromUserId} to ${request.toUserId}`);

    // Send notifications asynchronously
    Promise.all([
      // Notify sender
      this.notificationService.sendNotification(
        request.fromUserId,
        NotificationType.TIPS_SENT,
        {
          amount: request.amount,
          recipientName: toProfile?.displayName || toProfile?.userName || 'Kullanıcı',
          recipientUserId: request.toUserId,
          transactionId: sendTransaction.id,
          reason: request.reason,
        }
      ),
      // Notify recipient
      this.notificationService.sendNotification(
        request.toUserId,
        NotificationType.TIPS_RECEIVED,
        {
          amount: request.amount,
          senderName: fromProfile?.displayName || fromProfile?.userName || 'Kullanıcı',
          senderUserId: request.fromUserId,
          transactionId: sendTransaction.id,
          reason: request.reason,
        }
      ),
    ]).catch(error => {
      logger.error('Error sending tip notifications:', error);
    });

    return { transaction: sendTransaction };
  }

  /**
   * Transaction durumunu getir
   */
  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(id);
    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }
    return transaction;
  }

  /**
   * Kullanıcının transaction geçmişi
   * - Pagination desteği
   * - Cursor-based
   */
  async getUserTransactionHistory(
    userId: string,
    options?: TransactionHistoryOptions
  ): Promise<{ items: Transaction[]; cursor?: string; hasMore: boolean }> {
    const wallet = await this.walletRepo.findActiveByUserId(userId);
    if (!wallet) {
      return { items: [], hasMore: false };
    }

    const result = await this.transactionRepo.findByFilters(
      { userId },
      { cursor: options?.cursor, limit: options?.limit || 20 }
    );

    return {
      items: result.items,
      cursor: result.nextCursor,
      hasMore: !!result.nextCursor
    };
  }

  /**
   * Transaction geçmişini gruplara ayırır (today, yesterday, etc.)
   */
  async getUserTransactionHistoryGrouped(userId: string): Promise<GroupedTransactions> {
    const wallet = await this.walletRepo.findActiveByUserId(userId);
    if (!wallet) {
      return {
        today: [],
        yesterday: [],
        lastWeek: [],
        lastMonth: [],
        older: []
      };
    }

    const allTransactions = await this.transactionRepo.findByFilters(
      { userId, status: TransactionStatus.CONFIRMED },
      { limit: 100 }
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const grouped: GroupedTransactions = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: []
    };

    for (const tx of allTransactions.items) {
      const txDate = new Date(tx.createdAt);

      if (txDate >= today) {
        grouped.today.push(tx);
      } else if (txDate >= yesterday && txDate < today) {
        grouped.yesterday.push(tx);
      } else if (txDate >= lastWeek && txDate < yesterday) {
        grouped.lastWeek.push(tx);
      } else if (txDate >= lastMonth && txDate < lastWeek) {
        grouped.lastMonth.push(tx);
      } else {
        grouped.older.push(tx);
      }
    }

    return grouped;
  }

  /**
   * Kullanıcının wallet balance'ını hesapla
   * @deprecated Artık DB'de tutuyoruz, WalletService.getUserBalance() kullanın
   */
  async getUserBalance(userId: string): Promise<number> {
    const wallet = await this.walletRepo.findActiveByUserId(userId);
    if (!wallet) {
      return 0;
    }

    return wallet.balance;
  }

  /**
   * Transaction confirm edildiğinde balance'ı güncelle
   * Bu method transaction worker tarafından çağrılır
   */
  async confirmTransaction(
    transactionId: string,
    txHash?: string
  ): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.status === TransactionStatus.CONFIRMED) {
      logger.warn(`Transaction ${transactionId} already confirmed`);
      return transaction;
    }

    if (!transaction.amount) {
      logger.warn(`Transaction ${transactionId} has no amount, skipping balance update`);
      await this.transactionRepo.updateStatus(transactionId, TransactionStatus.CONFIRMED, { txHash });
      return (await this.transactionRepo.findById(transactionId))!;
    }

    // Transaction type'a göre balance'ı güncelle
    const isReceive = [
      TransactionActionType.TIP_RECEIVE,
      TransactionActionType.CLAIM_REWARD,
      TransactionActionType.CLAIM_BADGE,
      TransactionActionType.NFT_SELL,
      TransactionActionType.SWAP_SOL_TO_TIP,
      TransactionActionType.AIRDROP,
    ].includes(transaction.actionType);

    const isSend = [
      TransactionActionType.TIP_SEND,
      TransactionActionType.NFT_BUY,
      TransactionActionType.SWAP_TIP_TO_SOL,
      TransactionActionType.FEE,
    ].includes(transaction.actionType);

    // Balance'ı güncelle
    if (isReceive) {
      await this.walletService.updateBalance(
        transaction.walletId,
        transaction.amount,
        {
          reason: `Transaction confirmed: ${transaction.actionType}`,
          transactionId: transaction.id,
        }
      );
      logger.info({
        transactionId: transaction.id,
        walletId: transaction.walletId,
        amount: transaction.amount,
        actionType: transaction.actionType,
        message: 'Balance increased (RECEIVE transaction)',
      });
    } else if (isSend) {
      await this.walletService.updateBalance(
        transaction.walletId,
        -transaction.amount,
        {
          reason: `Transaction confirmed: ${transaction.actionType}`,
          transactionId: transaction.id,
        }
      );
      logger.info({
        transactionId: transaction.id,
        walletId: transaction.walletId,
        amount: -transaction.amount,
        actionType: transaction.actionType,
        message: 'Balance decreased (SEND transaction)',
      });
    }

    // Transaction'ı confirm et
    const confirmedTx = await this.transactionRepo.updateStatus(
      transactionId,
      TransactionStatus.CONFIRMED,
      { txHash }
    );

    if (!confirmedTx) {
      throw new Error('Failed to confirm transaction');
    }

    return confirmedTx;
  }

  /**
   * Transaction fail olduğunda (rollback için)
   */
  async failTransaction(
    transactionId: string,
    errorMessage: string
  ): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    logger.error({
      transactionId,
      errorMessage,
      message: 'Transaction failed',
    });

    const failedTx = await this.transactionRepo.updateStatus(
      transactionId,
      TransactionStatus.FAILED,
      { errorMessage }
    );

    if (!failedTx) {
      throw new Error('Failed to mark transaction as failed');
    }

    return failedTx;
  }

  /**
   * Reward claim işlemi
   */
  async claimReward(
    userId: string,
    rewardId: string,
    amount: number,
    rewardType: 'LADDER' | 'BADGE' | 'SUPPORT'
  ): Promise<Transaction> {
    const wallet = await this.walletRepo.findActiveByUserId(userId);
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const transaction = await this.transactionRepo.create({
      walletId: wallet.id,
      actionType: TransactionActionType.CLAIM_REWARD,
      amount,
      fromAddress: null,
      toAddress: wallet.publicAddress,
      metadata: {
        rewardId,
        rewardType
      },
      provider: 'backend'
    });

    // Confirm transaction immediately (update balance)
    await this.confirmTransaction(transaction.id);

    logger.info(`Reward claimed: ${amount} TIPS for user ${userId}`);

    // Send notification asynchronously
    this.notificationService.sendNotification(
      userId,
      NotificationType.REWARD_CLAIMED,
      {
        amount,
        rewardType,
        rewardId,
        transactionId: transaction.id,
      }
    ).catch(error => {
      logger.error('Error sending reward claim notification:', error);
    });

    return transaction;
  }

  /**
   * NFT satın alma işlemi
   */
  async buyNFT(
    userId: string,
    nftId: string,
    price: number,
    sellerId: string
  ): Promise<{ buyTransaction: Transaction; sellTransaction: Transaction }> {
    const buyerWallet = await this.walletRepo.findActiveByUserId(userId);
    if (!buyerWallet) {
      throw new NotFoundError('Buyer wallet not found');
    }

    const sellerWallet = await this.walletRepo.findActiveByUserId(sellerId);
    if (!sellerWallet) {
      throw new NotFoundError('Seller wallet not found');
    }

    // Check balance - artık DB'den okuyoruz
    if (!buyerWallet.hasBalance(price)) {
      throw new ValidationError(
        `Insufficient balance. Available: ${buyerWallet.getAvailableBalance()} TIPS`
      );
    }

    // Get NFT details for notifications
    const nft = await this.nftRepo.findById(nftId);
    if (!nft) {
      throw new NotFoundError('NFT not found');
    }

    // Get user profiles for notifications
    const [buyerProfile, sellerProfile] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.profileRepo.findByUserId(sellerId),
    ]);

    // Create BUY transaction
    const buyTransaction = await this.transactionRepo.create({
      walletId: buyerWallet.id,
      actionType: TransactionActionType.NFT_BUY,
      amount: price,
      fromAddress: buyerWallet.publicAddress,
      toAddress: sellerWallet.publicAddress,
      metadata: { nftId, sellerId },
      provider: 'backend'
    });

    // Create SELL transaction (gas fee deducted)
    const gasFee = Math.max(1, price * 0.05);
    const sellerReceives = price - gasFee;

    const sellTransaction = await this.transactionRepo.create({
      walletId: sellerWallet.id,
      actionType: TransactionActionType.NFT_SELL,
      amount: sellerReceives,
      fromAddress: buyerWallet.publicAddress,
      toAddress: sellerWallet.publicAddress,
      metadata: { nftId, buyerId: userId, gasFee },
      provider: 'backend'
    });

    // Confirm transactions immediately (update balances)
    await Promise.all([
      this.confirmTransaction(buyTransaction.id),
      this.confirmTransaction(sellTransaction.id)
    ]);

    // Transfer NFT ownership
    await this.nftRepo.updateCurrentOwner(nftId, userId);

    // Record NFT transaction in nft_transactions table
    await this.nftTransactionRepo.create(
      nftId,
      sellerId,           // fromUserId (seller)
      userId,             // toUserId (buyer)
      price,              // price
      NFTTransactionType.PURCHASE
    );

    logger.info(`NFT purchase: ${price} TIPS from ${userId} to ${sellerId}`);

    // Send notifications asynchronously
    Promise.all([
      // Notify buyer
      this.notificationService.sendNotification(
        userId,
        NotificationType.NFT_PURCHASED,
        {
          nftId,
          nftName: nft.name,
          price,
          sellerName: sellerProfile?.displayName || sellerProfile?.userName || 'Kullanıcı',
          sellerId,
          transactionId: buyTransaction.id,
        }
      ),
      // Notify seller
      this.notificationService.sendNotification(
        sellerId,
        NotificationType.NFT_LISTING_SOLD,
        {
          nftId,
          nftName: nft.name,
          price,
          receivedAmount: sellerReceives,
          buyerName: buyerProfile?.displayName || buyerProfile?.userName || 'Kullanıcı',
          buyerId: userId,
          transactionId: sellTransaction.id,
          gasFee,
        }
      ),
    ]).catch(error => {
      logger.error('Error sending NFT transaction notifications:', error);
    });

    return { buyTransaction, sellTransaction };
  }
}

