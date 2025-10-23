import { DMMessage } from '../../domain/messaging/dm-message.entity';
import { DMThread } from '../../domain/messaging/dm-thread.entity';
import { User } from '../../domain/user/user.entity';
import { DmMessagePrismaRepository } from '../../infrastructure/repositories/dm-message-prisma.repository';
import { DMThreadPrismaRepository } from '../../infrastructure/repositories/dm-thread-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import logger from '../../infrastructure/logger/logger';

export interface SendMessageData {
  senderId: number;
  recipientId: number;
  content: string;
  messageType?: 'text' | 'image' | 'file';
  threadId?: number;
}

export class MessagingService {
  private dmMessageRepo = new DmMessagePrismaRepository();
  private dmThreadRepo = new DMThreadPrismaRepository();
  private userRepo = new UserPrismaRepository();

  constructor() {}

  /**
   * Yeni mesaj gönder
   */
  async sendMessage(data: SendMessageData): Promise<DMMessage> {
    try {
      const { senderId, recipientId, content, messageType = 'text', threadId } = data;

      // Gönderici ve alıcıyı kontrol et
      const sender = await this.userRepo.findById(senderId);
      const recipient = await this.userRepo.findById(recipientId);

      if (!sender) {
        throw new Error('Sender not found');
      }
      if (!recipient) {
        throw new Error('Recipient not found');
      }

      // Thread'i bul veya oluştur
      let thread: DMThread;
      if (threadId) {
        const foundThread = await this.dmThreadRepo.findById(threadId);
        if (!foundThread) {
          throw new Error('Thread not found');
        }
        thread = foundThread;
      } else {
        // Yeni thread oluştur
        thread = await this.dmThreadRepo.create({
          userOneId: senderId,
          userTwoId: recipientId,
          isActive: true,
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Mesajı oluştur
      const message = await this.dmMessageRepo.create({
        threadId: thread.id,
        senderId,
        message: content,
        isRead: false,
        sentAt: new Date(),
        createdAt: new Date(),
      });

      // Thread'i güncelle
      await this.dmThreadRepo.update(thread.id, {
        updatedAt: new Date(),
      });

      // Alıcıya anlık mesaj gönder
      SocketManager.getInstance().getSocketHandler().sendMessageToUser(
        recipientId.toString(),
        'new_message',
        {
          messageId: message.id,
          threadId: thread.id,
          senderId: sender.id,
          senderName: sender.name || sender.email,
          content: message.message,
          timestamp: message.sentAt.toISOString(),
        }
      );

      // Göndericiye de mesaj gönderilme onayı
      SocketManager.getInstance().getSocketHandler().sendMessageToUser(
        senderId.toString(),
        'message_sent',
        {
          messageId: message.id,
          threadId: thread.id,
          recipientId: recipient.id,
          timestamp: message.sentAt.toISOString(),
        }
      );

      logger.info(`Message sent from user ${senderId} to user ${recipientId}`);
      return message;
    } catch (error) {
      logger.error(`Failed to send message from user ${data.senderId} to user ${data.recipientId}:`, error);
      throw error;
    }
  }

  /**
   * Mesajı okundu olarak işaretle
   */
  async markMessageAsRead(messageId: number, userId: number): Promise<void> {
    try {
      const message = await this.dmMessageRepo.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Mesajın alıcısı kontrol et
      const thread = await this.dmThreadRepo.findById(message.threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      const isRecipient = thread.userOneId === userId || thread.userTwoId === userId;
      if (!isRecipient) {
        throw new Error('User is not a participant of this thread');
      }

      // Mesajı okundu olarak işaretle
      await this.dmMessageRepo.update(messageId, { isRead: true });

      // Göndericiye okundu bildirimi gönder
      const senderId = message.senderId;
      SocketManager.getInstance().getSocketHandler().sendMessageToUser(
        senderId.toString(),
        'message_read',
        {
          messageId: message.id,
          threadId: thread.id,
          readBy: userId,
          timestamp: new Date().toISOString(),
        }
      );

      logger.info(`Message ${messageId} marked as read by user ${userId}`);
    } catch (error) {
      logger.error(`Failed to mark message ${messageId} as read by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Thread'deki tüm mesajları al
   */
  async getThreadMessages(threadId: number, userId: number, limit = 50, offset = 0): Promise<DMMessage[]> {
    try {
      // Thread'e erişim kontrolü
      const thread = await this.dmThreadRepo.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      const isParticipant = thread.userOneId === userId || thread.userTwoId === userId;
      if (!isParticipant) {
        throw new Error('User is not a participant of this thread');
      }

      const messages = await this.dmMessageRepo.findByThreadId(threadId, limit, offset);
      return messages;
    } catch (error) {
      logger.error(`Failed to get messages for thread ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının thread'lerini al
   */
  async getUserThreads(userId: number): Promise<DMThread[]> {
    try {
      const threads = await this.dmThreadRepo.findByUserId(userId);
      return threads;
    } catch (error) {
      logger.error(`Failed to get threads for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının okunmamış mesaj sayısını al
   */
  async getUnreadMessageCount(userId: number): Promise<number> {
    try {
      const count = await this.dmMessageRepo.getUnreadCountByUserId(userId);
      return count;
    } catch (error) {
      logger.error(`Failed to get unread message count for user ${userId}:`, error);
      throw error;
    }
  }
}
