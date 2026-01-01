import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import { PushTokenPrismaRepository } from '../repositories/push-token-prisma.repository';
import logger from '../logger/logger';

export class ExpoPushService {
  private expo: Expo;
  private pushTokenRepo: PushTokenPrismaRepository;

  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true, // Use FCM v1 API
    });
    this.pushTokenRepo = new PushTokenPrismaRepository();
  }

  /**
   * Send push notification to a user
   */
  async sendPushNotification(
    userId: string,
    notification: {
      title: string;
      message: string;
      data?: any;
    }
  ): Promise<void> {
    try {
      // Get user's active push tokens
      const tokens = await this.pushTokenRepo.findByUserId(userId);

      if (tokens.length === 0) {
        logger.debug(`No push tokens found for user ${userId}`);
        return;
      }

      // Filter valid Expo push tokens
      const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.token));

      if (validTokens.length === 0) {
        logger.warn(`No valid Expo push tokens for user ${userId}`);
        return;
      }

      // Prepare messages
      const messages: ExpoPushMessage[] = validTokens.map((token) => ({
        to: token.token,
        sound: 'default',
        title: notification.title,
        body: notification.message,
        data: notification.data || {},
        priority: 'high',
      }));

      // Send in chunks (Expo recommends max 100 per chunk)
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          logger.debug(`Sent push notification chunk to user ${userId}`);
        } catch (error) {
          logger.error(`Error sending push notification chunk:`, error);
        }
      }

      // Handle ticket responses
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = validTokens[i];

        if (ticket.status === 'error') {
          logger.error(`Push notification error for token ${token.token}:`, {
            message: ticket.message,
            details: ticket.details,
          });

          // Deactivate token if it's invalid
          if (
            ticket.details?.error === 'DeviceNotRegistered' ||
            ticket.message?.includes('not registered')
          ) {
            await this.pushTokenRepo.deactivate(token.token);
            logger.info(`Deactivated invalid push token: ${token.token}`);
          }
        } else {
          // Update last used timestamp
          await this.pushTokenRepo.updateLastUsed(token.token);
        }
      }

      logger.info(`Push notifications sent to user ${userId} (${validTokens.length} devices)`);
    } catch (error) {
      logger.error(`Error sending push notification to user ${userId}:`, error);
      // Don't throw - push notification failure shouldn't break the flow
    }
  }

  /**
   * Send push notifications to multiple users (batch)
   */
  async sendBatchPushNotifications(
    notifications: Array<{
      userId: string;
      title: string;
      message: string;
      data?: any;
    }>
  ): Promise<void> {
    try {
      // Process in parallel but with rate limiting
      const BATCH_SIZE = 10;
      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((notif) =>
            this.sendPushNotification(notif.userId, {
              title: notif.title,
              message: notif.message,
              data: notif.data,
            })
          )
        );
      }

      logger.info(`Batch push notifications sent to ${notifications.length} users`);
    } catch (error) {
      logger.error('Error sending batch push notifications:', error);
    }
  }

  /**
   * Check push notification receipts
   */
  async checkReceipts(receiptIds: string[]): Promise<void> {
    try {
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);

      for (const chunk of receiptIdChunks) {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

        for (const receiptId in receipts) {
          const receipt: ExpoPushReceipt = receipts[receiptId];

          if (receipt.status === 'error') {
            logger.error(`Push notification receipt error:`, {
              receiptId,
              message: receipt.message,
              details: receipt.details,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking push notification receipts:', error);
    }
  }

  /**
   * Validate an Expo push token
   */
  isValidPushToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }
}

