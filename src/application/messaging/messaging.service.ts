import { DMThread } from '../../domain/messaging/dm-thread.entity';
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
    // Sadece normal DM thread'leri kontrol et (support thread'leri hariç)
    const existing = await this.prisma.dMThread.findFirst({
      where: {
        isSupportThread: false, // Sadece normal DM thread'leri
        OR: [
          { userOneId: senderId, userTwoId: recipientId },
          { userOneId: recipientId, userTwoId: senderId },
        ],
      },
    });

    if (existing) return existing;

    // Yeni normal DM thread oluştur
    return await this.prisma.dMThread.create({
      data: {
        userOneId: senderId,
        userTwoId: recipientId,
        isActive: true,
        isSupportThread: false, // Normal DM thread
        startedAt: new Date(),
      },
    });
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
        context: "DM",
        sentAt: new Date(),
      },
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
      senderId: senderId,
      recipientId: recipientId,
      message,
      messageType: 'message' as const,
      context: "DM",
      timestamp: createdMessage.sentAt.toISOString(),
    };

    // Alıcıya kendi odasına gönder
    socketHandler.sendMessageToUser(recipientId, 'new_message', newMessageEvent);
    
    // Thread room'una gönder (her iki kullanıcı da thread room'unda olabilir)
    socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', newMessageEvent);

    // Göndericiye message_sent event'i gönder
    socketHandler.sendMessageToUser(senderId, 'message_sent', newMessageEvent);

    logger.info(`Direct message sent from ${senderId} to ${recipientId}, socket events emitted`);
  }

  async sendTips(senderId: string, recipientId: string, amount: number, tipsMessage?: string) {
    const tipsTransfer = await this.prisma.tipsTokenTransfer.create({
      data: {
        fromUserId: senderId,
        toUserId: recipientId,
        amount,
        reason: tipsMessage || null,
      },
    });

    const body = tipsMessage
      ? `Sent ${amount} TIPS: ${tipsMessage}`
      : `Sent ${amount} TIPS`;

    // Thread oluştur veya mevcut thread'i al
    const thread = await this.createThreadIfNotExists(senderId, recipientId);

    // Mesaj oluştur (tips mesajı için DM mesajı oluşturuluyor)
    await this.prisma.dMMessage.create({
      data: {
        threadId: thread.id,
        senderId: senderId,
        message: body,
        isRead: false,
        context: "DM",
        sentAt: new Date(),
      },
    });

    await this.prisma.dMThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const tipsEvent = {
      messageId: tipsTransfer.id,
      threadId: thread.id,
      senderId: senderId,
      recipientId: recipientId,
      message: tipsMessage || '',
      messageType: 'send-tips' as const,
      amount,
      context: "DM",
      timestamp: tipsTransfer.createdAt.toISOString(),
    };

    socketHandler.sendMessageToUser(recipientId, 'new_message', tipsEvent);
    socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', tipsEvent);
    socketHandler.sendMessageToUser(senderId, 'message_sent', tipsEvent);

    logger.info(`TIPS sent from ${senderId} to ${recipientId}, amount: ${amount}, socket events emitted`);
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

      // Okundu bildirimi gönder
      const senderId = message.senderId;
      const socketHandler = SocketManager.getInstance().getSocketHandler();
      const readEvent = {
        messageId: message.id,
        threadId: thread.id,
        readBy: userIdStr,
        timestamp: new Date().toISOString(),
      };

      // Göndericiye okundu bildirimi gönder (thread açık değilse bile bildirim gelsin)
      socketHandler.sendMessageToUser(senderId, 'message_read', readEvent);
      
      // Thread room'una da gönder (thread açık olan kullanıcılar için)
      socketHandler.sendToRoom(`thread:${thread.id}`, 'message_read', readEvent);

      logger.info(`Message ${messageId} marked as read by user ${userId}`);
    } catch (error) {
      logger.error(`Failed to mark message ${messageId} as read by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Thread'deki tüm mesajları okundu olarak işaretle (join_thread için)
   */
  async markAllMessagesAsReadInThread(threadId: string, userId: string): Promise<void> {
    try {
      // Thread erişim kontrolü
      const hasAccess = await this.validateThreadAccess(threadId, userId);
      if (!hasAccess) {
        throw new Error('User is not a participant of this thread');
      }

      // Okunmamış mesajları bul
      const unreadMessages = await this.prisma.dMMessage.findMany({
        where: {
          threadId,
          senderId: { not: userId },
          isRead: false,
        },
        select: {
          id: true,
          senderId: true,
        },
      });

      if (unreadMessages.length === 0) {
        return; // Okunmamış mesaj yok
      }

      // Tüm mesajları okundu olarak işaretle
      await this.dmMessageRepo.markAllAsReadInThread(threadId, userId);

      // Her mesaj için message_read event'i gönder
      const socketHandler = SocketManager.getInstance().getSocketHandler();
      const timestamp = new Date().toISOString();

      for (const message of unreadMessages) {
        const senderId = message.senderId;
        socketHandler.sendMessageToUser(senderId, 'message_read', {
          messageId: message.id,
          threadId,
          readBy: userId,
          timestamp,
        });

        // Thread room'una da gönder
        socketHandler.sendToRoom(`thread:${threadId}`, 'message_read', {
          messageId: message.id,
          threadId,
          readBy: userId,
          timestamp,
        });
      }

      logger.info(`Marked ${unreadMessages.length} messages as read in thread ${threadId} by user ${userId}`);
    } catch (error) {
      logger.error(`Failed to mark all messages as read in thread ${threadId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Thread'i ID ile getir
   */
  async getThreadById(threadId: string): Promise<DMThread | null> {
    try {
      return await this.dmThreadRepo.findById(threadId);
    } catch (error) {
      logger.error(`Failed to get thread by ID ${threadId}:`, error);
      return null;
    }
  }

  /**
   * Kullanıcının thread'e erişim yetkisi olup olmadığını kontrol et
   */
  async validateThreadAccess(threadId: string, userId: string): Promise<boolean> {
    try {
      const thread = await this.dmThreadRepo.findById(threadId);
      if (!thread) {
        return false;
      }

      const userIdStr = userId;
      const isParticipant = thread.userOneId === userIdStr || thread.userTwoId === userIdStr;
      return isParticipant;
    } catch (error) {
      logger.error(`Failed to validate thread access for thread ${threadId} and user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Thread'deki tüm mesajları al (DMMessage, TIPS, Support Request birleşik)
   */
  async getThreadMessages(threadId: string, userId: string, limit = 100, offset = 0): Promise<MessageFeedItem[]> {
    try {
      // Thread'e erişim kontrolü
      const thread = await this.dmThreadRepo.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

        const userIdStr = userId;
      const isParticipant = thread.userOneId === userIdStr || thread.userTwoId === userIdStr;
      if (!isParticipant) {
        throw new Error('User is not a participant of this thread');
      }

      const threadItems: MessageFeedItem[] = [];

      // Thread tipi kontrolü: Support thread ise sadece SUPPORT context'li mesajlar döndür
      const isSupportThread = thread.isSupportContext();

      // SUPPORT THREAD: Sadece SUPPORT context'li mesajları döndür
      if (isSupportThread) {
        // Sadece SUPPORT context'li mesajları getir (DM, NULL veya TIPS mesajlarını hariç tut)
        const allMessages = await this.prisma.dMMessage.findMany({
          where: { 
            threadId,
          },
          include: {
            sender: {
              include: {
                profile: true,
                titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
                avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
          },
          orderBy: { sentAt: 'asc' },
          take: Math.min(limit * 2, 1000), // Biraz fazla al, sonra filtrele
        });

        // Sadece SUPPORT context'li ve TIPS olmayan mesajları dahil et
        const supportMessages = allMessages.filter((msg) => {
          const context = msg.context;
          const messageText = msg.message || '';
          
          // SUPPORT context kontrolü
          const isSupportContext = context === "SUPPORT";
          
          // TIPS mesajı kontrolü - TIPS mesajlarını hariç tut
          const isTipsMessage = messageText.includes('Sent') && messageText.includes('TIPS');
          
          // Sadece SUPPORT context'li ve TIPS olmayan mesajları dahil et
          return isSupportContext && !isTipsMessage;
        });

        for (const message of supportMessages) {
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

        // Support thread'lerde sadece mesajlar var, TIPS ve support-request yok
        // Timestamp'e göre sırala (zaten asc ile geliyor)
        const paginatedItems = threadItems.slice(offset, offset + limit);
        logger.info(`Support thread ${threadId} messages: total=${threadItems.length}, messages=${threadItems.length}`);
        return paginatedItems;
      }

      // NORMAL DM THREAD: DM context'li mesajlar + TIPS + support-request
      // 1. DMMessage'ları getir (DM context'li veya context'i olmayan mesajlar)
      // Eski mesajların context'i NULL olabilir, onları da dahil et
      const allMessages = await this.prisma.dMMessage.findMany({
        where: { 
          threadId,
        },
        include: {
          sender: {
            include: {
              profile: true,
              titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
              avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { sentAt: 'asc' }, // En eski önce al, sonra timestamp'e göre sıralayacağız
        take: 1000, // Tüm mesajları al, sonra sıralayacağız
      });
      
      // DM context'li mesajları filtrele (SUPPORT context'li mesajları hariç tut)
      const messages = allMessages.filter((msg) => {
        const context = msg.context;
        // NULL, undefined veya DM olan mesajları dahil et, SUPPORT olanları hariç tut
        return context === null || context === undefined || context === "DM";
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

        // TIPS mesajı kontrolü - message içeriğine göre
        const isTipsMessage = message.message.includes('Sent') && message.message.includes('TIPS');
        
        // TIPS mesajlarını atla - zaten TipsTokenTransfer'den alıyoruz (duplicate önlemek için)
        if (isTipsMessage) {
          continue; // TIPS mesajlarını DMMessage'den ekleme, sadece TipsTokenTransfer'den al
        }

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
        orderBy: { createdAt: 'asc' }, // En eski önce, sonra timestamp'e göre sıralayacağız
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
      // Sadece normal DM thread'lerde support request'leri göster (support thread'lerde değil)
        const supportRequests = await this.prisma.dMRequest.findMany({
          where: {
            OR: [
              { fromUserId: thread.userOneId, toUserId: thread.userTwoId },
              { fromUserId: thread.userTwoId, toUserId: thread.userOneId },
            ],
            description: { not: null }, // Sadece support request'ler (description olanlar)
          },
          orderBy: { sentAt: 'asc' }, // En eski önce (sıralama için)
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
        });

      // Her support request için threadId artık direkt DMRequest.threadId field'ından alınacak
      // Her request accept edildiğinde yeni bir thread oluşturulur ve threadId DMRequest'e kaydedilir
        for (const request of supportRequests) {
          if (!request.description) continue;

          // Sender her zaman request'i oluşturan kişidir (fromUser)
          const senderUser = request.fromUser;
          if (!senderUser) continue;

          const senderName = senderUser.profile?.displayName
            || senderUser.profile?.userName
            || senderUser.email
            || 'Unknown';

          const sender: SenderUser = {
            id: request.fromUserId,
            senderName,
            senderTitle: senderUser.titles?.[0]?.title ?? '',
            senderAvatar: senderUser.avatars?.[0]?.imageUrl ?? '',
          };

        // Map DMRequestStatus to SupportRequestStatus
        let status: SupportRequestStatus;
        const requestStatus = request.status as string;
        if (requestStatus === DMRequestStatus.PENDING || requestStatus === 'PENDING') {
          status = 'pending';
        } else if (requestStatus === DMRequestStatus.ACCEPTED || requestStatus === 'ACCEPTED') {
          status = 'accepted';
        } else if (requestStatus === DMRequestStatus.CANCELED || requestStatus === 'CANCELED') {
          status = 'canceled';
        } else if (requestStatus === DMRequestStatus.AWAITING_COMPLETION || requestStatus === 'AWAITING_COMPLETION') {
          status = 'awaiting_completion';
        } else if (requestStatus === DMRequestStatus.COMPLETED || requestStatus === 'COMPLETED') {
          status = 'completed';
        } else if (requestStatus === DMRequestStatus.REPORTED || requestStatus === 'REPORTED') {
          status = 'reported';
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

        // DM ekranında support chat mesajlarını yüklemiyoruz
        // Support chat açıldığında threadId ile GET /messages/{threadId} çağrısı yapılacak
        // ThreadId artık direkt DMRequest.threadId field'ından alınacak
        const requestThreadId = request.threadId ?? null;
        const supportRequest: SupportRequest = {
          id: request.id,
          sender,
          type: supportType,
          message: request.description,
          amount,
          status,
          timestamp: request.sentAt.toISOString(),
          threadId: requestThreadId ?? null,
          requestId: request.id,
          fromUserId: request.fromUserId,
          toUserId: request.toUserId,
        };

        threadItems.push({
          id: request.id,
          type: 'support-request' as MessageType,
          data: supportRequest,
        });
      }

      // 4. Tüm item'ları timestamp'e göre sırala (en eski önce - WhatsApp tarzı)
      threadItems.sort((a, b) => {
        const timestampA = this.getTimestampFromFeedItem(a);
        const timestampB = this.getTimestampFromFeedItem(b);
        return new Date(timestampA).getTime() - new Date(timestampB).getTime();
      });

      // Debug log: Support request sayısını kontrol et
      const supportRequestCount = threadItems.filter(item => item.type === 'support-request').length;
      logger.info(`DM thread ${threadId} messages: total=${threadItems.length}, support-requests=${supportRequestCount}, messages=${threadItems.filter(item => item.type === 'message').length}, tips=${threadItems.filter(item => item.type === 'send-tips').length}`);

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
        const counterpart = isUserOne ? thread.userTwo : thread.userOne;
        const unreadCount = isUserOne ? thread.unreadCountUserOne : thread.unreadCountUserTwo;
        const lastMessage = thread.messages?.[0];
        const timestamp = (lastMessage?.sentAt ?? thread.updatedAt).toISOString();

        const senderName = counterpart?.profile?.displayName
          || counterpart?.profile?.userName
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
      const userIdStr = userId;
      const feedItems: MessageFeedItem[] = [];

      // 1. Mesajları getir (thread'lerden)
      const threads = await this.dmThreadRepo.findDetailedByUserId(userIdStr, { limit: 100 });
      for (const thread of threads) {
        const isUserOne = thread.userOneId === userIdStr;
        const counterpart = isUserOne ? thread.userTwo : thread.userOne;
        const lastMessage = thread.messages?.[0];

        if (!lastMessage) continue;

        const senderName = counterpart?.profile?.displayName
          || counterpart?.profile?.userName
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

        const requestCreator = dmRequest.fromUser;
        if (!requestCreator) continue;

        const senderName = requestCreator.profile?.displayName
          || requestCreator.profile?.userName
          || requestCreator.email
          || 'Unknown';

        const sender: SenderUser = {
          id: dmRequest.fromUserId,
          senderName,
          senderTitle: requestCreator.titles?.[0]?.title ?? '',
          senderAvatar: requestCreator.avatars?.[0]?.imageUrl ?? '',
        };

        // Map DMRequestStatus to SupportRequestStatus
        let status: SupportRequestStatus;
        const requestStatus = dmRequest.status as string;
        if (requestStatus === DMRequestStatus.PENDING || requestStatus === 'PENDING') {
          status = 'pending';
        } else if (requestStatus === DMRequestStatus.ACCEPTED || requestStatus === 'ACCEPTED') {
          status = 'accepted';
        } else if (requestStatus === DMRequestStatus.CANCELED || requestStatus === 'CANCELED') {
          status = 'canceled';
        } else if (requestStatus === DMRequestStatus.AWAITING_COMPLETION || requestStatus === 'AWAITING_COMPLETION') {
          status = 'awaiting_completion';
        } else if (requestStatus === DMRequestStatus.COMPLETED || requestStatus === 'COMPLETED') {
          status = 'completed';
        } else if (requestStatus === DMRequestStatus.REPORTED || requestStatus === 'REPORTED') {
          status = 'reported';
        } else {
          status = 'rejected';
        }

        // SupportType mapping - Prisma enum'ından domain enum'a
        // Type assertion needed until TypeScript picks up the updated Prisma types
        const dmRequestWithType = dmRequest as typeof dmRequest & { type: string; amount: number };
        const prismaType = dmRequestWithType.type;
        const supportType: SupportType = 
          prismaType === 'GENERAL' || prismaType === 'TECHNICAL' || prismaType === 'PRODUCT'
            ? prismaType
            : 'GENERAL';

        // Convert amount (may be Decimal) to number
        const amount = typeof dmRequestWithType.amount === 'number'
          ? dmRequestWithType.amount
          : Number(dmRequestWithType.amount) || 0;

        // Feed'de messages array'i kullanılmıyor (sadece özet gösteriliyor)
        // Thread items yüklendiğinde messages array'i dolu gelecek
        const supportRequest: SupportRequest = {
          id: request.id,
          sender,
          type: supportType,
          message: request.requestDescription,
          amount,
          status,
          timestamp: dmRequest.sentAt.toISOString(),
          threadId: dmRequest.threadId ?? null,
          requestId: request.id,
          fromUserId: dmRequest.fromUserId,
          toUserId: dmRequest.toUserId,
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

      // Tüm feed item'larını timestamp'e göre sırala (en eski önce - WhatsApp tarzı)
      feedItems.sort((a, b) => {
        const timestampA = this.getTimestampFromFeedItem(a);
        const timestampB = this.getTimestampFromFeedItem(b);
        return new Date(timestampA).getTime() - new Date(timestampB).getTime();
      });

      // Limit uygula
      const limitedItems = feedItems.slice(0, limit);

      return { messages: limitedItems };
    } catch (error) {
      logger.error(`Failed to get message feed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Support chat mesajlarını getir (belirli bir support request'e ait SUPPORT context'li mesajlar)
   */
  /**
   * @deprecated Bu metod artık kullanılmıyor. getThreadMessages metodunu kullanın.
   * getThreadMessages thread'in is_support_thread değerine göre otomatik olarak doğru veri döndürür.
   */
  async getSupportChatMessages(
    threadId: string,
    userId: string,
    _supportRequestId?: string,
    limit = 200,
  ): Promise<MessageFeedItem[]> {
    // getThreadMessages'ı kullan (thread'in is_support_thread değerine göre otomatik olarak SUPPORT mesajları döner)
    return this.getThreadMessages(threadId, userId, limit, 0);
  }

  /**
   * Support chat mesajı gönder
   */
  async sendSupportChatMessage(threadId: string, senderId: string, message: string): Promise<void> {
    try {
      // Thread'e erişim kontrolü
      const thread = await this.dmThreadRepo.findById(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      if (!thread.isSupportContext()) {
        throw new Error('Thread is not a support chat');
      }

      const userIdStr = senderId;
      if (!thread.belongsToUser(userIdStr)) {
        throw new Error('User is not a participant of this thread');
      }

      const recipientId = thread.getOtherUserId(userIdStr);

      // Support context ile mesaj oluştur
      const createdMessage = await this.prisma.dMMessage.create({
        data: {
          threadId,
          senderId: userIdStr,
          message,
          isRead: false,
          context: "SUPPORT",
          sentAt: new Date(),
        },
      });

      await this.prisma.dMThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });

      // Socket bildirimi gönder - new_message event'i (context: SUPPORT)
      const socketHandler = SocketManager.getInstance().getSocketHandler();
      const newMessageEvent = {
        messageId: createdMessage.id,
        threadId: thread.id,
        senderId: userIdStr,
        recipientId,
        message,
        messageType: 'message' as const,
        context: "SUPPORT",
        timestamp: createdMessage.sentAt.toISOString(),
      };

      // Alıcıya kendi odasına gönder
        socketHandler.sendMessageToUser(recipientId, 'new_message', newMessageEvent);
      
      // Thread room'una gönder
      socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', newMessageEvent);

      // Göndericiye message_sent event'i gönder
      socketHandler.sendMessageToUser(userIdStr, 'message_sent', newMessageEvent);

      logger.info(`Support chat message sent from ${senderId} to ${recipientId} in thread ${threadId}, socket events emitted`);
    } catch (error) {
      logger.error(`Failed to send support chat message:`, error);
      throw error;
    }
  }

}
