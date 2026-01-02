import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { CacheService } from '../../infrastructure/cache/cache.service';
import logger from '../../infrastructure/logger/logger';

export class TipsBalanceService {
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly cacheService: CacheService;
  private readonly CACHE_TTL = 30; // 30 saniye cache

  constructor() {
    this.prisma = getPrisma();
    this.cacheService = CacheService.getInstance();
  }

  /**
   * Kullanıcının TIPS balance'ını hesapla
   * Cache kullanarak performansı artırır
   */
  async getUserTipsBalance(userId: string): Promise<number> {
    try {
      // Cache key
      const cacheKey = `user:${userId}:tips-balance`;

      // Cache'den kontrol et
      const cachedBalance = await this.cacheService.get<number>(cacheKey);
      if (cachedBalance !== null) {
        logger.info({
          message: 'Tips balance retrieved from cache',
          userId,
          balance: cachedBalance,
        });
        return cachedBalance;
      }

      // Cache'de yoksa hesapla
      const balance = await this.calculateTipsBalance(userId);

      // Cache'e kaydet (30 saniye TTL)
      await this.cacheService.set(cacheKey, balance, this.CACHE_TTL);

      logger.info({
        message: 'Tips balance calculated and cached',
        userId,
        balance,
      });

      return balance;
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
   * TIPS balance'ı hesapla (cache kullanmadan)
   */
  private async calculateTipsBalance(userId: string): Promise<number> {
    // Alınan TIPS'leri topla (toUserId = userId)
    const receivedTips = await this.prisma.tipsTokenTransfer.aggregate({
      where: { toUserId: userId },
      _sum: {
        amount: true,
      },
    });

    // Gönderilen TIPS'leri topla (fromUserId = userId)
    const sentTips = await this.prisma.tipsTokenTransfer.aggregate({
      where: { fromUserId: userId },
      _sum: {
        amount: true,
      },
    });

    // Kilitli TIPS'leri topla (Lootbox'larda)
    const lockedTips = await this.prisma.lootbox.aggregate({
      where: {
        userId,
        status: { in: ['LOCKED', 'OPENABLE'] },
      },
      _sum: {
        tipsLocked: true,
      },
    });

    // Expert Request'lerde harcanan TIPS'leri hesapla (ANSWERED veya CLOSED durumunda)
    const spentOnExpertRequests = await this.prisma.expertRequest.aggregate({
      where: {
        userId,
        status: { in: ['ANSWERED', 'CLOSED'] },
      },
      _sum: {
        tipsAmount: true,
      },
    });

    // Balance = Alınan - Gönderilen - Kilitli - Expert Request'lere Harcanan
    const received = receivedTips._sum.amount || 0;
    const sent = sentTips._sum.amount || 0;
    const locked = lockedTips._sum.tipsLocked || 0;
    const spent = spentOnExpertRequests._sum.tipsAmount || 0;

    const balance = received - sent - locked - spent;

    return Math.max(0, balance); // Negatif olamaz
  }

  /**
   * Cache'i temizle (TIPS transferi yapıldığında çağrılmalı)
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `user:${userId}:tips-balance`;
    await this.cacheService.del(cacheKey);
    logger.info({
      message: 'Tips balance cache invalidated',
      userId,
    });
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

