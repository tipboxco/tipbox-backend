import { PrismaClient } from '@prisma/client';
import { PushToken } from '../../domain/notification/push-token.entity';
import { getPrisma } from './prisma.client';
import logger from '../logger/logger';

export class PushTokenPrismaRepository {
  private prisma;

  constructor() {
    this.prisma = getPrisma();
  }

  async create(data: {
    userId: string;
    token: string;
    deviceType: string;
  }): Promise<PushToken> {
    try {
      // Deactivate any existing tokens for this user on the same device type
      await this.prisma.pushToken.updateMany({
        where: {
          userId: data.userId,
          deviceType: data.deviceType,
        },
        data: {
          isActive: false,
        },
      });

      // Create new token
      const pushToken = await this.prisma.pushToken.create({
        data: {
          userId: data.userId,
          token: data.token,
          deviceType: data.deviceType,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });

      return new PushToken({
        id: pushToken.id,
        userId: pushToken.userId,
        token: pushToken.token,
        deviceType: pushToken.deviceType,
        isActive: pushToken.isActive,
        lastUsedAt: pushToken.lastUsedAt,
        createdAt: pushToken.createdAt,
        updatedAt: pushToken.updatedAt,
      });
    } catch (error) {
      logger.error('Error creating push token:', error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<PushToken[]> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      return tokens.map(
        (t) =>
          new PushToken({
            id: t.id,
            userId: t.userId,
            token: t.token,
            deviceType: t.deviceType,
            isActive: t.isActive,
            lastUsedAt: t.lastUsedAt,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })
      );
    } catch (error) {
      logger.error('Error finding push tokens by userId:', error);
      throw error;
    }
  }

  async findByToken(token: string): Promise<PushToken | null> {
    try {
      const pushToken = await this.prisma.pushToken.findUnique({
        where: { token },
      });

      if (!pushToken) {
        return null;
      }

      return new PushToken({
        id: pushToken.id,
        userId: pushToken.userId,
        token: pushToken.token,
        deviceType: pushToken.deviceType,
        isActive: pushToken.isActive,
        lastUsedAt: pushToken.lastUsedAt,
        createdAt: pushToken.createdAt,
        updatedAt: pushToken.updatedAt,
      });
    } catch (error) {
      logger.error('Error finding push token by token:', error);
      throw error;
    }
  }

  async updateLastUsed(token: string): Promise<void> {
    try {
      await this.prisma.pushToken.update({
        where: { token },
        data: {
          lastUsedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating push token lastUsedAt:', error);
      throw error;
    }
  }

  async deactivate(token: string): Promise<void> {
    try {
      await this.prisma.pushToken.update({
        where: { token },
        data: {
          isActive: false,
        },
      });
    } catch (error) {
      logger.error('Error deactivating push token:', error);
      throw error;
    }
  }

  async delete(token: string): Promise<void> {
    try {
      await this.prisma.pushToken.delete({
        where: { token },
      });
    } catch (error) {
      logger.error('Error deleting push token:', error);
      throw error;
    }
  }

  async deleteExpiredTokens(olderThanDays: number): Promise<number> {
    try {
      const date = new Date();
      date.setDate(date.getDate() - olderThanDays);

      const result = await this.prisma.pushToken.deleteMany({
        where: {
          lastUsedAt: {
            lt: date,
          },
        },
      });

      return result.count;
    } catch (error) {
      logger.error('Error deleting expired push tokens:', error);
      throw error;
    }
  }
}

