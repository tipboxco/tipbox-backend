import { DMMessage } from '../../domain/messaging/dm-message.entity';
import { DMThread } from '../../domain/messaging/dm-thread.entity';
import { User } from '../../domain/user/user.entity';
import { DmMessagePrismaRepository } from '../../infrastructure/repositories/dm-message-prisma.repository';
import { DMThreadPrismaRepository } from '../../infrastructure/repositories/dm-thread-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import logger from '../../infrastructure/logger/logger';
import { PrismaClient } from '@prisma/client';
import {
  MessageFeed,
  MessageFeedItem,
  Message,
  SupportRequest,
  TipsInfo,
  SenderUser,
  MessageType,
  SupportRequestStatus,
  SupportType,
} from '../../interfaces/messaging/messaging.dto';
import { SupportRequestService } from './support-request.service';
import { DMRequestStatus } from '../../domain/messaging/dm-request-status.enum';

export interface InboxMessageItem {
  id: string;
  senderName: string;
  senderTitle: string | null;
  senderAvatar: string | null;
  lastMessage: string | null;
  timestamp: string;
  isUnread: boolean;
  unreadCount: number;
}

export interface InboxQueryOptions {
  search?: string;
  unreadOnly?: boolean;
  limit?: number;
}

export class MessagingService {
  private dmMessageRepo = new DmMessagePrismaRepository();
  private dmThreadRepo = new DMThreadPrismaRepository();
  private userRepo = new UserPrismaRepository();
  private supportRequestService = new SupportRequestService();
  private prisma = new PrismaClient();
  async createThreadIfNotExists(senderId: string, recipientId: string) {
    const existing = await this.prisma.dMThread.findFirst({
      where: {
        OR: [
          { userOneId: senderId, userTwoId: recipientId },
          { userOneId: recipientId, userTwoId: senderId },
        ],
      },
    });

    if (existing) return existing;

    return await this.prisma.dMThread.create({
      data: {
        userOneId: senderId,
        userTwoId: recipientId,
        isActive: true,
        startedAt: new Date(),
      },
    } as any);
  }

  async sendDirectMessage(senderId: string, recipientId: string, message: string) {
    const sender = await this.userRepo.findById(String(senderId));
    const recipient = await this.userRepo.findById(String(recipientId));
    if (!sender || !recipient) throw new Error('User not found');

    const thread = await this.createThreadIfNotExists(senderId, recipientId);

    const createdMessage = await this.prisma.dMMessage.create({
      data: {
        threadId: thread.id,
        senderId: String(senderId),
        message,
        isRead: false,
        messageType: 'MESSAGE',
        sentAt: new Date(),
      } as any,
    });

    await this.prisma.dMThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    // Socket bildirimi gönder - new_message event'i
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const newMessageEvent = {
      messageId: createdMessage.id,
      threadId: thread.id,
      senderId: String(senderId),
      recipientId: String(recipientId),
      message,
      messageType: 'message' as const,
      timestamp: createdMessage.sentAt.toISOString(),
    };

    // Alıcıya kendi odasına gönder
    socketHandler.sendMessageToUser(String(recipientId), 'new_message', newMessageEvent);
    
    // Thread room'una gönder (her iki kullanıcı da thread room'unda olabilir)
    socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', newMessageEvent);

    // Göndericiye message_sent event'i gönder
    socketHandler.sendMessageToUser(String(senderId), 'message_sent', newMessageEvent);

    logger.info(`Direct message sent from ${senderId} to ${recipientId}, socket events emitted`);
  }

