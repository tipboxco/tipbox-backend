import { DMThread } from '../../domain/messaging/dm-thread.entity';
import { DMMessage } from '../../domain/messaging/dm-message.entity';
import { DmMessagePrismaRepository } from '../../infrastructure/repositories/dm-message-prisma.repository';
import { DMThreadPrismaRepository } from '../../infrastructure/repositories/dm-thread-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { MessageReactionPrismaRepository } from '../../infrastructure/repositories/message-reaction-prisma.repository';
import { MessageReadReceiptPrismaRepository } from '../../infrastructure/repositories/message-read-receipt-prisma.repository';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { WalletService } from '../wallet/wallet.service';
import { TransactionService } from '../transaction/transaction.service';
import logger from '../../infrastructure/logger/logger';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
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
} from '../../interfaces/inbox/inbox.dto';
import { SupportRequestService } from './support-request.service';
import { DMRequestStatus } from '../../domain/messaging/dm-request-status.enum';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { S3Service } from '../../infrastructure/s3/s3.service';

export interface InboxMessageItem {
  id: string;
  recipientUserId: string; // Karşı tarafın (diğer kullanıcının) ID'si
  senderName: string;
  senderTitle: string | null;
  senderAvatar: string | null;
  lastMessage: string | null;
  timestamp: string;
  isUnread: boolean;
  unreadCount: number;
  threadType?: 'DM' | 'SUPPORT'; // Thread tipi bilgisi (opsiyonel)
}

export interface InboxQueryOptions {
  search?: string;
  unreadOnly?: boolean;
  limit?: number;
  threadType?: 'DM' | 'SUPPORT' | 'ALL'; // Thread tipi filtresi
  cursor?: string; // Pagination cursor (timestamp)
}

export class MessagingService {
  private dmMessageRepo = new DmMessagePrismaRepository();
  private dmThreadRepo = new DMThreadPrismaRepository();
  private userRepo = new UserPrismaRepository();
  private messageReactionRepo = new MessageReactionPrismaRepository();
  private messageReadReceiptRepo = new MessageReadReceiptPrismaRepository();
  private supportRequestService = new SupportRequestService();
  private notificationService = new NotificationService();
  private walletService = new WalletService();
  private transactionService = new TransactionService();
  private s3Service = new S3Service();
  private prisma = getPrisma();
  async createThreadIfNotExists(senderId: string, recipientId: string) {
    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const senderIdStr = String(senderId).trim();
    const recipientIdStr = String(recipientId).trim();
    
    if (!uuidRegex.test(senderIdStr)) {
      throw new Error(`Invalid senderId format: ${senderIdStr}. Must be a valid UUID.`);
    }
    
    if (!uuidRegex.test(recipientIdStr)) {
      throw new Error(`Invalid recipientId format: ${recipientIdStr}. Must be a valid UUID.`);
    }

    // Sadece normal DM thread'leri kontrol et (support thread'leri hariç)
    const existing = await this.prisma.dMThread.findFirst({
      where: {
        isSupportThread: false, // Sadece normal DM thread'leri
        OR: [
          { userOneId: senderIdStr, userTwoId: recipientIdStr },
          { userOneId: recipientIdStr, userTwoId: senderIdStr },
        ],
      },
    });

    if (existing) return existing;

    // Yeni normal DM thread oluştur
    return await this.prisma.dMThread.create({
      data: {
        userOneId: senderIdStr,
        userTwoId: recipientIdStr,
        isActive: true,
        isSupportThread: false, // Normal DM thread
        startedAt: new Date(),
      },
    });
  }

  async sendDirectMessage(senderId: string, recipientId: string, message: string) {
    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const senderIdStr = String(senderId).trim();
    const recipientIdStr = String(recipientId).trim();
    
    if (!uuidRegex.test(senderIdStr)) {
      throw new Error(`Invalid senderId format: ${senderIdStr}. Must be a valid UUID.`);
    }
    
    if (!uuidRegex.test(recipientIdStr)) {
      throw new Error(`Invalid recipientId format: ${recipientIdStr}. Must be a valid UUID.`);
    }

    const sender = await this.userRepo.findById(senderIdStr);
    const recipient = await this.userRepo.findById(recipientIdStr);
    if (!sender || !recipient) throw new Error('User not found');

    const thread = await this.createThreadIfNotExists(senderId, recipientId);

    // Repository kullanarak mesaj oluştur (unread count increment için)
    const createdMessage = await this.dmMessageRepo.create({
      threadId: thread.id,
      senderId: String(senderId),
      message,
      isRead: false,
      context: "DM",
      sentAt: new Date(),
    } as any);

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

    // NEW_MESSAGE bildirimi kaldırıldı - zaten inbox ekranında görüntülenecek
    // Sadece önemli durumlar için bildirim gönderilecek (DM_REQUEST_ACCEPTED, SUPPORT_REQUEST_ACCEPTED)

    logger.info(`Direct message sent from ${senderId} to ${recipientId}, socket events emitted`);
  }

  /**
   * Mesaj ile birlikte medya gönder (fotoğraf, video, ses, dosya)
   */
  async sendDirectMessageWithMedia(
    senderId: string,
    recipientId: string,
    message: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    fileName?: string,
    fileSize?: bigint,
    thumbnailUrl?: string
  ) {
    const sender = await this.userRepo.findById(String(senderId));
    const recipient = await this.userRepo.findById(String(recipientId));
    if (!sender || !recipient) throw new Error('User not found');

    const thread = await this.createThreadIfNotExists(senderId, recipientId);

    // Mesaj ile birlikte medya oluştur (repository kullanarak)
    // Context field'ı entity'de yok ama Prisma'da var, bu yüzden any kullanıyoruz
    const messageData: any = {
      threadId: thread.id,
      senderId: String(senderId),
      message: message , // Mesaj yoksa boş string
      isRead: false,
      sentAt: new Date(),
      mediaUrl,
      mediaType,
      thumbnailUrl,
      fileName,
      fileSize,
      caption: message || undefined, // Caption olarak mesajı kullan
      context: "DM", // Context field'ı entity'de yok ama Prisma'da var
    };
    const createdMessage = await this.dmMessageRepo.create(messageData);

    await this.prisma.dMThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    // Socket bildirimi gönder - new_message event'i (media bilgileri ile)
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const newMessageEvent = {
      messageId: createdMessage.id,
      threadId: thread.id,
      senderId: senderId,
      recipientId: recipientId,
      message: message || '',
      messageType: mediaType as 'image' | 'video' | 'audio' | 'file',
      mediaUrl,
      thumbnailUrl: thumbnailUrl || null,
      fileName: fileName || null,
      fileSize: fileSize ? Number(fileSize) : null,
      caption: message || null,
      context: "DM",
      timestamp: createdMessage.sentAt.toISOString(),
    };

    // Alıcıya kendi odasına gönder
    socketHandler.sendMessageToUser(recipientId, 'new_message', newMessageEvent);
    
    // Thread room'una gönder (her iki kullanıcı da thread room'unda olabilir)
    socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', newMessageEvent);

    // Göndericiye message_sent event'i gönder
    socketHandler.sendMessageToUser(senderId, 'message_sent', newMessageEvent);

    logger.info(`Direct message with media (${mediaType}) sent from ${senderId} to ${recipientId}, socket events emitted`);
  }

