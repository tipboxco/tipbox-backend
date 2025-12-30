import { PushTokenPrismaRepository } from '../../infrastructure/repositories/push-token-prisma.repository';
import { ExpoPushService } from '../../infrastructure/push/expo-push.service';
import { PushToken } from '../../domain/notification/push-token.entity';
import logger from '../../infrastructure/logger/logger';

export class PushTokenService {
  private pushTokenRepo: PushTokenPrismaRepository;
  private expoPushService: ExpoPushService;

  constructor() {
    this.pushTokenRepo = new PushTokenPrismaRepository();
    this.expoPushService = new ExpoPushService();
  }

  /**
   * Register a push token for a user
   */
  async registerPushToken(
    userId: string,
    token: string,
    deviceType: string
  ): Promise<PushToken> {
    try {
      // Validate token format
      if (!this.expoPushService.isValidPushToken(token)) {
        throw new Error('Invalid Expo push token format');
      }

      // Create or update token
      const pushToken = await this.pushTokenRepo.create({
        userId,
        token,
        deviceType,
      });

      logger.info(`Push token registered for user ${userId} on ${deviceType}`);
      return pushToken;
    } catch (error) {
      logger.error(`Error registering push token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's push tokens
   */
  async getUserPushTokens(userId: string): Promise<PushToken[]> {
    return await this.pushTokenRepo.findByUserId(userId);
  }

  /**
   * Deactivate a push token
   */
  async deactivatePushToken(token: string): Promise<void> {
    await this.pushTokenRepo.deactivate(token);
    logger.info(`Push token deactivated: ${token}`);
  }

  /**
   * Delete a push token
   */
  async deletePushToken(token: string): Promise<void> {
    await this.pushTokenRepo.delete(token);
    logger.info(`Push token deleted: ${token}`);
  }

  /**
   * Cleanup expired tokens (for scheduled job)
   */
  async cleanupExpiredTokens(olderThanDays: number = 30): Promise<number> {
    const count = await this.pushTokenRepo.deleteExpiredTokens(olderThanDays);
    logger.info(`Cleaned up ${count} expired push tokens`);
    return count;
  }
}