  async sendTips(senderId: string, recipientId: string, amount: number, tipsMessage?: string) {
    const tipsTransfer = await this.prisma.tipsTokenTransfer.create({
      data: {
        fromUserId: senderId,
        toUserId: recipientId,
        amount,
        reason: tipsMessage || null,
      } as any,
    });

    const body = tipsMessage
      ? `Sent ${amount} TIPS: ${tipsMessage}`
      : `Sent ${amount} TIPS`;

    // Thread oluştur veya mevcut thread'i al
    const thread = await this.createThreadIfNotExists(senderId, recipientId);

    // Mesaj oluştur
    const createdMessage = await this.prisma.dMMessage.create({
      data: {
        threadId: thread.id,
        senderId: String(senderId),
        message: body,
        isRead: false,
        messageType: 'TIPS',
        sentAt: new Date(),
      } as any,
    });

    await this.prisma.dMThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    // Socket bildirimi gönder - new_message event'i (messageType: 'send-tips')
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const newMessageEvent = {
      messageId: createdMessage.id,
      threadId: thread.id,
      senderId: String(senderId),
      recipientId: String(recipientId),
      message: body,
      messageType: 'send-tips' as const,
      timestamp: createdMessage.sentAt.toISOString(),
    };

    // Alıcıya kendi odasına gönder
    socketHandler.sendMessageToUser(String(recipientId), 'new_message', newMessageEvent);
    
    // Thread room'una gönder
    socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', newMessageEvent);

    // Göndericiye message_sent event'i gönder
    socketHandler.sendMessageToUser(String(senderId), 'message_sent', newMessageEvent);

    logger.info(`Tips sent from ${senderId} to ${recipientId}, amount: ${amount}, socket events emitted`);
  }

