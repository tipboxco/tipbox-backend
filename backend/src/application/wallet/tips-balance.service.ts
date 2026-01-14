import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { WalletService } from '../wallet/wallet.service';
import logger from '../../infrastructure/logger/logger';

export class TipsBalanceService {
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly walletService: WalletService;

  constructor() {
    this.prisma = getPrisma();
    this.walletService = new WalletService();
  }

  /**
   * Kullanıcının TIPS balance'ını getir (DB'den)
   * @deprecated calculateTipsBalance() artık kullanılmıyor, balance DB'de tutuluyor
   */
  async getUserTipsBalance(userId: string): Promise<number> {
    try {
      const balanceInfo = await this.walletService.getUserBalance(userId);
      
      logger.info({
        message: 'Tips balance retrieved from DB',
        userId,
        balance: balanceInfo.available,
      });

      return balanceInfo.available;
    } catch (error) {
      logger.error({
        message: 'Error getting user tips balance',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının TIPS transaction geçmişini getir
   * Cursor pagination: createdAt ve id kombinasyonu kullanılır (UUID'ler zaman sıralaması garantisi vermez)
   */
  async getUserTransactionHistory(
    userId: string,
    options: { cursor?: string; limit: number }
  ): Promise<{
    items: Array<{
      id: string;
      type: 'received' | 'sent';
      amount: number;
      currency: string;
      from: { id: string; name: string; avatar: string | null } | null;
      to: { id: string; name: string; avatar: string | null } | null;
      reason: string | null;
      createdAt: Date;
    }>;
    cursor: string | null;
    hasMore: boolean;
  }> {
    try {
      const { cursor, limit } = options;

      // Cursor'ı parse et (format: "createdAt_timestamp-id")
      let cursorCreatedAt: Date | undefined;
      let cursorId: string | undefined;
      if (cursor) {
        const parts = cursor.split('_');
        if (parts.length === 2) {
          cursorCreatedAt = new Date(parseInt(parts[0], 10));
          cursorId = parts[1];
        }
      }

      // Alınan TIPS'ler (toUserId = userId)
      const receivedWhere: any = { toUserId: userId };
      if (cursorCreatedAt && cursorId) {
        // Cursor pagination: createdAt < cursorCreatedAt VEYA (createdAt = cursorCreatedAt AND id < cursorId)
        receivedWhere.OR = [
          { createdAt: { lt: cursorCreatedAt } },
          {
            AND: [
              { createdAt: cursorCreatedAt },
              { id: { lt: cursorId } },
            ],
          },
        ];
      }

      const receivedTransfers = await this.prisma.tipsTokenTransfer.findMany({
        where: receivedWhere,
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
              avatars: {
                where: { isActive: true },
                select: { imageUrl: true },
                take: 1,
              },
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }, // Aynı createdAt için id ile sırala (deterministic)
        ],
        take: limit + 1, // hasMore kontrolü için +1
      });

      // Gönderilen TIPS'ler (fromUserId = userId)
      const sentWhere: any = { fromUserId: userId };
      if (cursorCreatedAt && cursorId) {
        // Cursor pagination: createdAt < cursorCreatedAt VEYA (createdAt = cursorCreatedAt AND id < cursorId)
        sentWhere.OR = [
          { createdAt: { lt: cursorCreatedAt } },
          {
            AND: [
              { createdAt: cursorCreatedAt },
              { id: { lt: cursorId } },
            ],
          },
        ];
      }

      const sentTransfers = await this.prisma.tipsTokenTransfer.findMany({
        where: sentWhere,
        include: {
          toUser: {
            select: {
              id: true,
              name: true,
              avatars: {
                where: { isActive: true },
                select: { imageUrl: true },
                take: 1,
              },
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' }, // Aynı createdAt için id ile sırala (deterministic)
        ],
        take: limit + 1, // hasMore kontrolü için +1
      });

      // Her iki listeyi birleştir ve tarihe göre sırala
      const allTransactions = [
        ...receivedTransfers.map((t) => ({
          ...t,
          transactionType: 'received' as const,
        })),
        ...sentTransfers.map((t) => ({
          ...t,
          transactionType: 'sent' as const,
        })),
      ]
        .sort((a, b) => {
          // Önce createdAt'e göre sırala
          const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
          if (timeDiff !== 0) return timeDiff;
          // Aynı createdAt ise id'ye göre sırala (deterministic)
          return b.id.localeCompare(a.id);
        })
        .slice(0, limit + 1); // Limit + 1 al, hasMore kontrolü için

      const hasMore = allTransactions.length > limit;
      const items = allTransactions.slice(0, limit);

      // Response formatına dönüştür
      const formattedItems = items.map((transaction) => {
        if (transaction.transactionType === 'received') {
          const avatar =
            transaction.fromUser.avatars[0]?.imageUrl || null;
          return {
            id: transaction.id,
            type: 'received' as const,
            amount: transaction.amount,
            currency: 'TIPS',
            from: {
              id: transaction.fromUser.id,
              name: transaction.fromUser.name || 'Unknown',
              avatar,
            },
            to: null,
            reason: transaction.reason,
            createdAt: transaction.createdAt,
          };
        } else {
          const avatar =
            transaction.toUser.avatars[0]?.imageUrl || null;
          return {
            id: transaction.id,
            type: 'sent' as const,
            amount: transaction.amount,
            currency: 'TIPS',
            from: null,
            to: {
              id: transaction.toUser.id,
              name: transaction.toUser.name || 'Unknown',
              avatar,
            },
            reason: transaction.reason,
            createdAt: transaction.createdAt,
          };
        }
      });

      // Cursor oluştur: "createdAt_timestamp-id" formatında
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem
        ? `${lastItem.createdAt.getTime()}_${lastItem.id}`
        : null;

      return {
        items: formattedItems,
        cursor: nextCursor,
        hasMore,
      };
    } catch (error) {
      logger.error({
        message: 'Error getting user transaction history',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

