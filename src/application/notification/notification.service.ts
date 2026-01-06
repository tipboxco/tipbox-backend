import { NotificationPrismaRepository } from '../../infrastructure/repositories/notification-prisma.repository';
import { UserSettingsPrismaRepository } from '../../infrastructure/repositories/user-settings-prisma.repository';
import { NotificationFactory } from './notification-factory';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NotificationCategory } from '../../domain/notification/notification-category.enum';
import QueueProvider from '../../infrastructure/queue/queue.provider';
import logger from '../../infrastructure/logger/logger';
import { Notification } from '../../domain/notification/notification.entity';

export class NotificationService {
  private notificationRepo: NotificationPrismaRepository;
  private settingsRepo: UserSettingsPrismaRepository;
  private notificationFactory: NotificationFactory;
  private queueProvider: QueueProvider;

  constructor() {
    this.notificationRepo = new NotificationPrismaRepository();
    this.settingsRepo = new UserSettingsPrismaRepository();
    this.notificationFactory = new NotificationFactory();
    this.queueProvider = QueueProvider.getInstance();
  }

  /**
   * Send notification to a user
   */
  async sendNotification(userId: string, type: NotificationType, data: any): Promise<void> {
    try {
      // Check user notification preferences
      const settings = await this.settingsRepo.findByUserId(userId);
      
      if (!settings) {
        logger.debug(`No settings found for user ${userId}, using defaults`);
      }

      // Check if notifications are disabled globally
      if (settings && settings.receiveNotifications === false) {
        logger.debug(`Notifications disabled for user ${userId}`);
        return;
      }

      // Check category-specific preferences
      const category = this.notificationFactory.getCategoryForType(type);
      if (category && !this.shouldSendForCategory(settings, category)) {
        logger.debug(`Notification category ${category} disabled for user ${userId}`);
        return;
      }

      // Create notification using factory
      const notification = this.notificationFactory.createNotification(type, data);

      // Add to queue for async processing
      await this.queueProvider.addNotificationJob({
        type,
        userId,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        // Channel preferences
        sendEmail: settings?.notificationEmailEnabled ?? false,
        sendPush: settings?.notificationPushEnabled ?? true,
        sendInApp: settings?.notificationInAppEnabled ?? true,
      });

      logger.debug(`Notification queued for user ${userId}:`, { type, title: notification.title });
    } catch (error) {
      logger.error(`Error sending notification to user ${userId}:`, error);
      // Don't throw - notification failure shouldn't break main flow
    }
  }

  /**
   * Check if notification should be sent based on category preferences
   */
  private shouldSendForCategory(settings: any, category: NotificationCategory): boolean {
    if (!settings) return true;

    switch (category) {
      case NotificationCategory.POST:
        return settings.postNotifications ?? true;
      case NotificationCategory.TRUST:
        return settings.trustNotifications ?? true;
      case NotificationCategory.MESSAGE:
        return settings.messageNotifications ?? true;
      case NotificationCategory.SUPPORT:
        return settings.supportNotifications ?? true;
      case NotificationCategory.COLLECTION:
        return settings.collectionNotifications ?? true;
      default:
        return true;
    }
  }

  /**
   * Get user's notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
      category?: NotificationCategory;
    }
  ): Promise<{
    notifications: Notification[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    // If category is provided, get all types for that category
    let typeFilter: NotificationType | undefined = options?.type;
    if (options?.category && !typeFilter) {
      const typesForCategory = this.notificationFactory.getTypesByCategory(options.category);
      // If category filter is provided, we'll filter by types in repository
      typeFilter = undefined; // We'll handle category filtering in repository
    }

    const [notifications, total] = await Promise.all([
      this.notificationRepo.findByUserId(userId, {
        ...options,
        type: typeFilter,
        category: options?.category,
      }),
      this.notificationRepo.getTotalCount(userId, {
        unreadOnly: options?.unreadOnly,
        type: typeFilter,
        category: options?.category,
      }),
    ]);

    return {
      notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notifications.length < total,
      },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationRepo.markAsRead(notificationId);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    return await this.notificationRepo.markAllAsRead(userId);
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepo.getUnreadCount(userId);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await this.notificationRepo.delete(notificationId);
  }

  /**
   * Cleanup old notifications (for scheduled job)
   */
  async cleanupOldNotifications(olderThanDays: number = 90): Promise<number> {
    return await this.notificationRepo.deleteOldNotifications(olderThanDays);
  }
}

