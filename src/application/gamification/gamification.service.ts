import { UserBadge } from '../../domain/gamification/user-badge.entity';
import { Badge } from '../../domain/gamification/badge.entity';
import { UserAchievement } from '../../domain/gamification/user-achievement.entity';
import { BadgeRarity } from '../../domain/gamification/badge-rarity.enum';
import { BadgeType } from '../../domain/gamification/badge-type.enum';
import { BadgeVisibility } from '../../domain/gamification/badge-visibility.enum';
import QueueProvider from '../../infrastructure/queue/queue.provider';
import logger from '../../infrastructure/logger/logger';

export class GamificationService {
  private readonly queueProvider: QueueProvider;

  constructor() {
    this.queueProvider = QueueProvider.getInstance();
  }

  /**
   * Kullanıcıya rozet verir ve bildirim kuyruğuna ekler
   * @param userId - Kullanıcı ID'si
   * @param badgeId - Rozet ID'si
   * @returns Verilen rozet bilgisi
   */
  async grantBadgeToUser(userId: number, badgeId: number): Promise<UserBadge | null> {
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
        1, // categoryId
        new Date()
      );

      const mockUserBadge = new UserBadge(
        1,
        userId,
        badgeId,
        true, // isVisible
        null, // displayOrder
        BadgeVisibility.PUBLIC,
        true, // claimed
        new Date() // claimedAt
      );

      logger.info(`Badge ${mockBadge.name} granted to user ${userId}`);

      // Rozet veritabanında atandıktan sonra, bildirim kuyruğuna ekle
      await this.queueProvider.addNotificationJob({
        type: 'NEW_BADGE',
        userId,
        badgeName: mockBadge.getName(),
        badgeIcon: mockBadge.hasImage() ? mockBadge.imageUrl : '🏆',
        badgeId: mockBadge.id,
        badgeCategory: mockBadge.categoryId,
        badgeRarity: mockBadge.rarity,
      });

      logger.info(`Notification job added for badge ${mockBadge.getName()} to user ${userId}`);

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
  async grantAchievementToUser(userId: number, achievementId: number): Promise<UserAchievement | null> {
    try {
      // Mock achievement data
      const mockUserAchievement = new UserAchievement(
        1,
        userId,
        achievementId,
        100, // progress
        true, // completed
        new Date() // completedAt
      );

      logger.info(`Achievement ${achievementId} granted to user ${userId}`);

      // Başarı veritabanında atandıktan sonra, bildirim kuyruğuna ekle
      await this.queueProvider.addNotificationJob({
        type: 'ACHIEVEMENT_UNLOCKED',
        userId,
        achievementName: 'İlk Başarı',
        achievementIcon: '🏆',
        achievementId,
        progress: 100,
      });

      logger.info(`Notification job added for achievement ${achievementId} to user ${userId}`);

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
  async getUserBadges(userId: number): Promise<UserBadge[]> {
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
  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
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
  async getUserGamificationStats(userId: number): Promise<{
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
