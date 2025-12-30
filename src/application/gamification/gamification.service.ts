import { UserBadge } from '../../domain/gamification/user-badge.entity';
import { Badge } from '../../domain/gamification/badge.entity';
import { UserAchievement } from '../../domain/gamification/user-achievement.entity';
import { BadgeRarity } from '../../domain/gamification/badge-rarity.enum';
import { BadgeType } from '../../domain/gamification/badge-type.enum';
import { BadgeVisibility } from '../../domain/gamification/badge-visibility.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import logger from '../../infrastructure/logger/logger';

export class GamificationService {
  private readonly notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Kullanıcıya rozet verir ve bildirim kuyruğuna ekler
   * @param userId - Kullanıcı ID'si
   * @param badgeId - Rozet ID'si
   * @returns Verilen rozet bilgisi
   */
  async grantBadgeToUser(userId: string, badgeId: string): Promise<UserBadge | null> {
    try {
      // Bu kısımda gerçek veritabanı işlemleri yapılacak
      // Şimdilik mock data döndürüyoruz
      const mockBadge = new Badge(
        badgeId,
        'İlk Post',
        'İlk postunuzu paylaştınız',
        null, // imageUrl
        BadgeType.ACHIEVEMENT,
        BadgeRarity.COMMON,
        null, // boostMultiplier
        null, // rewardMultiplier
        '00000000-0000-0000-0000-000000000001', // categoryId
        new Date()
      );

      const mockUserBadge = new UserBadge(
        '00000000-0000-0000-0000-000000000001',
        userId,
        badgeId,
        true, // isVisible
        null, // displayOrder
        BadgeVisibility.PUBLIC,
        true, // claimed
        new Date() // claimedAt
      );

      logger.info(`Badge ${mockBadge.name} granted to user ${userId}`);

      // Rozet bildirimini NotificationService ile gönder
      await this.notificationService.sendNotification(
        userId,
        NotificationType.NEW_BADGE,
        {
          badgeName: mockBadge.getName(),
          badgeIcon: mockBadge.hasImage() ? mockBadge.imageUrl : '🏆',
          badgeId: mockBadge.id,
        }
      );

      logger.info(`Notification sent for badge ${mockBadge.getName()} to user ${userId}`);

      return mockUserBadge;
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