  /**
   * Mesajı okundu olarak işaretle
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
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

      const userIdStr = userId;
      const isRecipient = thread.userOneId === userIdStr || thread.userTwoId === userIdStr;
      if (!isRecipient) {
        throw new Error('User is not a participant of this thread');
      }

      // Mesajı okundu olarak işaretle
      await this.dmMessageRepo.update(messageId, { isRead: true });

      // Göndericiye okundu bildirimi gönder
      const senderId = String(message.senderId);
      SocketManager.getInstance().getSocketHandler().sendMessageToUser(
        senderId,
        'message_read',
        {
          messageId: message.id,
          threadId: String(thread.id),
          readBy: userIdStr,
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
   * Thread'deki tüm mesajları al (DMMessage, TIPS, Support Request birleşik)
   */
  async getThreadMessages(threadId: string, userId: string, limit = 50, offset = 0): Promise<MessageFeedItem[]> {
    try {
      // Thread'e erişim kontrolü
      const thread = await this.dmThreadRepo.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      const userIdStr = String(userId);
      const isParticipant = thread.userOneId === userIdStr || thread.userTwoId === userIdStr;
      if (!isParticipant) {
        throw new Error('User is not a participant of this thread');
      }

      const threadItems: MessageFeedItem[] = [];

      // 1. DMMessage'ları getir (Prisma'dan direkt include ile)
      const messages = await this.prisma.dMMessage.findMany({
        where: { threadId },
        include: {
          sender: {
            include: {
              profile: true,
              titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
              avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: 1000, // Tüm mesajları al, sonra sıralayacağız
      });
      
      for (const message of messages) {
        // Sender bilgilerini al
        const sender = message.sender;
        if (!sender) continue;

        const senderName = sender.profile?.displayName
          || sender.profile?.userName
          || sender.email
          || 'Unknown';

        const senderUser: SenderUser = {
          id: message.senderId,
          senderName,
          senderTitle: sender.titles?.[0]?.title ?? '',
          senderAvatar: sender.avatars?.[0]?.imageUrl ?? '',
        };

        // Message type'a göre item oluştur (messageType field'ına bak)
        const prismaMessageType = (message as any).messageType;
        const isTipsMessage = prismaMessageType === 'TIPS' || 
          (message.message.includes('Sent') && message.message.includes('TIPS'));
        
        if (isTipsMessage) {
          // TIPS mesajı - TipsInfo olarak ekle
          const tipsMatch = message.message.match(/Sent (\d+(?:\.\d+)?) TIPS(?:: (.+))?/);
          const tipsAmount = tipsMatch ? parseFloat(tipsMatch[1]) : 0;
          const tipsMessage = tipsMatch?.[2] || '';

          const tipsInfo: TipsInfo = {
            id: message.id,
            sender: senderUser,
            amount: tipsAmount,
            message: tipsMessage,
            timestamp: message.sentAt.toISOString(),
          };

          threadItems.push({
            id: message.id,
            type: 'send-tips' as MessageType,
            data: tipsInfo,
          });
        } else {
          // Normal mesaj
          const messageData: Message = {
            id: message.id,
            sender: senderUser,
            lastMessage: message.message,
            timestamp: message.sentAt.toISOString(),
            isUnread: !message.isRead,
          };

          threadItems.push({
            id: message.id,
            type: 'message' as MessageType,
            data: messageData,
          });
        }
      }

      // 2. Thread kullanıcıları arasındaki TIPS transferlerini getir
      const tipsTransfers = await this.prisma.tipsTokenTransfer.findMany({
        where: {
          OR: [
            { fromUserId: thread.userOneId, toUserId: thread.userTwoId },
            { fromUserId: thread.userTwoId, toUserId: thread.userOneId },
          ],
        },
        include: {
          fromUser: {
            include: {
              profile: true,
              titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
              avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const transfer of tipsTransfers) {
        const sender = transfer.fromUser;
        if (!sender) continue;

        const senderName = sender.profile?.displayName
          || sender.profile?.userName
          || sender.email
          || 'Unknown';

        const senderUser: SenderUser = {
          id: transfer.fromUserId,
          senderName,
          senderTitle: sender.titles?.[0]?.title ?? '',
          senderAvatar: sender.avatars?.[0]?.imageUrl ?? '',
        };

        const tipsInfo: TipsInfo = {
          id: transfer.id,
          sender: senderUser,
          amount: typeof transfer.amount === 'number' ? transfer.amount : Number(transfer.amount),
          message: transfer.reason || '',
          timestamp: transfer.createdAt.toISOString(),
        };

        threadItems.push({
          id: transfer.id,
          type: 'send-tips' as MessageType,
          data: tipsInfo,
        });
      }

      // 3. Thread kullanıcıları arasındaki Support Request'leri getir
      const supportRequests = await this.prisma.dMRequest.findMany({
        where: {
          OR: [
            { fromUserId: thread.userOneId, toUserId: thread.userTwoId },
            { fromUserId: thread.userTwoId, toUserId: thread.userOneId },
          ],
          description: { not: null }, // Sadece support request'ler (description olanlar)
        },
        include: {
          fromUser: {
            include: {
              profile: true,
              titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
              avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
          toUser: {
            include: {
              profile: true,
              titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
              avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { sentAt: 'desc' },
      });

      for (const request of supportRequests) {
        if (!request.description) continue;

        const isFromUser = request.fromUserId === userIdStr;
        const counterpart = isFromUser ? request.toUser : request.fromUser;
        if (!counterpart) continue;

        const senderName = counterpart.profile?.displayName
          || counterpart.profile?.userName
          || counterpart.email
          || 'Unknown';

        const sender: SenderUser = {
          id: isFromUser ? request.toUserId : request.fromUserId,
          senderName,
          senderTitle: counterpart.titles?.[0]?.title ?? '',
          senderAvatar: counterpart.avatars?.[0]?.imageUrl ?? '',
        };

        // Map DMRequestStatus to SupportRequestStatus
        let status: SupportRequestStatus;
        if (request.status === DMRequestStatus.PENDING) {
          status = 'pending';
        } else if (request.status === DMRequestStatus.ACCEPTED) {
          status = 'accepted';
        } else {
          status = 'rejected';
        }

        // SupportType mapping
        const dmRequestWithType = request as typeof request & { type: string; amount: number | any };
        const prismaType = dmRequestWithType.type;
        const supportType: SupportType = 
          prismaType === 'GENERAL' || prismaType === 'TECHNICAL' || prismaType === 'PRODUCT'
            ? prismaType
            : 'GENERAL';

        const amount = typeof dmRequestWithType.amount === 'number'
          ? dmRequestWithType.amount
          : Number(dmRequestWithType.amount) || 0;

        const supportRequest: SupportRequest = {
          id: request.id,
          sender,
          type: supportType,
          message: request.description,
          amount,
          status,
          timestamp: request.sentAt.toISOString(),
        };

        threadItems.push({
          id: request.id,
          type: 'support-request' as MessageType,
          data: supportRequest,
        });
      }

      // 4. Tüm item'ları timestamp'e göre sırala (en yeni önce)
      threadItems.sort((a, b) => {
        const timestampA = this.getTimestampFromFeedItem(a);
        const timestampB = this.getTimestampFromFeedItem(b);
        return new Date(timestampB).getTime() - new Date(timestampA).getTime();
      });

      // 5. Limit ve offset uygula
      const paginatedItems = threadItems.slice(offset, offset + limit);

      return paginatedItems;
    } catch (error) {
      logger.error(`Failed to get messages for thread ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * MessageFeedItem'dan timestamp çıkar
   */
  private getTimestampFromFeedItem(item: MessageFeedItem): string {
    if (item.type === 'message') {
      return (item.data as Message).timestamp;
    } else if (item.type === 'send-tips') {
      return (item.data as TipsInfo).timestamp;
    } else if (item.type === 'support-request') {
      return (item.data as SupportRequest).timestamp;
    }
    return new Date().toISOString(); // Fallback
  }

  /**
   * Kullanıcının thread'lerini al
   */
  async getUserThreads(userId: string): Promise<DMThread[]> {
    try {
      const threads = await this.dmThreadRepo.findByUserId(String(userId));
      return threads;
    } catch (error) {
      logger.error(`Failed to get threads for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının okunmamış mesaj sayısını al
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    try {
      const count = await this.dmMessageRepo.getUnreadCountByUserId(String(userId));
      return count;
    } catch (error) {
      logger.error(`Failed to get unread message count for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserInboxMessages(userId: string, options: InboxQueryOptions = {}): Promise<InboxMessageItem[]> {
    try {
      const threads = await this.dmThreadRepo.findDetailedByUserId(userId, options);
      const userIdStr = String(userId);

      return threads.map((thread) => {
        const isUserOne = thread.userOneId === userIdStr;
        const counterpart = (isUserOne ? thread.userTwo : thread.userOne) as any;
        const unreadCount = isUserOne ? thread.unreadCountUserOne : thread.unreadCountUserTwo;
        const lastMessage = thread.messages?.[0];
        const timestamp = (lastMessage?.sentAt ?? thread.updatedAt).toISOString();

        const senderName = counterpart?.profile?.displayName
          || counterpart?.profile?.userName
          || counterpart?.name
          || counterpart?.email
          || 'Unknown';

        const senderTitle = counterpart?.titles?.[0]?.title ?? null;
        const senderAvatar = counterpart?.avatars?.[0]?.imageUrl ?? null;

        return {
          id: thread.id,
          senderName,
          senderTitle,
          senderAvatar,
          lastMessage: lastMessage?.message ?? null,
          timestamp,
          isUnread: unreadCount > 0,
          unreadCount,
        } satisfies InboxMessageItem;
      });
    } catch (error) {
      logger.error(`Failed to get inbox messages for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının mesaj feed'ini getir (mesajlar, support request'ler, TIPS birleşik)
   */
  async getUserMessageFeed(userId: string, limit = 50): Promise<MessageFeed> {
    try {
      const userIdStr = String(userId);
      const feedItems: MessageFeedItem[] = [];

      // 1. Mesajları getir (thread'lerden)
      const threads = await this.dmThreadRepo.findDetailedByUserId(userIdStr, { limit: 100 });
      for (const thread of threads) {
        const isUserOne = thread.userOneId === userIdStr;
        const counterpart = (isUserOne ? thread.userTwo : thread.userOne) as any;
        const lastMessage = thread.messages?.[0];

        if (!lastMessage) continue;

        const senderName = counterpart?.profile?.displayName
          || counterpart?.profile?.userName
          || counterpart?.name
          || counterpart?.email
          || 'Unknown';

        const senderTitle = counterpart?.titles?.[0]?.title ?? '';
        const senderAvatar = counterpart?.avatars?.[0]?.imageUrl ?? '';

        const sender: SenderUser = {
          id: isUserOne ? thread.userTwoId : thread.userOneId,
          senderName,
          senderTitle,
          senderAvatar,
        };

        const message: Message = {
          id: thread.id,
          sender,
          lastMessage: lastMessage.message,
          timestamp: lastMessage.sentAt.toISOString(),
          isUnread: (isUserOne ? thread.unreadCountUserOne : thread.unreadCountUserTwo) > 0,
        };

        feedItems.push({
          id: thread.id,
          type: 'message' as MessageType,
          data: message,
        });
      }

      // 2. Support Request'leri getir
      const supportRequests = await this.supportRequestService.getUserSupportRequests(userIdStr, { limit: 100 });
      for (const request of supportRequests) {
        // Support request'ten sender bilgilerini al
        const dmRequest = await this.prisma.dMRequest.findUnique({
          where: { id: request.id },
          include: {
            fromUser: {
              include: {
                profile: true,
                titles: {
                  orderBy: { earnedAt: 'desc' },
                  take: 1,
                },
                avatars: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
            toUser: {
              include: {
                profile: true,
                titles: {
                  orderBy: { earnedAt: 'desc' },
                  take: 1,
                },
                avatars: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        });

        if (!dmRequest) continue;

        const isFromUser = dmRequest.fromUserId === userIdStr;
        const counterpart = isFromUser ? dmRequest.toUser : dmRequest.fromUser;
        
        if (!counterpart) continue;

        const senderName = counterpart.profile?.displayName
          || counterpart.profile?.userName
          || counterpart.email
          || 'Unknown';

        const sender: SenderUser = {
          id: isFromUser ? dmRequest.toUserId : dmRequest.fromUserId,
          senderName,
          senderTitle: counterpart.titles?.[0]?.title ?? '',
          senderAvatar: counterpart.avatars?.[0]?.imageUrl ?? '',
        };

        // Map DMRequestStatus to SupportRequestStatus
        let status: SupportRequestStatus;
        if (dmRequest.status === DMRequestStatus.PENDING) {
          status = 'pending';
        } else if (dmRequest.status === DMRequestStatus.ACCEPTED) {
          status = 'accepted';
        } else {
          status = 'rejected';
        }

        // SupportType mapping - Prisma enum'ından domain enum'a
        // Type assertion needed until TypeScript picks up the updated Prisma types
        const dmRequestWithType = dmRequest as typeof dmRequest & { type: string; amount: number | any };
        const prismaType = dmRequestWithType.type;
        const supportType: SupportType = 
          prismaType === 'GENERAL' || prismaType === 'TECHNICAL' || prismaType === 'PRODUCT'
            ? prismaType
            : 'GENERAL';

        // Convert amount (may be Decimal) to number
        const amount = typeof dmRequestWithType.amount === 'number'
          ? dmRequestWithType.amount
          : Number(dmRequestWithType.amount) || 0;

        const supportRequest: SupportRequest = {
          id: request.id,
          sender,
          type: supportType,
          message: request.requestDescription,
          amount,
          status,
          timestamp: dmRequest.sentAt.toISOString(),
        };

        feedItems.push({
          id: request.id,
          type: 'support-request' as MessageType,
          data: supportRequest,
        });
      }

      // 3. TIPS transferlerini getir
      const tipsTransfers = await this.prisma.tipsTokenTransfer.findMany({
        where: {
          OR: [
            { fromUserId: userIdStr },
            { toUserId: userIdStr },
          ],
        },
        include: {
          fromUser: {
            include: {
              profile: true,
              titles: true,
              avatars: true,
            },
          },
          toUser: {
            include: {
              profile: true,
              titles: true,
              avatars: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const transfer of tipsTransfers) {
        // Sadece kullanıcıya gönderilen TIPS'leri göster (alıcı olduğu)
        if (transfer.toUserId !== userIdStr) continue;

        const sender = transfer.fromUser;
        if (!sender) continue;

        const senderName = sender.profile?.displayName
          || sender.profile?.userName
          || sender.email
          || 'Unknown';

        const senderUser: SenderUser = {
          id: transfer.fromUserId,
          senderName,
          senderTitle: sender.titles?.[0]?.title ?? '',
          senderAvatar: sender.avatars?.[0]?.imageUrl ?? '',
        };

        const tipsInfo: TipsInfo = {
          id: transfer.id,
          sender: senderUser,
          amount: transfer.amount,
          message: transfer.reason || '',
          timestamp: transfer.createdAt.toISOString(),
        };

        feedItems.push({
          id: transfer.id,
          type: 'send-tips' as MessageType,
          data: tipsInfo,
        });
      }

      // Tüm feed item'larını timestamp'e göre sırala (en yeni önce)
      feedItems.sort((a, b) => {
        const timestampA = this.getTimestampFromFeedItem(a);
        const timestampB = this.getTimestampFromFeedItem(b);
        return new Date(timestampB).getTime() - new Date(timestampA).getTime();
      });

      // Limit uygula
      const limitedItems = feedItems.slice(0, limit);

      return { messages: limitedItems };
    } catch (error) {
      logger.error(`Failed to get message feed for user ${userId}:`, error);
      throw error;
    }
  }

}
