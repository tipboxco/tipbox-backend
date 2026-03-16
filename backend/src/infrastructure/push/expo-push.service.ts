import Expo, { ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
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
          data: (data as Record<string, string>) ?? {},
          priority: 'high',
          channelId: 'default',
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
        } catch (error) {
          logger.error(`Error sending push notification chunk to user ${userId}:`, error);
        }
      }

      // Ticket'ları işle - hatalı token'ları deaktive et
      await this.handleTickets(tickets, tokens.map((t) => t.token));

      logger.info(`Push notification sent to user ${userId} (${tickets.length} tickets)`);
    } catch (error) {
      logger.error(`Failed to send push notification to user ${userId}:`, error);
      // Push hatası ana job'u fail etmemeli
    }
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

    // Receipt'ları kontrol et (15 dakika sonra kontrol edilmeli ama basitlik için burada yapıyoruz)
    const receiptIds = tickets
      .filter((t): t is ExpoPushTicket & { id: string } => t.status === 'ok' && 'id' in t)
      .map((t) => t.id);

    if (receiptIds.length > 0) {
      // Receipt kontrolü async yapılabilir, şimdilik log'layalım
      logger.debug(`Push notification receipt IDs: ${receiptIds.join(', ')}`);
    }
  }
}
