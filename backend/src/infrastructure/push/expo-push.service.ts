import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PushTokenPrismaRepository } from '../repositories/push-token-prisma.repository';
import logger from '../logger/logger';

export class ExpoPushService {
  private expo: Expo;
  private pushTokenRepo: PushTokenPrismaRepository;

  constructor() {
    this.expo = new Expo();
    this.pushTokenRepo = new PushTokenPrismaRepository();
  }

  /**
   * Kullanıcıya push notification gönderir
   */
  async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Kullanıcının aktif push token'larını al
      const tokens = await this.pushTokenRepo.findByUserId(userId);

      if (tokens.length === 0) {
        logger.debug(`No active push tokens for user ${userId}, skipping push notification`);
        return;
      }

      // data payload'ını serialize-safe hale getir (nested object/Date vb. sorun yaratmasın)
      const safeData = this.sanitizeData(data);

      // Expo push mesajlarını oluştur
      const messages: ExpoPushMessage[] = [];

      for (const tokenRecord of tokens) {
        const pushToken = tokenRecord.token;

        // Expo token formatını kontrol et
        if (!Expo.isExpoPushToken(pushToken)) {
          logger.warn(`Invalid Expo push token: ${pushToken} for user ${userId}, deactivating`);
          await this.pushTokenRepo.deactivate(pushToken);
          continue;
        }

        messages.push({
          to: pushToken,
          sound: 'default',
          title,
          body: message,
          data: safeData,
          priority: 'high',
          channelId: 'default',
          badge: typeof safeData.unreadCount === 'number' ? safeData.unreadCount : undefined,
          mutableContent: true,
        });
      }

      if (messages.length === 0) {
        logger.debug(`No valid Expo push tokens for user ${userId}`);
        return;
      }

      // Chunk'lara böl ve gönder
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          logger.debug(`Push chunk sent for user ${userId}`, {
            chunkSize: chunk.length,
            results: ticketChunk.map((t) => t.status),
          });
        } catch (error) {
          logger.error(`Error sending push notification chunk to user ${userId}:`, error);
        }
      }

      // Ticket'ları işle - hatalı token'ları deaktive et
      await this.handleTickets(tickets, tokens.map((t) => t.token));

      // Receipt kontrolü - 15 sn sonra async olarak çalıştır
      const receiptIds = tickets
        .filter((t): t is ExpoPushTicket & { id: string } => t.status === 'ok' && 'id' in t)
        .map((t) => t.id);

      if (receiptIds.length > 0) {
        setTimeout(() => {
          this.checkReceipts(receiptIds, tokens.map((t) => t.token)).catch((err) => {
            logger.error('Failed to check push receipts:', err);
          });
        }, 15_000);
      }

      logger.info(`Push notification sent to user ${userId}`, {
        tokenCount: tokens.length,
        ticketCount: tickets.length,
        successCount: tickets.filter((t) => t.status === 'ok').length,
        errorCount: tickets.filter((t) => t.status === 'error').length,
      });
    } catch (error) {
      logger.error(`Failed to send push notification to user ${userId}:`, error);
      // Push hatası ana job'u fail etmemeli
    }
  }

  /**
   * data payload'ını serialize-safe hale getirir.
   * Expo SDK data alanında sadece JSON-serializable değerler kabul eder.
   */
  private sanitizeData(data?: Record<string, unknown>): Record<string, string | number | boolean> {
    if (!data) return {};
    const safe: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safe[key] = value;
      } else {
        // Object/Date vb. → string'e çevir
        safe[key] = String(value);
      }
    }
    return safe;
  }

  /**
   * Ticket sonuçlarını kontrol edip hatalı token'ları deaktive eder
   */
  private async handleTickets(tickets: ExpoPushTicket[], tokenList: string[]): Promise<void> {
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];

      if (ticket.status === 'error') {
        const token = tokenList[i];
        logger.warn(`Push notification error for token ${token}: ${ticket.message}`, {
          details: ticket.details,
        });

        // DeviceNotRegistered = token artık geçersiz
        if (ticket.details?.error === 'DeviceNotRegistered' && token) {
          logger.info(`Deactivating unregistered device token: ${token}`);
          await this.pushTokenRepo.deactivate(token);
        }
      }
    }
  }

  /**
   * Push receipt'larını kontrol eder.
   * Expo, ticket gönderildikten ~15 dakika sonra receipt oluşturur.
   * Bu metod hatalı receipt'lardaki geçersiz token'ları deaktive eder.
   */
  private async checkReceipts(receiptIds: string[], tokenList: string[]): Promise<void> {
    try {
      const chunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);

      for (const chunk of chunks) {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
          if (receipt.status === 'error') {
            logger.warn(`Push receipt error for ${receiptId}: ${receipt.message}`, {
              details: receipt.details,
            });

            if (receipt.details?.error === 'DeviceNotRegistered') {
              // receiptId ile token eşleştirmesi yapamıyoruz, tüm token'ları logla
              logger.warn('DeviceNotRegistered in receipt, tokens may need cleanup', {
                receiptId,
                tokens: tokenList,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error checking push notification receipts:', error);
    }
  }
}
