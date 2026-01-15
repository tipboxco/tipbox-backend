import { UserBadge } from '../../domain/gamification/user-badge.entity';
import { Badge } from '../../domain/gamification/badge.entity';
import { UserAchievement } from '../../domain/gamification/user-achievement.entity';
import { BadgeRarity } from '../../domain/gamification/badge-rarity.enum';
import { BadgeType } from '../../domain/gamification/badge-type.enum';
import { BadgeVisibility } from '../../domain/gamification/badge-visibility.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';

export class GamificationService {
  private readonly notificationService: NotificationService;
  private prisma: ReturnType<typeof getPrisma>;

  constructor() {
    this.notificationService = new NotificationService();
    this.prisma = getPrisma();
  }

  /**
   * Kullanıcıya rozet verir ve bildirim kuyruğuna ekler
   * @param userId - Kullanıcı ID'si
   * @param badgeId - Rozet ID'si
   * @returns Verilen rozet bilgisi
   */
  async grantBadgeToUser(userId: string, badgeId: string): Promise<UserBadge | null> {
    try {
      // Badge bilgisini getir
      const badge = await this.prisma.badge.findUnique({
        where: { id: badgeId },
      });

      if (!badge) {
        logger.error(`Badge ${badgeId} not found`);
        return null;
      }

      // Kullanıcıda zaten bu badge var mı kontrol et (idempotency)
      const existingBadge = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId,
          },
        },
      });

      if (existingBadge) {
        logger.info(`Badge ${badgeId} already granted to user ${userId}`);
        return new UserBadge(
          existingBadge.id,
          existingBadge.userId,
          existingBadge.badgeId,
          existingBadge.isVisible,
          existingBadge.displayOrder,
          existingBadge.visibility as BadgeVisibility,
          existingBadge.claimed,
          existingBadge.claimedAt
        );
      }

      // UserBadge oluştur (claimed=false - kullanıcı claim edecek)
      const userBadge = await this.prisma.userBadge.create({
        data: {
          userId,
          badgeId,
          isVisible: true,
          displayOrder: null,
          visibility: BadgeVisibility.PUBLIC,
          claimed: false, // Event rozetleri claim edilmeli
          claimedAt: null,
        },
      });

      logger.info(`Badge ${badge.name} granted to user ${userId}`);

      // Rozet bildirimini NotificationService ile gönder
      await this.notificationService.sendNotification(
        userId,
        NotificationType.NEW_BADGE,
        {
          badgeName: badge.name,
          badgeIcon: badge.imageUrl || '🏆',
          badgeId: badge.id,
        }
      );

      logger.info(`Notification sent for badge ${badge.name} to user ${userId}`);

      return new UserBadge(
        userBadge.id,
        userBadge.userId,
        userBadge.badgeId,
        userBadge.isVisible,
        userBadge.displayOrder,
        userBadge.visibility as BadgeVisibility,
        userBadge.claimed,
        userBadge.claimedAt
      );
    } catch (error) {
      logger.error(`Failed to grant badge ${badgeId} to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcıya başarı verir ve bildirim kuyruğuna ekler
   * @param userId - Kullanıcı ID'si
   * @param achievementId - Başarı ID'si
   * @returns Verilen başarı bilgisi
   */
  async grantAchievementToUser(userId: string, achievementId: string): Promise<UserAchievement | null> {
    try {
      // Mock achievement data
      const mockUserAchievement = new UserAchievement(
        '00000000-0000-0000-0000-000000000001',
        userId,
        achievementId,
        100, // progress
        true, // completed
        new Date() // completedAt
      );

      logger.info(`Achievement ${achievementId} granted to user ${userId}`);

      // Başarı bildirimini NotificationService ile gönder
      await this.notificationService.sendNotification(
        userId,
        NotificationType.ACHIEVEMENT_UNLOCKED,
        {
        achievementName: 'İlk Başarı',
        achievementIcon: '🏆',
        achievementId,
        }
      );

      logger.info(`Notification sent for achievement ${achievementId} to user ${userId}`);

      return mockUserAchievement;
    } catch (error) {
      logger.error(`Failed to grant achievement ${achievementId} to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının rozetlerini getirir
   * @param userId - Kullanıcı ID'si
   * @returns Kullanıcının rozetleri
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    try {
      // Mock data - gerçek implementasyonda repository kullanılacak
      return [];
    } catch (error) {
      logger.error(`Failed to get badges for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının başarılarını getirir
   * @param userId - Kullanıcı ID'si
   * @returns Kullanıcının başarıları
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      // Mock data - gerçek implementasyonda repository kullanılacak
      return [];
    } catch (error) {
      logger.error(`Failed to get achievements for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının gamification istatistiklerini getirir
   * @param userId - Kullanıcı ID'si
   * @returns Gamification istatistikleri
   */
  async getUserGamificationStats(userId: string): Promise<{
    totalBadges: number;
    totalAchievements: number;
    level: number;
    experience: number;
  }> {
    try {
      // Mock data
      return {
        totalBadges: 5,
        totalAchievements: 3,
        level: 2,
        experience: 150,
      };
    } catch (error) {
      logger.error(`Failed to get gamification stats for user ${userId}:`, error);
      throw error;
    }
  }
}

export default GamificationService;
