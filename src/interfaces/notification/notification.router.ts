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
 * @openapi
 * /notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get user notifications
 *     description: Retrieve a paginated list of user notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter only unread notifications
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { limit, offset, unreadOnly } = req.query as unknown as GetNotificationsQuery;

    const notifications = await notificationService.getUserNotifications(userId, {
      limit: limit ? parseInt(limit as any) : 20,
      offset: offset ? parseInt(offset as any) : 0,
      unreadOnly: (typeof unreadOnly === 'string' && unreadOnly === 'true') || unreadOnly === true,
    });

    return res.json({
      success: true,
      data: notifications.map((n) => n.toJSON()),
    });
  } catch (error) {
    logger.error('Error getting notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
    });
  }
});

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get unread notifications count
 *     description: Get the total count of unread notifications for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId);

    return res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
});

/**
 * @openapi
 * /notifications/{id}/read:
 *   put:
 *     tags:
 *       - Notifications
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       500:
 *         description: Server error
 */
router.put('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id);

    return res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});

/**
 * @openapi
 * /notifications/mark-all-read:
 *   put:
 *     tags:
 *       - Notifications
 *     summary: Mark all notifications as read
 *     description: Mark all user notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.put('/mark-all-read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const count = await notificationService.markAllAsRead(userId);

    return res.json({
      success: true,
      message: `${count} notifications marked as read`,
      data: { count },
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
});

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete a notification
 *     description: Delete a specific notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id);

    return res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
});

/**
 * @openapi
 * /notifications/settings:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get notification settings
 *     description: Get user's notification preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       500:
 *         description: Server error
 */
router.get('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
 * @openapi
 * /notifications/settings:
 *   put:
 *     tags:
 *       - Notifications
 *     summary: Update notification settings
 *     description: Update user's notification preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNotificationSettings'
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       500:
 *         description: Server error
 */
router.put('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
 * @openapi
 * /notifications/push-token:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Register push token
 *     description: Register an Expo push notification token for the current user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - deviceType
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push notification token
 *               deviceType:
 *                 type: string
 *                 enum: [ios, android, web]
 *                 description: Device type
 *     responses:
 *       200:
 *         description: Push token registered successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/push-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
 * @openapi
    * /notifications/push-token:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete push token
 *     description: Remove a registered push notification token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push notification token to remove
 *     responses:
 *       200:
 *         description: Push token deleted successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
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

