import { Transaction } from '../../domain/transaction/transaction.entity';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction-prisma.repository';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { ValidationError, NotFoundError } from '../../infrastructure/errors/custom-errors';
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
    private readonly walletRepo = new WalletPrismaRepository()
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

    // Check balance
    const balance = await this.transactionRepo.calculateBalance(fromWallet.id);
    if (balance < request.amount) {
      throw new ValidationError(`Insufficient balance. Available: ${balance} TIPS`);
    }

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
    await this.transactionRepo.create({
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

    // Mark SEND transaction as pending (will be processed by worker)
    await this.transactionRepo.updateStatus(sendTransaction.id, TransactionStatus.PENDING);

    logger.info(`Tip sent: ${request.amount} TIPS from ${request.fromUserId} to ${request.toUserId}`);

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
   */
  async getUserBalance(userId: string): Promise<number> {
    const wallet = await this.walletRepo.findActiveByUserId(userId);
    if (!wallet) {
      return 0;
    }

    return await this.transactionRepo.calculateBalance(wallet.id);
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

    // Mark as pending (will be processed by worker)
    await this.transactionRepo.updateStatus(transaction.id, TransactionStatus.PENDING);

    logger.info(`Reward claimed: ${amount} TIPS for user ${userId}`);

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

    // Check balance
    const balance = await this.transactionRepo.calculateBalance(buyerWallet.id);
    if (balance < price) {
      throw new ValidationError(`Insufficient balance. Available: ${balance} TIPS`);
    }

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

    // Mark as pending
    await this.transactionRepo.updateStatus(buyTransaction.id, TransactionStatus.PENDING);
    await this.transactionRepo.updateStatus(sellTransaction.id, TransactionStatus.PENDING);

    logger.info(`NFT purchase: ${price} TIPS from ${userId} to ${sellerId}`);

    return { buyTransaction, sellTransaction };
  }
}

