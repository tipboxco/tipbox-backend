import { NotificationPrismaRepository } from '../../infrastructure/repositories/notification-prisma.repository';
import { UserSettingsPrismaRepository } from '../../infrastructure/repositories/user-settings-prisma.repository';
import { BadgeReminderPrismaRepository } from '../../infrastructure/repositories/badge-reminder-prisma.repository';
import { NotificationFactory } from './notification-factory';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NotificationCategory } from '../../domain/notification/notification-category.enum';
import QueueProvider from '../../infrastructure/queue/queue.provider';
import logger from '../../infrastructure/logger/logger';
import { Notification } from '../../domain/notification/notification.entity';
import { UserSettings } from '../../domain/user/user-settings.entity';
import { enrichNotificationData } from './notification-enricher';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';

export class NotificationService {
  private notificationRepo: NotificationPrismaRepository;
  private settingsRepo: UserSettingsPrismaRepository;
  private badgeReminderRepo: BadgeReminderPrismaRepository;
  private notificationFactory: NotificationFactory;
  private queueProvider: QueueProvider;

  constructor() {
    this.notificationRepo = new NotificationPrismaRepository();
    this.settingsRepo = new UserSettingsPrismaRepository();
    this.badgeReminderRepo = new BadgeReminderPrismaRepository();
    this.notificationFactory = new NotificationFactory();
    this.queueProvider = QueueProvider.getInstance();
  }

  /**
   * Send notification to a user
   */
  async sendNotification(userId: string, type: NotificationType, data: Record<string, unknown>): Promise<void> {
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

      // Enrich notification data with avatarUrl and imageUrl
      const enrichedData = await enrichNotificationData(type, notification.data);
      const finalData = {
        ...notification.data,
        ...enrichedData,
      };

      // Add to queue for async processing
      await this.queueProvider.addNotificationJob({
        type,
        userId,
        title: notification.title,
        message: notification.message,
        data: finalData, // Enriched data with avatarUrl and imageUrl
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
  private shouldSendForCategory(settings: UserSettings | null, category: NotificationCategory): boolean {
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
      case NotificationCategory.WALLET:
        return settings.walletNotifications ?? true;
      case NotificationCategory.TRANSACTION:
        return settings.transactionNotifications ?? true;
      case NotificationCategory.REWARD:
        return settings.rewardNotifications ?? true;
      case NotificationCategory.NFT:
        return settings.nftNotifications ?? true;
      case NotificationCategory.GAMIFICATION:
        return settings.gamificationNotifications ?? true;
      case NotificationCategory.EXPERT:
        return settings.expertNotifications ?? true;
      case NotificationCategory.EVENT:
        return settings.eventNotifications ?? true;
      case NotificationCategory.SYSTEM:
        return settings.systemNotifications ?? true;
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
      search?: string;
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
        search: options?.search,
      }),
      this.notificationRepo.getTotalCount(userId, {
        unreadOnly: options?.unreadOnly,
        type: typeFilter,
        category: options?.category,
        search: options?.search,
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

  /**
   * Badge için hatırlatma ayarla (belirtilen zamanda push gönderilecek).
   * Aynı badge için mevcut hatırlatma varsa güncellenir.
   */
  async setBadgeReminder(
    userId: string,
    badgeId: string,
    remindAt: Date
  ): Promise<{ id: string; remindAt: string }> {
    const record = await this.badgeReminderRepo.upsert(userId, badgeId, remindAt);
    logger.info({ userId, badgeId, remindAt: record.remindAt, message: 'Badge reminder set' });
    return {
      id: record.id,
      remindAt: record.remindAt.toISOString(),
    };
  }

  /**
   * Süresi gelen badge hatırlatmalarını işle: bildirim gönder, kaydı sil.
   * Scheduler/cron tarafından periyodik çağrılmalı.
   */
  async processDueBadgeReminders(limit: number = 100): Promise<number> {
    const now = new Date();
    const due = await this.badgeReminderRepo.findDue(now, limit);
    const prisma = getPrisma();
    let processed = 0;
    for (const r of due) {
      try {
        const badge = await prisma.badge.findUnique({
          where: { id: r.badgeId },
          select: { name: true },
        });
        const badgeName = badge?.name ?? 'Badge';
        await this.sendNotification(r.userId, NotificationType.BADGE_REMINDER, {
          badgeId: r.badgeId,
          badgeName,
        });
        await this.badgeReminderRepo.delete(r.id);
        processed++;
      } catch (err) {
        logger.error({
          message: 'Failed to process badge reminder',
          reminderId: r.id,
          userId: r.userId,
          badgeId: r.badgeId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return processed;
  }
}

