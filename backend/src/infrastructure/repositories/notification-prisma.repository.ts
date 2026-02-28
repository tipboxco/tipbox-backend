import { PrismaClient, Prisma, NotificationType as PrismaNotificationType } from '@prisma/client';
import { Notification } from '../../domain/notification/notification.entity';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NotificationCategory } from '../../domain/notification/notification-category.enum';
import { getPrisma } from './prisma.client';
import logger from '../logger/logger';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEYS } from '../cache/cache-keys';
import { CACHE_TTL } from '../cache/cache-ttl';

export class NotificationPrismaRepository {
  private prisma;
  private cacheService: CacheService;

  constructor() {
    this.prisma = getPrisma();
    this.cacheService = CacheService.getInstance();
  }

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Prisma.InputJsonValue | null;
  }): Promise<Notification> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type as PrismaNotificationType,
          title: data.title,
          message: data.message,
          data: data.data ?? Prisma.JsonNull,
          read: false,
        },
      });

      // Unread count cache'ini invalidate et (yeni bildirim eklendi)
      const cacheKey = CACHE_KEYS.NOTIFICATION_UNREAD_COUNT(data.userId);
      await this.cacheService.del(cacheKey);
      logger.debug(`Invalidated unread count cache for user ${data.userId} (new notification created)`);

      return new Notification({
        id: notification.id,
        userId: notification.userId,
        type: notification.type as NotificationType,
        title: notification.title,
        message: notification.message,
        data: notification.data as Record<string, unknown> | undefined,
        read: notification.read,
        readAt: notification.readAt || undefined,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      });
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Notification | null> {
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return null;
      }

      return new Notification({
        id: notification.id,
        userId: notification.userId,
        type: notification.type as NotificationType,
        title: notification.title,
        message: notification.message,
        data: notification.data as Record<string, unknown> | undefined,
        read: notification.read,
        readAt: notification.readAt || undefined,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      });
    } catch (error) {
      logger.error('Error finding notification by id:', error);
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
      types?: NotificationType[]; // Array of types support
      category?: NotificationCategory;
      search?: string;
    }
  ): Promise<Notification[]> {
    try {
      // Import NotificationFactory to get types by category
      const { NotificationFactory } = await import('../../application/notification/notification-factory');
      const { NotificationCategory } = await import('../../domain/notification/notification-category.enum');
      
      const factory = new NotificationFactory();
      
      // Build type filter
      let typeFilter: NotificationType[] | undefined;
      if (options?.types && options.types.length > 0) {
        // If types array is provided, use it directly
        typeFilter = options.types;
      } else if (options?.type) {
        typeFilter = [options.type];
      } else if (options?.category) {
        typeFilter = factory.getTypesByCategory(options.category);
      }

      const searchTrimmed = options?.search?.trim();
      const whereClause: Prisma.NotificationWhereInput = {
        userId,
        ...(options?.unreadOnly && { read: false }),
        ...(typeFilter && typeFilter.length > 0 && { type: { in: typeFilter as PrismaNotificationType[] } }),
      };

      // Add search filter if provided
      if (searchTrimmed) {
        whereClause.OR = [
          { title: { contains: searchTrimmed, mode: 'insensitive' } },
          { message: { contains: searchTrimmed, mode: 'insensitive' } },
        ];
      }

      const notifications = await this.prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      });

      return notifications.map(
        (n) =>
          new Notification({
            id: n.id,
            userId: n.userId,
            type: n.type as NotificationType,
            title: n.title,
            message: n.message,
            data: n.data as Record<string, unknown> | undefined,
            read: n.read,
            readAt: n.readAt || undefined,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          })
      );
    } catch (error) {
      logger.error('Error finding notifications by userId:', error);
      throw error;
    }
  }

  async getTotalCount(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      type?: NotificationType;
      types?: NotificationType[]; // Array of types support
      category?: NotificationCategory;
      search?: string;
    }
  ): Promise<number> {
    try {
      // Import NotificationFactory to get types by category
      const { NotificationFactory } = await import('../../application/notification/notification-factory');
      
      const factory = new NotificationFactory();
      
      // Build type filter
      let typeFilter: NotificationType[] | undefined;
      if (options?.types && options.types.length > 0) {
        // If types array is provided, use it directly
        typeFilter = options.types;
      } else if (options?.type) {
        typeFilter = [options.type];
      } else if (options?.category) {
        typeFilter = factory.getTypesByCategory(options.category);
      }

      const searchTrimmed = options?.search?.trim();
      const whereClause: Prisma.NotificationWhereInput = {
        userId,
        ...(options?.unreadOnly && { read: false }),
        ...(typeFilter && typeFilter.length > 0 && { type: { in: typeFilter as PrismaNotificationType[] } }),
      };

      // Add search filter if provided
      if (searchTrimmed) {
        whereClause.OR = [
          { title: { contains: searchTrimmed, mode: 'insensitive' } },
          { message: { contains: searchTrimmed, mode: 'insensitive' } },
        ];
      }

      return await this.prisma.notification.count({
        where: whereClause,
      });
    } catch (error) {
      logger.error('Error getting total notification count:', error);
      throw error;
    }
  }

  async markAsRead(id: string): Promise<void> {
    try {
      // Önce notification'ı al (userId için cache invalidation)
      const notification = await this.prisma.notification.findUnique({
        where: { id },
        select: { userId: true, read: true },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      // Sadece okunmamışsa güncelle (cache invalidation için)
      if (!notification.read) {
        await this.prisma.notification.update({
          where: { id },
          data: {
            read: true,
            readAt: new Date(),
          },
        });

        // Unread count cache'ini invalidate et
        const cacheKey = CACHE_KEYS.NOTIFICATION_UNREAD_COUNT(notification.userId);
        await this.cacheService.del(cacheKey);
        logger.debug(`Invalidated unread count cache for user ${notification.userId} (notification marked as read)`);
      }
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      // Unread count cache'ini invalidate et ve 0 olarak set et
      const cacheKey = CACHE_KEYS.NOTIFICATION_UNREAD_COUNT(userId);
      await this.cacheService.del(cacheKey);
      await this.cacheService.set(cacheKey, 0, CACHE_TTL.NOTIFICATION_UNREAD_COUNT);
      logger.debug(`Invalidated and reset unread count cache for user ${userId} (all marked as read)`);

      return result.count;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const cacheKey = CACHE_KEYS.NOTIFICATION_UNREAD_COUNT(userId);
      
      // Cache'ten oku
      const cachedCount = await this.cacheService.get<number>(cacheKey);
      if (cachedCount !== null && cachedCount !== undefined) {
        logger.debug(`Unread count cache hit for user ${userId}: ${cachedCount}`);
        return cachedCount;
      }

      // Cache'te yoksa database'den oku
      const count = await this.prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      // Cache'e yaz
      await this.cacheService.set(cacheKey, count, CACHE_TTL.NOTIFICATION_UNREAD_COUNT);
      logger.debug(`Unread count cached for user ${userId}: ${count}`);

      return count;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.notification.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  async deleteOldNotifications(olderThanDays: number): Promise<number> {
    try {
      const date = new Date();
      date.setDate(date.getDate() - olderThanDays);

      const result = await this.prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: date,
          },
          read: true,
        },
      });

      return result.count;
    } catch (error) {
      logger.error('Error deleting old notifications:', error);
      throw error;
    }
  }
}

