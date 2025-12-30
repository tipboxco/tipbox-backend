import { Router, Request, Response } from 'express';
import { NotificationService } from '../../application/notification/notification.service';
import { PushTokenService } from '../../application/notification/push-token.service';
import { UserSettingsPrismaRepository } from '../../infrastructure/repositories/user-settings-prisma.repository';
import { RegisterPushTokenDto, UpdateNotificationSettingsDto, GetNotificationsQuery } from './notification.dto';
import { authMiddleware } from '../auth/auth.middleware';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const notificationService = new NotificationService();
const pushTokenService = new PushTokenService();
const settingsRepo = new UserSettingsPrismaRepository();

/**
 * @route GET /api/v1/notifications
 * @desc Get user's notifications
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit, offset, unreadOnly } = req.query as unknown as GetNotificationsQuery;

    const notifications = await notificationService.getUserNotifications(userId, {
      limit: limit ? parseInt(limit as any) : 20,
      offset: offset ? parseInt(offset as any) : 0,
      unreadOnly: (typeof unreadOnly === 'string' && unreadOnly === 'true') || unreadOnly === true,
    });

    res.json({
      success: true,
      data: notifications.map((n) => n.toJSON()),
    });
  } catch (error) {
    logger.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
    });
  }
});

/**
 * @route GET /api/v1/notifications/unread-count
 * @desc Get unread notifications count
 */
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
});

/**
 * @route PUT /api/v1/notifications/:id/read
 * @desc Mark notification as read
 */
router.put('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});

/**
 * @route PUT /api/v1/notifications/mark-all-read
 * @desc Mark all notifications as read
 */
router.put('/mark-all-read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const count = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: `${count} notifications marked as read`,
      data: { count },
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
});

/**
 * @route DELETE /api/v1/notifications/:id
 * @desc Delete a notification
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id);

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
});

/**
 * @route GET /api/v1/notifications/settings
 * @desc Get notification settings
 */
router.get('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const settings = await settingsRepo.findByUserId(userId);

    if (!settings) {
      return res.json({
        success: true,
        data: {
          trustNotifications: true,
          supportNotifications: true,
          messageNotifications: true,
          collectionNotifications: true,
          postNotifications: true,
          notificationEmailEnabled: true,
          notificationPushEnabled: true,
          notificationInAppEnabled: true,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        trustNotifications: settings.trustNotifications,
        supportNotifications: settings.supportNotifications,
        messageNotifications: settings.messageNotifications,
        collectionNotifications: settings.collectionNotifications,
        postNotifications: settings.postNotifications,
        notificationEmailEnabled: settings.notificationEmailEnabled,
        notificationPushEnabled: settings.notificationPushEnabled,
        notificationInAppEnabled: settings.notificationInAppEnabled,
      },
    });
  } catch (error) {
    logger.error('Error getting notification settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get notification settings',
    });
  }
});

/**
 * @route PUT /api/v1/notifications/settings
 * @desc Update notification settings
 */
router.put('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const updates: UpdateNotificationSettingsDto = req.body;

    let settings = await settingsRepo.findByUserId(userId);

    if (!settings) {
      settings = await settingsRepo.create(userId);
    }

    await settingsRepo.updateByUserId(userId, updates);

    return res.json({
      success: true,
      message: 'Notification settings updated',
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
    });
  }
});

/**
 * @route POST /api/v1/notifications/push-token
 * @desc Register push token
 */
router.post('/push-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { token, deviceType }: RegisterPushTokenDto = req.body;

    if (!token || !deviceType) {
      return res.status(400).json({
        success: false,
        message: 'Token and deviceType are required',
      });
    }

    const pushToken = await pushTokenService.registerPushToken(userId, token, deviceType);

    return res.json({
      success: true,
      message: 'Push token registered successfully',
      data: pushToken.toJSON(),
    });
  } catch (error) {
    logger.error('Error registering push token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register push token',
    });
  }
});

/**
 * @route DELETE /api/v1/notifications/push-token
 * @desc Delete push token
 */
router.delete('/push-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    await pushTokenService.deletePushToken(token);

    return res.json({
      success: true,
      message: 'Push token deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting push token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete push token',
    });
  }
});

export default router;

