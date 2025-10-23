import { UserBadge } from '../../domain/gamification/user-badge.entity';
import { Badge } from '../../domain/gamification/badge.entity';
import { UserAchievement } from '../../domain/gamification/user-achievement.entity';
import { QueueProvider } from '../../infrastructure/queue/queue.provider';
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
      const mockBadge: Badge = {
        id: badgeId,
        name: 'İlk Post',
        description: 'İlk postunuzu paylaştınız',
        icon: '🎯',
        category: 'content',
        rarity: 'common',
        type: 'achievement',
        visibility: 'public',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUserBadge: UserBadge = {
        id: 1,
        userId,
        badgeId,
        earnedAt: new Date(),
        badge: mockBadge,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info(`Badge ${mockBadge.name} granted to user ${userId}`);

      // Rozet veritabanında atandıktan sonra, bildirim kuyruğuna ekle
      await this.queueProvider.addNotificationJob({
        type: 'NEW_BADGE',
        userId,
        badgeName: mockBadge.name,
        badgeIcon: mockBadge.icon,
        badgeId: mockBadge.id,
        badgeCategory: mockBadge.category,
        badgeRarity: mockBadge.rarity,
      });

      logger.info(`Notification job added for badge ${mockBadge.name} to user ${userId}`);

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
      const mockUserAchievement: UserAchievement = {
        id: 1,
        userId,
        achievementId,
        unlockedAt: new Date(),
        progress: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

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
