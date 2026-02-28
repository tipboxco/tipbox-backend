import { PushTokenPrismaRepository } from '../../infrastructure/repositories/push-token-prisma.repository';
import { PushToken } from '../../domain/notification/push-token.entity';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';

/** Kullanıcı veritabanında yok (örn. JWT'deki id ile User.id eşleşmiyor). */
export class PushTokenUserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'PushTokenUserNotFoundError';
  }
}

export class PushTokenService {
  private pushTokenRepo: PushTokenPrismaRepository;

  constructor() {
    this.pushTokenRepo = new PushTokenPrismaRepository();
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
      // Basic token validation (non-empty)
      if (!token || token.trim().length === 0) {
        throw new Error('Invalid push token: token cannot be empty');
      }

      // User must exist (foreign key); avoid P2003 by checking first
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        throw new PushTokenUserNotFoundError(userId);
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

