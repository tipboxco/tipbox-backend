import { Transaction } from '../../domain/transaction/transaction.entity';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { TransactionStatus } from '../../domain/transaction/transaction-status.enum';
import { TransactionPrismaRepository } from '../../infrastructure/repositories/transaction-prisma.repository';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { NFTPrismaRepository } from '../../infrastructure/repositories/nft-prisma.repository';
import { NFTTransactionPrismaRepository } from '../../infrastructure/repositories/nft-transaction-prisma.repository';
import { NFTMarketListingPrismaRepository } from '../../infrastructure/repositories/nft-market-listing-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { ValidationError, NotFoundError } from '../../infrastructure/errors/custom-errors';
import { invalidateNFTCache, invalidateUserNFTCache } from '../../infrastructure/cache/cache-invalidation';
import { TransactionNotificationService } from './transaction-notification.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NFTTransactionType } from '../../domain/crypto/nft-transaction-type.enum';
import { WalletService } from '../wallet/wallet.service';
import { getThirdwebSdkService } from '../wallet/thirdweb-sdk/thirdweb-sdk.service';
import QueueProvider from '../../infrastructure/queue/queue.provider';
import logger from '../../infrastructure/logger/logger';

export interface SendTipRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason?: string;
}

/** 0x + 40 hex karakter (Ethereum adresi) */
function isEthereumAddress(s: string): boolean {
  const trimmed = s?.trim();
  return typeof trimmed === 'string' && /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

function normalizeEthereumAddress(s: string): string {
  const trimmed = s?.trim();
  if (!trimmed || !isEthereumAddress(trimmed)) return trimmed;
  return ('0x' + trimmed.slice(2).toLowerCase()) as string;
}

export interface TransactionHistoryOptions {
  cursor?: string;
  limit?: number;
}

export interface TransferNFTRequest {
  fromUserId: string;
  toUserId: string;
  nftId: string;
  message?: string;
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
    private readonly nftMarketListingRepo = new NFTMarketListingPrismaRepository(),
    private readonly transactionNotificationService = new TransactionNotificationService(),
    private readonly notificationService = new NotificationService(),
    private readonly profileRepo = new ProfilePrismaRepository(),
    private readonly walletService = new WalletService()
  ) {}

  /**
   * TIPS gönderme işlemi
   * - Önce transaction tablosuna SEND ve RECEIVE kayıtları eklenir (status: created)
   * - İş Redis tip-send kuyruğuna eklenir; contract çağrısı consumer (worker) tarafından yapılır
   * - Kullanıcı hemen dönüş alır; güncellemeler transaction history ile takip edilir
   * - Nihai durum (confirmed/failed) webhook üzerinden transaction tablosunda güncellenir
   */
  async sendTip(request: SendTipRequest): Promise<{ transaction: Transaction }> {
    // Validation
    if (request.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0');
    }

    if (request.fromUserId === request.toUserId) {
      throw new ValidationError('Cannot send tips to yourself');
    }

    // Gönderen: JWT'deki userId için smart account tercih eden wallet (ERC-4337)
    const fromWallet = await this.walletRepo.findPreferredForReceivingByUserId(request.fromUserId);
    if (!fromWallet) {
      throw new NotFoundError('Sender wallet not found');
    }

    // Alıcı: recipientUserId = kullanıcı id (UUID) veya public adres (0x...). Adres bizim tabloda olmayabilir.
    let toWallet = await this.walletRepo.findPreferredForReceivingByUserId(request.toUserId);
    let toAddress: string;
    let receiveTransactionId: string | undefined;

    if (toWallet) {
      toAddress = toWallet.smartAccountAddress ?? toWallet.publicAddress;
    } else if (isEthereumAddress(request.toUserId)) {
      // Wallet adresi verilmiş; DB'de kayıtlı bir smartAccountAddress mi kontrol et
      const walletByAddress = await this.walletRepo.findByAddressForTracking(
        normalizeEthereumAddress(request.toUserId)
      );
      if (walletByAddress) {
        // Adres bizim sistemde kayıtlı → TIP_SEND olarak gönder (tipbox contract)
        toWallet = walletByAddress;
        toAddress = walletByAddress.smartAccountAddress ?? walletByAddress.publicAddress;
      } else {
        // Adres kayıtlı değil → WITHDRAW (ERC20 direct transfer)
        toAddress = normalizeEthereumAddress(request.toUserId);
      }
    } else {
      throw new NotFoundError('Recipient wallet not found');
    }

    const fromAddress = fromWallet.smartAccountAddress ?? fromWallet.publicAddress;

    // Wallet adresine gönderim = WITHDRAW; Tipbox kullanıcısına gönderim = TIP_SEND
    const isWithdrawToAddress = !toWallet;
    const sendActionType = isWithdrawToAddress ? TransactionActionType.WITHDRAW : TransactionActionType.TIP_SEND;

    // Atomic balance lock — double spend önleme.
    // Balance check + lockedBalance artırma tek atomic operasyonda yapılır.
    const walletRepo = this.walletRepo as WalletPrismaRepository;
    const lockedWallet = await walletRepo.lockBalance(fromWallet.id, request.amount);
    if (!lockedWallet) {
      // lockBalance null → yetersiz available balance
      const freshWallet = await this.walletRepo.findPreferredForReceivingByUserId(request.fromUserId);
      const available = freshWallet ? freshWallet.getAvailableBalance() : 0;
      throw new ValidationError(
        `Insufficient balance. Available: ${available} TIPS`
      );
    }

    // 1) Fee hesapla — contract'tan feePercentage oku (orn. 25 = %25)
    let feePercentage = 0;
    let feeAmount = 0;
    let netAmount = request.amount;

    if (toWallet) {
      // Sadece internal tip (TIP_SEND via Tipbox contract) için fee var;
      // external adrese gönderim (WITHDRAW / ERC20 transfer) için fee yok.
      try {
        const sdk = getThirdwebSdkService();
        if (sdk.isConfigured()) {
          feePercentage = await sdk.getFeePercentage();
          if (feePercentage > 0 && feePercentage <= 100) {
            feeAmount = Math.floor(request.amount * feePercentage / 100);
            netAmount = request.amount - feeAmount;
          }
        }
      } catch (err) {
        logger.warn({
          error: err instanceof Error ? err.message : String(err),
          message: 'Failed to read feePercentage from contract; using gross amount for RECEIVE',
        });
        // Fee okunamazsa güvenli tarafta kal: netAmount = grossAmount (contract event düzeltir)
        feePercentage = 0;
        feeAmount = 0;
        netAmount = request.amount;
      }
    }

    // 2) SEND + RECEIVE kaydını atomic $transaction ile oluştur
    const prisma = getPrisma();
    let sendTransaction: Transaction;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const sendTx = await tx.transaction.create({
          data: {
            walletId: fromWallet.id,
            actionType: sendActionType,
            amount: request.amount,
            fromAddress,
            toAddress,
            metadata: {
              reason: request.reason || null,
              recipientUserId: toWallet ? toWallet.userId : null,
              recipientAddress: toWallet ? null : toAddress,
              source: 'thirdweb_sdk',
              ...(feeAmount > 0 && { feeAmount, feePercentage }),
            },
            provider: 'thirdweb',
          },
        });

        let receiveTxId: string | undefined;
        if (toWallet) {
          const receiveTx = await tx.transaction.create({
            data: {
              walletId: toWallet.id,
              actionType: TransactionActionType.TIP_RECEIVE,
              amount: netAmount,
              fromAddress,
              toAddress,
              metadata: {
                reason: request.reason || null,
                senderUserId: request.fromUserId,
                pairedTransactionId: sendTx.id,
                source: 'thirdweb_sdk',
                grossAmount: request.amount,
                ...(feeAmount > 0 && { feeAmount, feePercentage }),
              },
              provider: 'thirdweb',
            },
          });
          receiveTxId = receiveTx.id;

          // SEND metadata'sına RECEIVE ID'yi ekle
          await tx.transaction.update({
            where: { id: sendTx.id },
            data: {
              metadata: {
                reason: request.reason || null,
                recipientUserId: toWallet.userId,
                source: 'thirdweb_sdk',
                pairedTransactionId: receiveTx.id,
                ...(feeAmount > 0 && { feeAmount, feePercentage }),
              },
            },
          });
        }

        return { sendTx, receiveTxId };
      });

      sendTransaction = new Transaction(
        result.sendTx.id,
        result.sendTx.walletId,
        result.sendTx.actionType as TransactionActionType,
        result.sendTx.status as TransactionStatus,
        result.sendTx.amount,
        result.sendTx.fromAddress,
        result.sendTx.toAddress,
        result.sendTx.metadata as Record<string, unknown> | null,
        result.sendTx.txHash,
        result.sendTx.provider,
        result.sendTx.errorMessage,
        result.sendTx.createdAt,
        result.sendTx.confirmedAt,
        result.sendTx.failedAt,
      );
      receiveTransactionId = result.receiveTxId;
    } catch (err) {
      // Transaction oluşturma başarısız — lock'u geri al
      await walletRepo.unlockBalance(fromWallet.id, request.amount);
      throw err;
    }

    // 2) Tip send işini Redis kuyruğuna ekle
    const queueProvider = QueueProvider.getInstance();
    const delayMs = parseInt(process.env.TIP_SEND_QUEUE_DELAY_MS || '5000', 10);
    const delayMsFinal = Math.min(5000, Math.max(0, delayMs));
    await queueProvider.addTipSendJob(
      {
        sendTransactionId: sendTransaction.id,
        receiveTransactionId: receiveTransactionId ?? undefined,
        useErc20Transfer: !toWallet,
        fromUserId: request.fromUserId,
        toAddress,
        amount: request.amount,
        reason: request.reason,
      },
      { delay: delayMsFinal }
    );

    logger.info({
      sendTransactionId: sendTransaction.id,
      amount: request.amount,
      fromUserId: request.fromUserId,
      toUserId: request.toUserId,
      toAddress,
      externalRecipient: !toWallet,
      message: 'Tip send queued; consumer will process on-chain',
    });

    // 3) Kullanıcıya hemen transaction (id, status: created) dön
    const latest = await this.transactionRepo.findById(sendTransaction.id);
    return { transaction: latest! };
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
   * Tip send / withdraw işlemini iptal et. Sadece status=created ve TIP_SEND veya WITHDRAW ise, gönderen iptal edebilir.
   * Kuyruktaki job çalıştığında zaten iptal edilmiş olduğu için SDK çağrılmaz.
   */
  async cancelTipSend(transactionId: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }
    const cancellableTypes = [TransactionActionType.TIP_SEND, TransactionActionType.WITHDRAW];
    if (!cancellableTypes.includes(transaction.actionType)) {
      throw new ValidationError('Only pending tip send or withdraw transactions can be cancelled');
    }
    if (transaction.status !== TransactionStatus.CREATED) {
      throw new ValidationError(
        `Transaction cannot be cancelled (current status: ${transaction.status}). Only pending tip sends can be cancelled.`
      );
    }

    const wallet = await this.walletRepo.findById(transaction.walletId);
    if (!wallet || wallet.userId !== userId) {
      throw new ValidationError('You can only cancel your own tip send transaction');
    }

    const receiveTransactionId =
      (transaction.metadata?.pairedTransactionId as string) ||
      (transaction.metadata?.receiveTransactionId as string) ||
      undefined;
    const errorMessage = 'Cancelled by user';

    // Cancel işleminde metadata'ya cancelledByUser flag'i ekle (FAILED ile ayırt etmek için)
    const prisma = getPrisma();
    await Promise.all([
      this.transactionRepo.updateStatus(transactionId, TransactionStatus.FAILED, { errorMessage }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          metadata: { ...((transaction.metadata as Record<string, unknown>) || {}), cancelledByUser: true },
        },
      }),
      ...(receiveTransactionId
        ? [
            this.transactionRepo.updateStatus(receiveTransactionId, TransactionStatus.FAILED, { errorMessage }),
            prisma.transaction.update({
              where: { id: receiveTransactionId },
              data: {
                metadata: {
                  ...((await prisma.transaction.findUnique({ where: { id: receiveTransactionId }, select: { metadata: true } }))?.metadata as Record<string, unknown> || {}),
                  cancelledByUser: true,
                },
              },
            }),
          ]
        : []),
    ]);

    const updated = await this.transactionRepo.findById(transactionId);
    logger.info({
      transactionId,
      userId,
      message: 'Tip send cancelled by user',
    });
    return updated!;
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
      { userId, excludeCancelledTipReceive: true },
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

    // BUG-21 fix: Atomic guard — sadece henüz confirmed olmayan transaction'ı güncelle.
    // Worker ve contract event aynı anda confirm etmeye çalışırsa, sadece biri başarılı olur.
    const prisma = getPrisma();
    const atomicResult = await prisma.transaction.updateMany({
      where: {
        id: transactionId,
        status: { not: 'confirmed' as TransactionStatus },
      },
      data: {
        status: 'confirmed' as TransactionStatus,
        confirmedAt: new Date(),
        ...(txHash ? { txHash } : {}),
      },
    });

    if (atomicResult.count === 0) {
      // Başka bir thread/process zaten confirm etti — çift notification/balance update önle
      logger.warn({
        transactionId,
        message: 'Transaction already confirmed by another process (atomic guard)',
      });
      const existing = await this.transactionRepo.findById(transactionId);
      return existing!;
    }

    if (!transaction.amount) {
      logger.warn(`Transaction ${transactionId} has no amount, skipping balance update`);
      const confirmed = await this.transactionRepo.findById(transactionId);
      return confirmed!;
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
      TransactionActionType.BOOST_POST,
    ].includes(transaction.actionType);

    // TIP_SEND/TIP_RECEIVE: Chain zaten güncel; manuel +/- yaparsak sync ile çift sayım olur. Sadece status güncelle, bakiye sync ile gelir.
    const isTipPair =
      transaction.actionType === TransactionActionType.TIP_SEND ||
      transaction.actionType === TransactionActionType.TIP_RECEIVE;

    if (!isTipPair) {
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
    }

    // Confirmed transaction'ı DB'den oku (atomic update sonrası güncel hali)
    const confirmedTx = await this.transactionRepo.findById(transactionId);
    if (!confirmedTx) {
      throw new Error('Failed to read confirmed transaction');
    }

    // Transaction'a ait notification webhook akışı üzerinden kaydedilir (tips, transfer, deposit, withdraw vb.)
    this.transactionNotificationService
      .sendTransactionConfirmedNotification(confirmedTx)
      .catch(err => {
        logger.error({
          transactionId: confirmedTx.id,
          error: err instanceof Error ? err.message : String(err),
          message: 'Transaction confirmed notification failed',
        });
      });

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

    // Transaction fail notification (webhook/transaction akışı üzerinden)
    this.transactionNotificationService
      .sendTransactionFailedNotification(failedTx, errorMessage)
      .catch(err => {
        logger.error({
          transactionId: failedTx.id,
          error: err instanceof Error ? err.message : String(err),
          message: 'Transaction failed notification failed',
        });
      });

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
      toAddress: wallet.smartAccountAddress ?? wallet.publicAddress,
      metadata: {
        rewardId,
        rewardType
      },
      provider: 'backend'
    });

    // Confirm transaction immediately (update balance); notification transaction akışı üzerinden gönderilir
    await this.confirmTransaction(transaction.id);

    logger.info(`Reward claimed: ${amount} TIPS for user ${userId}`);

    return transaction;
  }

  /**
   * Post boost için TIPS düşer (BOOST_POST transaction oluşturur ve confirm eder).
   * Önce bakiye kontrolü yapılmalı; yetersizse ValidationError fırlatır.
   */
  async deductForPostBoost(userId: string, amount: number, postId: string): Promise<Transaction> {
    if (amount <= 0) {
      throw new ValidationError('Boost amount must be greater than 0');
    }

    const wallet = await this.walletRepo.findActiveByUserId(userId);
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (!wallet.hasBalance(amount)) {
      throw new ValidationError(
        `Insufficient balance. Available: ${wallet.getAvailableBalance()} TIPS`
      );
    }

    const transaction = await this.transactionRepo.create({
      walletId: wallet.id,
      actionType: TransactionActionType.BOOST_POST,
      amount: amount,
      fromAddress: wallet.publicAddress,
      toAddress: null,
      metadata: { postId },
      provider: 'backend',
    });

    await this.confirmTransaction(transaction.id);

    logger.info({ userId, postId, amount, message: 'Post boost deducted' });
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

    // Get NFT details
    const nft = await this.nftRepo.findById(nftId);
    if (!nft) {
      throw new NotFoundError('NFT not found');
    }

    // Wallet adresi: smartAccountAddress kullan (yoksa publicAddress)
    const buyerAddress = buyerWallet.smartAccountAddress ?? buyerWallet.publicAddress;
    const sellerAddress = sellerWallet.smartAccountAddress ?? sellerWallet.publicAddress;

    // Create BUY transaction
    const buyTransaction = await this.transactionRepo.create({
      walletId: buyerWallet.id,
      actionType: TransactionActionType.NFT_BUY,
      amount: price,
      fromAddress: buyerAddress,
      toAddress: sellerAddress,
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
      fromAddress: buyerAddress,
      toAddress: sellerAddress,
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

    // Notifications are sent via transaction notification flow (confirmTransaction -> TransactionNotificationService)

    return { buyTransaction, sellTransaction };
  }

  /**
   * NFT transfer işlemi (kullanıcıdan kullanıcıya)
   * - Owner kontrolü
   * - Transferable kontrolü
   * - Marketplace'te ACTIVE listing varsa engeller
   * - Owner günceller + nft_transactions tablosuna TRANSFER kaydı atar
   * - Bildirim gönderir (NFT_SENT / NFT_RECEIVED)
   */
  async transferNFT(request: TransferNFTRequest): Promise<{
    nftId: string;
    fromUserId: string;
    toUserId: string;
    nftTransactionId: string;
    transferredAt: Date;
  }> {
    const { fromUserId, toUserId, nftId, message } = request;

    if (!nftId) {
      throw new ValidationError('nftId is required');
    }
    if (!toUserId) {
      throw new ValidationError('recipientId (toUserId) is required');
    }
    if (fromUserId === toUserId) {
      throw new ValidationError('Cannot transfer NFT to yourself');
    }

    const nft = await this.nftRepo.findById(nftId);
    if (!nft) {
      throw new NotFoundError('NFT not found');
    }
    if (!nft.hasOwner() || !nft.belongsToUser(fromUserId)) {
      throw new ValidationError('You are not the owner of this NFT');
    }
    if (!nft.canBeTransferred()) {
      throw new ValidationError('This NFT is not transferable');
    }

    // Recipient user existence check (profile yoksa bile user olmalı)
    const prisma = getPrisma();
    const recipientUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true },
    });
    if (!recipientUser) {
      throw new NotFoundError('Recipient user not found');
    }

    // Prevent transfer if NFT is actively listed on marketplace
    const activeListing = await this.nftMarketListingRepo.findActiveByNftId(nftId);
    if (activeListing) {
      throw new ValidationError('NFT is currently listed for sale. Cancel the listing before transferring.');
    }

    // Profiles (for notification payloads)
    const [fromProfile, toProfile] = await Promise.all([
      this.profileRepo.findByUserId(fromUserId),
      this.profileRepo.findByUserId(toUserId),
    ]);

    const senderName =
      fromProfile?.displayName || fromProfile?.userName || 'User';
    const recipientName =
      toProfile?.displayName || toProfile?.userName || 'User';

    // Atomic transfer: update owner + create nft_transaction
    const nftTx = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.$executeRawUnsafe(
        `UPDATE nfts
         SET current_owner_id = $1::uuid, updated_at = NOW()
         WHERE id = $2::uuid AND current_owner_id = $3::uuid`,
        toUserId,
        nftId,
        fromUserId
      );

      if (updatedCount === 0) {
        throw new ValidationError('NFT ownership changed. Please retry.');
      }

      return await tx.nFTTransaction.create({
        data: {
          nftId,
          fromUserId,
          toUserId,
          price: null,
          transactionType: NFTTransactionType.TRANSFER as NFTTransactionType,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    });

    logger.info({
      message: 'NFT transferred',
      nftId,
      fromUserId,
      toUserId,
      nftTransactionId: nftTx.id,
    });

    // Invalidate caches (best-effort, awaited to avoid unhandled rejections)
    await Promise.all([
      invalidateNFTCache(nftId),
      invalidateUserNFTCache(fromUserId),
      invalidateUserNFTCache(toUserId),
    ]).catch((error) => {
      logger.error('Error invalidating NFT transfer cache:', error);
    });

    // Notifications (best-effort, awaited to avoid unhandled rejections)
    await Promise.all([
      this.notificationService.sendNotification(fromUserId, NotificationType.NFT_SENT, {
        nftId,
        nftName: nft.name,
        recipientUserId: toUserId,
        recipientName,
        message: message || null,
      }),
      this.notificationService.sendNotification(toUserId, NotificationType.NFT_RECEIVED, {
        nftId,
        nftName: nft.name,
        senderUserId: fromUserId,
        senderName,
        message: message || null,
      }),
    ]).catch((error) => {
      logger.error('Error sending NFT transfer notifications:', error);
    });

    return {
      nftId,
      fromUserId,
      toUserId,
      nftTransactionId: nftTx.id,
      transferredAt: nftTx.createdAt,
    };
  }
}

