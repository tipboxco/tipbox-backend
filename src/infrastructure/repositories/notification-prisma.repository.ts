import { PrismaClient } from '@prisma/client';
import { Notification } from '../../domain/notification/notification.entity';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { getPrisma } from './prisma.client';
import logger from '../logger/logger';

export class NotificationPrismaRepository {
  private prisma;

  constructor() {
    this.prisma = getPrisma();
  }

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }): Promise<Notification> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data || null,
          read: false,
        },
      });

      return new Notification({
        id: notification.id,
        userId: notification.userId,
        type: notification.type as NotificationType,
        title: notification.title,
        message: notification.message,
        data: notification.data,
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
        data: notification.data,
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
    }
  ): Promise<Notification[]> {
    try {
      const notifications = await this.prisma.notification.findMany({
        where: {
          userId,
          ...(options?.unreadOnly && { read: false }),
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
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
            data: n.data,
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

  async markAsRead(id: string): Promise<void> {
    try {
      await this.prisma.notification.update({
        where: { id },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
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

      return result.count;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });
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

