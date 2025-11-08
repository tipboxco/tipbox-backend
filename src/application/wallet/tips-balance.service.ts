import { PrismaClient } from '@prisma/client';
import { CacheService } from '../../infrastructure/cache/cache.service';
import logger from '../../infrastructure/logger/logger';

export class TipsBalanceService {
  private readonly prisma: PrismaClient;
  private readonly cacheService: CacheService;
  private readonly CACHE_TTL = 30; // 30 saniye cache

  constructor() {
    this.prisma = new PrismaClient();
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
}