  async sendTips(senderId: string, recipientId: string, amount: number, tipsMessage?: string) {
    // Validate that both sender and recipient users exist
    const [sender, recipient] = await Promise.all([
      this.prisma.user.findUnique({ 
        where: { id: senderId },
        include: { profile: true }
      }),
      this.prisma.user.findUnique({ 
        where: { id: recipientId },
        include: { profile: true }
      }),
    ]);

    if (!sender) {
      throw new Error(`Sender user not found: ${senderId}`);
    }

    if (!recipient) {
      throw new Error(`Recipient user not found: ${recipientId}`);
    }

    // Use TransactionService.sendTip to handle:
    // - Wallet balance checks
    // - Transaction creation (SEND & RECEIVE)
    // - Balance updates
    // - Notifications
    const { transaction } = await this.transactionService.sendTip({
      fromUserId: senderId,
      toUserId: recipientId,
      amount,
      reason: tipsMessage || 'TIPS via messaging',
    });

    logger.info({
      senderId,
      recipientId,
      amount,
      transactionId: transaction.id,
      message: 'TIPS sent successfully via messaging',
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
      messageId: transaction.id, // Transaction ID kullan
      threadId: thread.id,
      senderId: senderId,
      recipientId: recipientId,
      message: tipsMessage || '',
      messageType: 'send-tips' as const,
      amount,
      context: "DM",
      timestamp: transaction.createdAt.toISOString(), // transaction.createdAt kullan
    };

    socketHandler.sendMessageToUser(recipientId, 'new_message', tipsEvent);
    socketHandler.sendToRoom(`thread:${thread.id}`, 'new_message', tipsEvent);
    socketHandler.sendMessageToUser(senderId, 'message_sent', tipsEvent);

    logger.info(`TIPS sent from ${senderId} to ${recipientId}, amount: ${amount}, socket events emitted`);
  }

  /**
   * Mesajı okundu olarak işaretle
   * @deprecated Bu metod duplicate. Aşağıdaki markMessageAsRead metodunu kullanın (read receipt ile).
   */

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

      // Thread okundu event'i gönder (mesaj listesinin anında güncellenmesi için)
      // Bu event frontend'e thread'in okundu olduğunu bildirir ve mesaj listesindeki yeşil noktayı kaldırır
      // ÖNEMLİ: threadId'nin doğru olduğundan emin ol - bu event frontend'de mesaj listesini güncellemek için kullanılır
      const threadReadEvent = {
        threadId,
        readBy: userId,
        timestamp,
        unreadCount: 0, // Thread artık okundu, unread count 0
        isUnread: false, // Thread artık okundu
      };
      
      socketHandler.sendMessageToUser(userId, 'thread_read', threadReadEvent);

      // Thread room'una da gönder (thread açık olan kullanıcılar için)
      socketHandler.sendToRoom(`thread:${threadId}`, 'thread_read', threadReadEvent);
      
      logger.info(`Thread read event sent: threadId=${threadId}, userId=${userId}, unreadCount=0`);

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
   * Cursor-based pagination ile WhatsApp benzeri çalışır
   * @param cursor - Timestamp (ISO string) - bu timestamp'ten önceki (daha eski) mesajlar getirilir
   * @returns Thread mesajları ve participants bilgileri
   */
  async getThreadMessages(
    threadId: string, 
    userId: string, 
    limit: number = 50, 
    cursor?: string
  ): Promise<{ 
    items: MessageFeedItem[]; 
    hasMore: boolean; 
    nextCursor?: string;
    participants?: {
      userOne: { id: string; name: string; title: string; avatar: string };
      userTwo: { id: string; name: string; title: string; avatar: string };
    };
  }> {
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

      // Participants bilgilerini al (userOne ve userTwo)
      const [userOne, userTwo] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: thread.userOneId },
          include: {
            profile: true,
            titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
            avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        }),
        this.prisma.user.findUnique({
          where: { id: thread.userTwoId },
          include: {
            profile: true,
            titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
            avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        }),
      ]);

      if (!userOne || !userTwo) {
        throw new Error('Thread participants not found');
      }

      const userOneName = userOne.profile?.displayName
        || userOne.profile?.userName
        || userOne.email
        || 'Unknown';
      const userTwoName = userTwo.profile?.displayName
        || userTwo.profile?.userName
        || userTwo.email
        || 'Unknown';

      const participants = {
        userOne: {
          id: thread.userOneId,
          name: userOneName,
          title: userOne.titles?.[0]?.title ?? '',
          avatar: resolveMediaUrl(userOne.avatars?.[0]?.imageUrl, true) || '',
        },
        userTwo: {
          id: thread.userTwoId,
          name: userTwoName,
          title: userTwo.titles?.[0]?.title ?? '',
          avatar: resolveMediaUrl(userTwo.avatars?.[0]?.imageUrl, true) || '',
        },
      };

      // Cursor'ı Date'e çevir (cursor yoksa undefined)
      const cursorDate = cursor ? new Date(cursor) : undefined;
      
      // Thread tipi kontrolü: Support thread ise sadece SUPPORT context'li mesajlar döndür
      const isSupportThread = thread.isSupportContext();

      // SUPPORT THREAD: Sadece SUPPORT context'li mesajları döndür
      if (isSupportThread) {
        // Cursor-based pagination: cursor'dan önceki (daha eski) mesajları getir
        const whereClause: any = {
          threadId,
          context: "SUPPORT",
        };
        
        if (cursorDate) {
          whereClause.sentAt = { lt: cursorDate };
        }

        // Limit + 1 al (hasMore kontrolü için)
        const messages = await this.prisma.dMMessage.findMany({
          where: whereClause,
          include: {
            sender: {
              include: {
                profile: true,
                titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
                avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
          },
          orderBy: { sentAt: 'desc' }, // En yeni önce (WhatsApp tarzı)
          take: limit + 1, // hasMore kontrolü için +1
        });

        // TIPS mesajlarını filtrele
        const supportMessages = messages.filter((msg) => {
          const messageText = msg.message || '';
          const isTipsMessage = messageText.includes('Sent') && messageText.includes('TIPS');
          return !isTipsMessage;
        });

        const threadItems: MessageFeedItem[] = [];
        for (const message of supportMessages) {
          // Support thread'de de image kontrolü yap
        const messageWithMedia = message as typeof message & { mediaUrl?: string | null; mediaType?: string | null; thumbnailUrl?: string | null; caption?: string | null };
        const hasMedia = !!messageWithMedia.mediaUrl;
        const isImage = hasMedia && messageWithMedia.mediaType === 'image';

        if (isImage) {
          // Image mesajı - sadece senderId gönder (participants'tan alınacak)
          const messageData: Message = {
            id: message.id,
            senderId: message.senderId,
            message: message.message || undefined,
            timestamp: message.sentAt.toISOString(),
            isUnread: !message.isRead,
            mediaUrl: resolveMediaUrl(messageWithMedia.mediaUrl, false) || null,
            thumbnailUrl: resolveMediaUrl(messageWithMedia.thumbnailUrl, false) || null,
            caption: messageWithMedia.caption || message.message || null,
          };

          threadItems.push({
            id: message.id,
            type: 'image' as MessageType,
            data: messageData,
          });
        } else {
          // Normal mesaj - sadece senderId gönder (participants'tan alınacak)
          const messageData: Message = {
            id: message.id,
            senderId: message.senderId,
            message: message.message,
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

        // Tüm item'ları timestamp'e göre DESC sırala (en yeni önce - WhatsApp tarzı)
        threadItems.sort((a, b) => {
          const timestampA = this.getTimestampFromFeedItem(a);
          const timestampB = this.getTimestampFromFeedItem(b);
          return new Date(timestampB).getTime() - new Date(timestampA).getTime(); // DESC
        });

        // Mesajları grupla (5 dakika içinde aynı sender'dan gelen mesajlar)
        const groupedItems = this.groupMessagesByTime(threadItems, 5 * 60 * 1000); // 5 dakika = 300000 ms

        // hasMore kontrolü
        const hasMore = groupedItems.length > limit;
        const items = hasMore ? groupedItems.slice(0, limit) : groupedItems;
        const nextCursor = hasMore && items.length > 0 
          ? this.getTimestampFromFeedItem(items[items.length - 1])
          : undefined;

        logger.info(`Support thread ${threadId} messages: returned=${items.length}, hasMore=${hasMore}`);
        return { items, hasMore, nextCursor, participants };
      }

      // NORMAL DM THREAD: DM context'li mesajlar + TIPS + support-request
      // Cursor-based pagination: Her tabloyu cursor ile sorgula, sonra birleştir
      
      // 1. DMMessage'ları getir (DM context'li mesajlar)
      // Not: context field'ı nullable değil, default değeri DM
      const messageWhere: any = {
        threadId,
        context: "DM", // Sadece DM context'li mesajlar
      };
      
      if (cursorDate) {
        messageWhere.sentAt = { lt: cursorDate };
      }

      const allMessages = await this.prisma.dMMessage.findMany({
        where: messageWhere,
        include: {
          sender: {
            include: {
              profile: true,
              titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
              avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { sentAt: 'desc' }, // En yeni önce
        take: limit + 1, // hasMore kontrolü için +1
      });

      // 2. Thread kullanıcıları arasındaki TIPS transferlerini getir
      const tipsWhere: any = {
        OR: [
          { fromUserId: thread.userOneId, toUserId: thread.userTwoId },
          { fromUserId: thread.userTwoId, toUserId: thread.userOneId },
        ],
      };
      
      if (cursorDate) {
        tipsWhere.createdAt = { lt: cursorDate };
      }

      const tipsTransfers = await this.prisma.tipsTokenTransfer.findMany({
        where: tipsWhere,
        include: {
          fromUser: {
            include: {
              profile: true,
              titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
              avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' }, // En yeni önce
        take: limit + 1, // hasMore kontrolü için +1
      });

      // 3. Thread kullanıcıları arasındaki Support Request'leri getir
      const requestWhere: any = {
        OR: [
          { fromUserId: thread.userOneId, toUserId: thread.userTwoId },
          { fromUserId: thread.userTwoId, toUserId: thread.userOneId },
        ],
        description: { not: null }, // Sadece support request'ler
      };
      
      if (cursorDate) {
        requestWhere.sentAt = { lt: cursorDate };
      }

      const supportRequests = await this.prisma.dMRequest.findMany({
        where: requestWhere,
        orderBy: { sentAt: 'desc' }, // En yeni önce
        take: limit + 1, // hasMore kontrolü için +1
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

      // 4. Tüm item'ları oluştur ve birleştir
      const threadItems: MessageFeedItem[] = [];

      // DMMessage'ları ekle (zaten desc sıralı, en yeni önce)
      for (const message of allMessages) {
        const sender = message.sender;
        if (!sender) continue;

        // TIPS mesajlarını atla (duplicate önlemek için)
        const isTipsMessage = message.message.includes('Sent') && message.message.includes('TIPS');
        if (isTipsMessage) continue;

        // Eğer mesajda media varsa ve image ise, type: "image" olarak döndür
        const messageWithMedia = message as typeof message & { mediaUrl?: string | null; mediaType?: string | null; thumbnailUrl?: string | null; caption?: string | null };
        const hasMedia = !!messageWithMedia.mediaUrl;
        const isImage = hasMedia && messageWithMedia.mediaType === 'image';

        if (isImage) {
          // Image mesajı - sadece senderId gönder (participants'tan alınacak)
          const messageData: Message = {
            id: message.id,
            senderId: message.senderId,
            message: message.message || undefined, // Caption olarak kullanılabilir
            timestamp: message.sentAt.toISOString(),
            isUnread: !message.isRead,
            mediaUrl: resolveMediaUrl(messageWithMedia.mediaUrl, false) || null,
            thumbnailUrl: resolveMediaUrl(messageWithMedia.thumbnailUrl, false) || null,
            caption: messageWithMedia.caption || message.message || null,
          };

          threadItems.push({
            id: message.id,
            type: 'image' as MessageType,
            data: messageData,
          });
        } else {
          // Normal mesaj - sadece senderId gönder (participants'tan alınacak)
          const messageData: Message = {
            id: message.id,
            senderId: message.senderId,
            message: message.message,
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

      // TIPS transferlerini ekle - sadece senderId gönder (participants'tan alınacak)
      for (const transfer of tipsTransfers) {
        const tipsInfo: TipsInfo = {
          id: transfer.id,
          senderId: transfer.fromUserId,
          amount: typeof transfer.amount === 'number' ? transfer.amount : Number(transfer.amount),
          message: transfer.reason || undefined, // Opsiyonel
          timestamp: transfer.createdAt.toISOString(),
          isUnread: false, // TIPS mesajları genelde okundu olarak işaretlenir
        };

        threadItems.push({
          id: transfer.id,
          type: 'send-tips' as MessageType,
          data: tipsInfo,
        });
      }

      // Support Request'leri ekle - sadece senderId gönder (participants'tan alınacak)
      for (const request of supportRequests) {
        if (!request.description) continue;

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

        const dmRequestWithType = request as typeof request & { type: string; amount: number | any };
        const prismaType = dmRequestWithType.type;
        const supportType: SupportType = 
          prismaType === 'GENERAL' || prismaType === 'TECHNICAL' || prismaType === 'PRODUCT'
            ? prismaType
            : 'GENERAL';

        const amount = typeof dmRequestWithType.amount === 'number'
          ? dmRequestWithType.amount
          : Number(dmRequestWithType.amount) || 0;

        const requestThreadId = request.threadId ?? null;
        // Support request için isUnread kontrolü (pending ise genelde unread)
        const isUnread = status === 'pending' || status === 'accepted';

        const supportRequest: SupportRequest = {
          id: request.id,
          senderId: request.fromUserId,
          type: supportType,
          message: request.description,
          amount,
          status,
          timestamp: request.sentAt.toISOString(),
          threadId: requestThreadId ?? null,
          requestId: request.id,
          fromUserId: request.fromUserId,
          toUserId: request.toUserId,
          isUnread,
        };

        threadItems.push({
          id: request.id,
          type: 'support-request' as MessageType,
          data: supportRequest,
        });
      }

      // 5. Tüm item'ları timestamp'e göre DESC sırala (en yeni önce - WhatsApp tarzı)
      threadItems.sort((a, b) => {
        const timestampA = this.getTimestampFromFeedItem(a);
        const timestampB = this.getTimestampFromFeedItem(b);
        return new Date(timestampB).getTime() - new Date(timestampA).getTime(); // DESC
      });

      // 6. Mesajları grupla (5 dakika içinde aynı sender'dan gelen mesajlar)
      const groupedItems = this.groupMessagesByTime(threadItems, 5 * 60 * 1000); // 5 dakika = 300000 ms

      // 7. Pagination uygula
      const hasMore = groupedItems.length > limit;
      const items = hasMore ? groupedItems.slice(0, limit) : groupedItems;
      const nextCursor = hasMore && items.length > 0 
        ? this.getTimestampFromFeedItem(items[items.length - 1])
        : undefined;

      const supportRequestCount = items.filter(item => item.type === 'support-request').length;
      logger.info(`DM thread ${threadId} messages: returned=${items.length}, hasMore=${hasMore}, support-requests=${supportRequestCount}, messages=${items.filter(item => item.type === 'message').length}, tips=${items.filter(item => item.type === 'send-tips').length}`);

      return { items, hasMore, nextCursor, participants };
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
   * Mesajları zaman aralığına göre grupla (5 dakika içinde aynı sender'dan gelen mesajlar)
   * @param items - Sıralanmış mesaj item'ları (en yeni önce)
   * @param timeWindowMs - Gruplama zaman penceresi (milisaniye)
   */
  private groupMessagesByTime(items: MessageFeedItem[], timeWindowMs: number): MessageFeedItem[] {
    const grouped: MessageFeedItem[] = [];
    let currentGroup: MessageFeedItem | null = null;

    for (const item of items) {
      // Sadece 'message' tipindeki text mesajları grupla
      // Görsel, tips, support-request gibi diğer tipler grouped olmayacak
      if (item.type !== 'message') {
        // Görsel, tips, support-request gibi diğer tipler olduğu gibi ekle
        grouped.push(item);
        currentGroup = null; // Grup'u sıfırla (farklı tip geldi)
        continue;
      }

      const messageData = item.data as Message;
      const messageTimestamp = new Date(messageData.timestamp).getTime();

      if (!currentGroup) {
        // Yeni grup başlat (sadece message tipi için)
        currentGroup = { ...item };
        (currentGroup.data as Message).groupedMessages = [];
        grouped.push(currentGroup);
      } else {
        const currentGroupData = currentGroup.data as Message;
        const currentGroupTimestamp = new Date(currentGroupData.timestamp).getTime();
        const timeDiff = Math.abs(messageTimestamp - currentGroupTimestamp);

        // Aynı sender ve 5 dakika içinde ise gruba ekle
        if (
          currentGroupData.senderId === messageData.senderId &&
          timeDiff <= timeWindowMs
        ) {
          // Gruba ekle (en eski mesaj en üstte olacak şekilde - timestamp ASC)
          currentGroupData.groupedMessages = currentGroupData.groupedMessages || [];
          currentGroupData.groupedMessages.push({
            id: messageData.id,
            type: 'message',
            message: messageData.message,
            timestamp: messageData.timestamp,
            isUnread: messageData.isUnread,
          });
          
          // Grup'un timestamp'ini en yeni mesajın timestamp'i yap (daha büyük timestamp)
          if (messageTimestamp > currentGroupTimestamp) {
            currentGroupData.timestamp = messageData.timestamp;
          }
          // Grup'un isUnread durumunu güncelle (en az bir mesaj okunmamışsa true)
          if (messageData.isUnread) {
            currentGroupData.isUnread = true;
          }
        } else {
          // Yeni grup başlat
          currentGroup = { ...item };
          (currentGroup.data as Message).groupedMessages = [];
          grouped.push(currentGroup);
        }
      }
    }

    // Gruplanmış mesajları timestamp'e göre sırala (en eski önce - grup içinde)
    for (const item of grouped) {
      if (item.type === 'message') {
        const messageData = item.data as Message;
        if (messageData.groupedMessages && messageData.groupedMessages.length > 0) {
          messageData.groupedMessages.sort((a, b) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(); // ASC (en eski önce)
          });
        }
      }
    }

    return grouped;
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

  async getUserInboxMessages(
    userId: string, 
    options: InboxQueryOptions = {}
  ): Promise<{ items: InboxMessageItem[]; hasMore: boolean; nextCursor?: string }> {
    try {
      const threads = await this.dmThreadRepo.findDetailedByUserId(userId, options);
      const userIdStr = String(userId);

      // hasMore kontrolü (limit + 1 aldık)
      const limit = options.limit ?? 50;
      const hasMore = threads.length > limit;
      const resultThreads = hasMore ? threads.slice(0, limit) : threads;

      // Tüm thread'ler için en son mesajı kontrol et (silinmiş olabilir)
      const threadIds = resultThreads.map(t => t.id);
      const lastMessagesMap = new Map<string, { message: string | null; sentAt: Date; isDeleted?: boolean }>();
      
      if (threadIds.length > 0) {
        // Her thread için en son mesajı toplu olarak çek
        
        // Her thread için en son mesajı bulmak için raw query veya her thread için ayrı query
        // Performans için: Tüm mesajları çekip group by yapmak yerine, her thread için ayrı query
        const lastMessagePromises = threadIds.map(async (threadId) => {
          // Önce en son mesajı bul (silinmiş olsa bile)
          const lastMsgAll = await this.prisma.dMMessage.findFirst({
            where: {
              threadId,
              context: 'DM', // Sadece DM context'li mesajları al
            } as any,
            select: {
              message: true,
              sentAt: true,
              mediaUrl: true,
              mediaType: true,
              caption: true,
              isDeleted: true,
            } as any,
            orderBy: {
              sentAt: 'desc',
            },
          });

          // Eğer en son mesaj silinmişse, "Bu mesaj silindi" göster
          if (lastMsgAll && lastMsgAll.isDeleted) {
            lastMessagesMap.set(threadId, {
              message: 'Bu mesaj silindi',
              sentAt: lastMsgAll.sentAt,
              isDeleted: true,
            });
            return;
          }

          // Silinmemiş en son mesajı bul
          const lastMsg = await this.prisma.dMMessage.findFirst({
            where: {
              threadId,
              isDeleted: false, // Prisma schema'da isDeleted field'ı var
              context: 'DM', // Sadece DM context'li mesajları al
            } as any,
            select: {
              message: true,
              sentAt: true,
              mediaUrl: true,
              mediaType: true,
              caption: true,
            } as any,
            orderBy: {
              sentAt: 'desc',
            },
          });
          
          if (lastMsg) {
            // Mesaj içeriği: text mesaj varsa message, görsel mesaj varsa caption veya "📷 Görsel"
            const msg = lastMsg as any;
            let messageText = msg.message;
            if (!messageText && msg.mediaUrl) {
              if (msg.mediaType === 'image') {
                messageText = msg.caption || '📷 Görsel';
              } else if (msg.mediaType === 'video') {
                messageText = msg.caption || '🎥 Video';
              } else if (msg.mediaType === 'audio') {
                messageText = msg.caption || '🎵 Ses';
              } else {
                messageText = msg.caption || '📎 Dosya';
              }
            }
            
            lastMessagesMap.set(threadId, {
              message: messageText,
              sentAt: lastMsg.sentAt,
            });
          }
        });
        
        await Promise.all(lastMessagePromises);
      }

      const items = resultThreads.map((thread) => {
        const isUserOne = thread.userOneId === userIdStr;
        const counterpart = isUserOne ? thread.userTwo : thread.userOne;
        const recipientUserId = isUserOne ? thread.userTwoId : thread.userOneId; // Karşı tarafın ID'si
        const unreadCount = isUserOne ? thread.unreadCountUserOne : thread.unreadCountUserTwo;
        
        // Önce include'dan gelen mesajı kontrol et, yoksa fallback'ten al
        let lastMessage = thread.messages?.[0];
        let lastMessageText: string | null = null;
        
        // Önce fallback'ten kontrol et (en son mesaj silinmiş olabilir)
        const fallbackMessage = lastMessagesMap.get(thread.id);
        
        // Eğer fallback'te silinmiş mesaj varsa ve timestamp'i daha yeni ise, onu göster
        if (fallbackMessage && fallbackMessage.isDeleted) {
          const fallbackTimestamp = fallbackMessage.sentAt instanceof Date 
            ? fallbackMessage.sentAt.getTime() 
            : new Date(fallbackMessage.sentAt).getTime();
          
          const includeTimestamp = lastMessage?.sentAt 
            ? (lastMessage.sentAt instanceof Date 
                ? lastMessage.sentAt.getTime() 
                : new Date(lastMessage.sentAt).getTime())
            : 0;
          
          // Fallback'teki silinmiş mesaj daha yeni ise, "Bu mesaj silindi" göster
          if (fallbackTimestamp > includeTimestamp) {
            lastMessageText = 'Bu mesaj silindi';
            if (!lastMessage) {
              lastMessage = {
                sentAt: fallbackMessage.sentAt,
              } as any;
            }
          } else if (lastMessage) {
            // Include'dan gelen mesaj var (silinmemiş), onu kullan
            if (lastMessage.message) {
              lastMessageText = lastMessage.message;
            } else if ((lastMessage as any).mediaUrl) {
              // Görsel mesaj için caption veya default text
              const mediaType = (lastMessage as any).mediaType;
              const caption = (lastMessage as any).caption;
              if (mediaType === 'image') {
                lastMessageText = caption || '📷 Görsel';
              } else if (mediaType === 'video') {
                lastMessageText = caption || '🎥 Video';
              } else if (mediaType === 'audio') {
                lastMessageText = caption || '🎵 Ses';
              } else {
                lastMessageText = caption || '📎 Dosya';
              }
            }
          }
        } else if (lastMessage) {
          // Include'dan gelen mesaj var (silinmemiş), onu kullan
          if (lastMessage.message) {
            lastMessageText = lastMessage.message;
          } else if ((lastMessage as any).mediaUrl) {
            // Görsel mesaj için caption veya default text
            const mediaType = (lastMessage as any).mediaType;
            const caption = (lastMessage as any).caption;
            if (mediaType === 'image') {
              lastMessageText = caption || '📷 Görsel';
            } else if (mediaType === 'video') {
              lastMessageText = caption || '🎥 Video';
            } else if (mediaType === 'audio') {
              lastMessageText = caption || '🎵 Ses';
            } else {
              lastMessageText = caption || '📎 Dosya';
            }
          }
        } else if (fallbackMessage) {
          // Include'dan mesaj gelmediyse, fallback'ten al
          lastMessageText = fallbackMessage.message;
          if (!lastMessage) {
            lastMessage = {
              sentAt: fallbackMessage.sentAt,
            } as any;
          }
        }
        
        const timestamp = (lastMessage?.sentAt ?? thread.updatedAt).toISOString();

        const senderName = counterpart?.profile?.displayName
          || counterpart?.profile?.userName
          || counterpart?.email
          || 'Unknown';

        const senderTitle = counterpart?.titles?.[0]?.title ?? null;
        const senderAvatarUrl = counterpart?.avatars?.[0]?.imageUrl ?? null;
        const defaultAvatarPath = 'avatars/default/default-useravatar.png';
        const senderAvatar = resolveMediaUrl(senderAvatarUrl) || resolveMediaUrl(defaultAvatarPath) || '';

        return {
          id: thread.id,
          recipientUserId, // Karşı tarafın ID'si
          senderName,
          senderTitle,
          senderAvatar,
          lastMessage: lastMessageText,
          timestamp,
          isUnread: unreadCount > 0,
          unreadCount,
          threadType: thread.isSupportThread ? 'SUPPORT' : 'DM', // Thread tipi bilgisi
        } satisfies InboxMessageItem;
      });

      // nextCursor hesapla (son thread'in updatedAt'ı veya lastMessage timestamp'i)
      const nextCursor = hasMore && items.length > 0
        ? items[items.length - 1].timestamp
        : undefined;

      return { items, hasMore, nextCursor };
    } catch (error) {
      logger.error(`Failed to get inbox messages for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının mesaj feed'ini getir (mesajlar, support request'ler, TIPS birleşik)
   * Cursor-based pagination ile WhatsApp benzeri çalışır
   */
  async getUserMessageFeed(
    userId: string, 
    limit: number = 50, 
    cursor?: string
  ): Promise<{ items: MessageFeedItem[]; hasMore: boolean; nextCursor?: string }> {
    try {
      const userIdStr = userId;
      const feedItems: MessageFeedItem[] = [];
      const cursorDate = cursor ? new Date(cursor) : undefined;

      // 1. Mesajları getir (thread'lerden) - cursor ile
      const threads = await this.dmThreadRepo.findDetailedByUserId(userIdStr, { 
        limit: limit + 1, // hasMore kontrolü için +1
        cursor,
      });
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
        const senderAvatarUrl = counterpart?.avatars?.[0]?.imageUrl ?? '';
        const defaultAvatarPath = 'avatars/default/default-useravatar.png';
        const senderAvatar = resolveMediaUrl(senderAvatarUrl) || resolveMediaUrl(defaultAvatarPath) || '';

        const sender: SenderUser = {
          id: isUserOne ? thread.userTwoId : thread.userOneId,
          senderName,
          senderTitle,
          senderAvatar,
        };

        const message: Message = {
          id: thread.id,
          senderId: isUserOne ? thread.userTwoId : thread.userOneId,
          sender, // Geriye dönük uyumluluk
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

      // 2. Support Request'leri getir - cursor ile (support request service'de cursor desteği eklenmeli)
      // Şimdilik limit + 1 al, sonra cursor ile filtrele
      const supportRequestsResult = await this.supportRequestService.getUserSupportRequests(userIdStr, { 
        limit: limit + 1, // hasMore kontrolü için +1
        cursor,
      });
      
      // Support requests result bir obje: { items: [...], hasMore: boolean, nextCursor?: string }
      const supportRequests = supportRequestsResult.items || [];
      
      // Cursor ile filtrele (timestamp'e göre) - eğer cursor varsa ve service'de cursor desteği yoksa
      const filteredSupportRequests = cursorDate && !supportRequestsResult.nextCursor
        ? supportRequests.filter(req => new Date(req.timestamp) < cursorDate)
        : supportRequests;
      for (const request of filteredSupportRequests) {
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
          senderAvatar: resolveMediaUrl(requestCreator.avatars?.[0]?.imageUrl, true) || '',
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
          senderId: dmRequest.fromUserId,
          sender, // Geriye dönük uyumluluk
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

      // 3. TIPS transferlerini getir - cursor ile
      const tipsWhere: any = {
        OR: [
          { fromUserId: userIdStr },
          { toUserId: userIdStr },
        ],
      };
      
      if (cursorDate) {
        tipsWhere.createdAt = { lt: cursorDate };
      }

      const tipsTransfers = await this.prisma.tipsTokenTransfer.findMany({
        where: tipsWhere,
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
        take: limit + 1, // hasMore kontrolü için +1
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
          senderAvatar: resolveMediaUrl(sender.avatars?.[0]?.imageUrl, true) || '',
        };

        const tipsInfo: TipsInfo = {
          id: transfer.id,
          senderId: transfer.fromUserId,
          sender: senderUser, // Geriye dönük uyumluluk
          amount: transfer.amount,
          message: transfer.reason || undefined, // Opsiyonel
          timestamp: transfer.createdAt.toISOString(),
        };

        feedItems.push({
          id: transfer.id,
          type: 'send-tips' as MessageType,
          data: tipsInfo,
        });
      }

      // Tüm feed item'larını timestamp'e göre DESC sırala (en yeni önce - WhatsApp tarzı)
      feedItems.sort((a, b) => {
        const timestampA = this.getTimestampFromFeedItem(a);
        const timestampB = this.getTimestampFromFeedItem(b);
        return new Date(timestampB).getTime() - new Date(timestampA).getTime(); // DESC
      });

      // Pagination uygula
      const hasMore = feedItems.length > limit;
      const items = hasMore ? feedItems.slice(0, limit) : feedItems;
      const nextCursor = hasMore && items.length > 0
        ? this.getTimestampFromFeedItem(items[items.length - 1])
        : undefined;

      return { items, hasMore, nextCursor };
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
    const result = await this.getThreadMessages(threadId, userId, limit);
    return result.items;
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

  /**
   * Mesaj güncelleme
   * Sadece gönderen kullanıcı, mesajı gönderdikten sonra belirli bir süre içinde (örn: 5 dakika) güncelleyebilir
   */
  async updateMessage(
    userId: string,
    messageId: string,
    newMessage: string
  ): Promise<void> {
    try {
      const message = await this.prisma.dMMessage.findUnique({
        where: { id: messageId },
        include: { thread: true },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Mesaj sahibi kontrolü
      if (message.senderId !== userId) {
        throw new Error('Forbidden: user does not own this message');
      }

      // Zaman kontrolü (5 dakika içinde güncellenebilir)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (message.sentAt < fiveMinutesAgo) {
        throw new Error('Message can only be updated within 5 minutes of sending');
      }

      // Mesajı güncelle
      await this.prisma.dMMessage.update({
        where: { id: messageId },
        data: { message: newMessage },
      });

      // Thread updatedAt timestamp'ini güncelle
      await this.prisma.dMThread.update({
        where: { id: message.threadId },
        data: { updatedAt: new Date() },
      });

      // Socket.IO ile real-time bildirim
      const socketHandler = SocketManager.getInstance().getSocketHandler();
      const updatedEvent = {
        messageId: message.id,
        threadId: message.threadId,
        senderId: userId,
        message: newMessage,
        messageType: 'message' as const,
        context: message.context,
        timestamp: new Date().toISOString(),
      };

      // Thread room'una gönder
      socketHandler.sendToRoom(`thread:${message.threadId}`, 'message_updated', updatedEvent);

      // Her iki kullanıcıya da gönder
      if (message.thread.userOneId) {
        socketHandler.sendMessageToUser(message.thread.userOneId, 'message_updated', updatedEvent);
      }
      if (message.thread.userTwoId) {
        socketHandler.sendMessageToUser(message.thread.userTwoId, 'message_updated', updatedEvent);
      }

      logger.info(`Message updated: ${messageId} by user ${userId}`);
    } catch (error) {
      logger.error(`Failed to update message ${messageId} by user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Thread silme (soft delete)
   */
  async deleteThread(userId: string, threadId: string): Promise<void> {
    try {
      const thread = await this.prisma.dMThread.findUnique({
        where: { id: threadId },
      });

      if (!thread) {
        throw new Error('Thread not found');
      }

      // Thread'deki kullanıcılardan biri olma kontrolü
      if (thread.userOneId !== userId && thread.userTwoId !== userId) {
        throw new Error('Forbidden: user is not part of this thread');
      }

      // Thread'i soft delete: isActive = false
      await this.prisma.dMThread.update({
        where: { id: threadId },
        data: { isActive: false },
      });

      // Thread'deki tüm mesajları soft delete (eğer schema'da isDeleted field'ı varsa)
      // Şimdilik mesajları silmiyoruz, sadece thread'i inactive yapıyoruz

      // Socket.IO ile real-time bildirim
      const socketHandler = SocketManager.getInstance().getSocketHandler();
      const deletedEvent = {
        threadId: thread.id,
        userId: userId,
        timestamp: new Date().toISOString(),
      };

      // Thread room'una gönder
      socketHandler.sendToRoom(`thread:${threadId}`, 'thread_deleted', deletedEvent);

      // Her iki kullanıcıya da gönder
      if (thread.userOneId) {
        socketHandler.sendMessageToUser(thread.userOneId, 'thread_deleted', deletedEvent);
      }
      if (thread.userTwoId) {
        socketHandler.sendMessageToUser(thread.userTwoId, 'thread_deleted', deletedEvent);
      }

      logger.info(`Thread deleted: ${threadId} by user ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete thread ${threadId} by user ${userId}`, error);
      throw error;
    }
  }

  async editMessage(messageId: string, userId: string, newMessage: string): Promise<void> {
    const message = await this.dmMessageRepo.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== userId) {
      throw new Error('Forbidden: You can only edit your own messages');
    }

    if (message.isDeleted === true) {
      throw new Error('Cannot edit deleted message');
    }

    if (!message.canBeEdited()) {
      throw new Error('Message cannot be edited after 15 minutes');
    }

    const updatedMessage = await this.dmMessageRepo.updateMessage(messageId, newMessage);
    if (!updatedMessage) {
      throw new Error('Failed to update message');
    }

    // Emit socket event
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const editEvent = {
      messageId,
      threadId: message.threadId,
      message: newMessage,
      editedAt: updatedMessage.editedAt?.toISOString(),
      timestamp: new Date().toISOString(),
    };

    socketHandler.sendToRoom(`thread:${message.threadId}`, 'message_edited', editEvent);
    logger.info(`Message edited: ${messageId} by user ${userId}`);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.dmMessageRepo.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== userId) {
      throw new Error('Forbidden: You can only delete your own messages');
    }

    // Eğer mesajda medya varsa, MinIO'dan da sil
    if (message.mediaUrl) {
      try {
        // mediaUrl zaten path formatında (messages/threads/...)
        // resolveMediaUrl ile tam URL'ye çevrilmiş olabilir, ama biz path'i kullanıyoruz
        // Eğer tam URL ise, path'i çıkar
        let filePath = message.mediaUrl;
        
        // Eğer tam URL ise (http:// veya https:// ile başlıyorsa), path'i çıkar
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
          // URL'den path'i çıkar (örn: http://minio:9000/tipbox-media/messages/threads/... -> messages/threads/...)
          const urlParts = filePath.split('/');
          const bucketIndex = urlParts.findIndex(part => part.includes('tipbox-media') || part.includes('bucket'));
          if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
            filePath = urlParts.slice(bucketIndex + 1).join('/');
          } else {
            // Bucket adı bulunamadıysa, son kısımdan path'i al
            const messagesIndex = urlParts.findIndex(part => part === 'messages');
            if (messagesIndex !== -1) {
              filePath = urlParts.slice(messagesIndex).join('/');
            }
          }
        }

        // MinIO'dan dosyayı sil
        await this.s3Service.deleteFile(filePath);
        logger.info(`Media file deleted from MinIO: ${filePath} for message ${messageId}`);

        // Thumbnail varsa onu da sil
        if (message.thumbnailUrl && message.thumbnailUrl !== message.mediaUrl) {
          let thumbnailPath = message.thumbnailUrl;
          if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
            const urlParts = thumbnailPath.split('/');
            const messagesIndex = urlParts.findIndex(part => part === 'messages');
            if (messagesIndex !== -1) {
              thumbnailPath = urlParts.slice(messagesIndex).join('/');
            }
          }
          try {
            await this.s3Service.deleteFile(thumbnailPath);
            logger.info(`Thumbnail file deleted from MinIO: ${thumbnailPath} for message ${messageId}`);
          } catch (thumbnailError) {
            // Thumbnail silme hatası kritik değil, sadece logla
            logger.warn(`Failed to delete thumbnail: ${thumbnailPath}`, thumbnailError);
          }
        }
      } catch (s3Error) {
        // S3 silme hatası kritik değil, mesaj silme işlemi devam etsin
        // Ama logla ki sorun varsa görülebilsin
        logger.warn({
          message: 'Failed to delete media file from MinIO',
          messageId,
          mediaUrl: message.mediaUrl,
          error: s3Error instanceof Error ? s3Error.message : String(s3Error),
        });
      }
    }

    const deletedMessage = await this.dmMessageRepo.markAsDeleted(messageId, userId);
    if (!deletedMessage) {
      throw new Error('Failed to delete message');
    }

    // Emit socket event
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const deleteEvent = {
      messageId,
      threadId: message.threadId,
      deletedAt: deletedMessage.deletedAt?.toISOString(),
      timestamp: new Date().toISOString(),
    };

    socketHandler.sendToRoom(`thread:${message.threadId}`, 'message_deleted', deleteEvent);
    logger.info(`Message deleted: ${messageId} by user ${userId}`);
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const message = await this.dmMessageRepo.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.isDeleted === true) {
      throw new Error('Cannot react to deleted message');
    }

    // Check if user already reacted with this emoji
    const existingReaction = await this.messageReactionRepo.findByUserIdAndMessageId(userId, messageId, emoji);
    if (existingReaction) {
      throw new Error('Already reacted with this emoji');
    }

    const reaction = await this.messageReactionRepo.create({
      messageId,
      userId,
      emoji
    });

    // Emit socket event
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const reactionEvent = {
      messageId,
      threadId: message.threadId,
      emoji,
      action: 'add',
      userId,
      reactionId: reaction.id,
      timestamp: new Date().toISOString(),
    };

    socketHandler.sendToRoom(`thread:${message.threadId}`, 'message_reaction', reactionEvent);
    logger.info(`Reaction added: ${emoji} to message ${messageId} by user ${userId}`);
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const message = await this.dmMessageRepo.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const reaction = await this.messageReactionRepo.findByUserIdAndMessageId(userId, messageId, emoji);
    if (!reaction) {
      throw new Error('Reaction not found');
    }

    if (reaction.userId !== userId) {
      throw new Error('Forbidden: You can only remove your own reactions');
    }

    await this.messageReactionRepo.delete(reaction.id);

    // Emit socket event
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const reactionEvent = {
      messageId,
      threadId: message.threadId,
      emoji,
      action: 'remove',
      userId,
      reactionId: reaction.id,
      timestamp: new Date().toISOString(),
    };

    socketHandler.sendToRoom(`thread:${message.threadId}`, 'message_reaction', reactionEvent);
    logger.info(`Reaction removed: ${emoji} from message ${messageId} by user ${userId}`);
  }

  async getMessageReactions(messageId: string): Promise<Array<{ emoji: string; count: number; users: string[] }>> {
    const message = await this.dmMessageRepo.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    return await this.messageReactionRepo.findByMessageIdGrouped(messageId);
  }

  async searchMessages(threadId: string, query: string, limit: number = 50, offset: number = 0): Promise<DMMessage[]> {
    // Validate thread access
    const thread = await this.dmThreadRepo.findById(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (!query || query.trim().length === 0) {
      throw new Error('Query parameter is required');
    }

    return await this.dmMessageRepo.searchMessages(threadId, query.trim(), limit, offset);
  }

  async uploadMedia(
    threadId: string,
    userId: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    fileName?: string,
    fileSize?: bigint,
    thumbnailUrl?: string,
    caption?: string
  ): Promise<DMMessage> {
    // Validate thread access
    const thread = await this.dmThreadRepo.findById(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (thread.userOneId !== userId && thread.userTwoId !== userId) {
      throw new Error('Forbidden: user is not part of this thread');
    }

    // Determine recipient
    const recipientId = thread.userOneId === userId ? thread.userTwoId : thread.userOneId;

    // Create message with media
    const createdMessage = await this.dmMessageRepo.create({
      threadId,
      senderId: userId,
      message: caption || '',
      isRead: false,
      sentAt: new Date(),
      mediaUrl,
      mediaType,
      thumbnailUrl,
      fileName,
      fileSize,
      caption,
      status: 'sent',
    });

    // Emit socket event
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const newMessageEvent = {
      messageId: createdMessage.id,
      threadId,
      senderId: userId,
      recipientId,
      message: caption || '',
      messageType: mediaType,
      mediaUrl,
      thumbnailUrl,
      fileName,
      fileSize: fileSize ? Number(fileSize) : null,
      caption,
      timestamp: createdMessage.sentAt.toISOString(),
    };

    socketHandler.sendMessageToUser(recipientId, 'new_message', newMessageEvent);
    socketHandler.sendToRoom(`thread:${threadId}`, 'new_message', newMessageEvent);
    socketHandler.sendMessageToUser(userId, 'message_sent', newMessageEvent);

    logger.info(`Media uploaded to thread ${threadId} by user ${userId}: ${mediaType}`);
    
    return createdMessage;
  }

  async markMessageAsDelivered(messageId: string): Promise<void> {
    const message = await this.dmMessageRepo.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.status === 'delivered' || message.status === 'read') {
      return; // Already delivered or read
    }

    await this.dmMessageRepo.markAsDelivered(messageId);

    // Emit socket event
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const deliveredEvent = {
      messageId,
      threadId: message.threadId,
      deliveredAt: new Date().toISOString(),
    };

    socketHandler.sendToRoom(`thread:${message.threadId}`, 'message_delivered', deliveredEvent);
    logger.info(`Message marked as delivered: ${messageId}`);
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.dmMessageRepo.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId === userId) {
      return; // Don't mark own messages as read
    }

    // Validate thread access
    const thread = await this.dmThreadRepo.findById(message.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (thread.userOneId !== userId && thread.userTwoId !== userId) {
      throw new Error('Forbidden: user is not part of this thread');
    }

    await this.dmMessageRepo.markAsReadWithReceipt(messageId, userId);

    // Emit socket event
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const readEvent = {
      messageId,
      threadId: message.threadId,
      userId,
      readAt: new Date().toISOString(),
    };

    socketHandler.sendMessageToUser(message.senderId, 'message_read', readEvent);
    socketHandler.sendToRoom(`thread:${message.threadId}`, 'message_read', readEvent);
    logger.info(`Message marked as read: ${messageId} by user ${userId}`);
  }

}
