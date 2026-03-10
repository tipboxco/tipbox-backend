import { DMRequestPrismaRepository } from '../../infrastructure/repositories/dm-request-prisma.repository';
import { DMThreadPrismaRepository } from '../../infrastructure/repositories/dm-thread-prisma.repository';
import { SupportRequestStatus } from '../../domain/messaging/support-request-status.enum';
import { DMRequestStatus } from '../../domain/messaging/dm-request-status.enum';
import { SupportType } from '../../domain/messaging/support-type.enum';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import { SocketHandler } from '../../infrastructure/realtime/socket.handler';
import logger from '../../infrastructure/logger/logger';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { SupportRequestReportPrismaRepository } from '../../infrastructure/repositories/support-request-report-prisma.repository';
import { SupportRequestReportCategory } from '../../domain/messaging/support-request-report-category.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { invalidateDMCache } from '../../infrastructure/cache/cache-invalidation';

export interface SupportRequestListItem {
  id: string;
  userName: string;
  userTitle: string | null;
  userAvatar: string | null;
  requestDescription: string;
  status: SupportRequestStatus;
  threadId: string | null; // Accept edilmişse thread ID, yoksa null
  fromUserId: string; // Request oluşturan kullanıcı ID
  toUserId: string; // Request alıcı kullanıcı ID
  timestamp: string; // Request timestamp (sentAt) - pagination için
}

export interface SupportRequestQueryOptions {
  status?: SupportRequestStatus;
  search?: string;
  limit?: number;
  cursor?: string; // Pagination cursor (timestamp)
}

export class SupportRequestService {
  private dmRequestRepo = new DMRequestPrismaRepository();
  private dmThreadRepo = new DMThreadPrismaRepository();
  private prisma = getPrisma();
  private supportRequestReportRepo = new SupportRequestReportPrismaRepository();
  private notificationService = new NotificationService();
  private userRepo = new UserPrismaRepository();

  public static readonly REPORT_CATEGORIES: SupportRequestReportCategory[] = [
    SupportRequestReportCategory.SPAM,
    SupportRequestReportCategory.HARASSMENT,
    SupportRequestReportCategory.SCAM,
  ];

  /**
   * Kullanıcının birebir destek sohbetlerini listele
   */
  async getUserSupportRequests(
    userId: string,
    options: SupportRequestQueryOptions = {}
  ): Promise<{ items: SupportRequestListItem[]; hasMore: boolean; nextCursor?: string }> {
    try {
      // Map SupportRequestStatus to DMRequestStatus for filtering
      let dmRequestStatus: DMRequestStatus | undefined;
      if (options.status === SupportRequestStatus.PENDING) {
        dmRequestStatus = DMRequestStatus.PENDING;
      } else if (options.status === SupportRequestStatus.ACTIVE) {
        dmRequestStatus = DMRequestStatus.ACCEPTED;
      } else if (options.status === SupportRequestStatus.CANCELED) {
        dmRequestStatus = DMRequestStatus.CANCELED;
      } else if (options.status === SupportRequestStatus.AWAITING_COMPLETION) {
        dmRequestStatus = DMRequestStatus.AWAITING_COMPLETION;
      } else if (options.status === SupportRequestStatus.COMPLETED) {
        // Completed: ACCEPTED without active thread.
        // Do NOT pre-filter by status here; fetch all and filter at service layer.
        dmRequestStatus = undefined;
      } else if (options.status === SupportRequestStatus.REJECTED) {
        dmRequestStatus = DMRequestStatus.DECLINED;
      } else if (options.status === SupportRequestStatus.REPORTED) {
        dmRequestStatus = DMRequestStatus.REPORTED;
      }

      // Get support requests (requests with description) - cursor ile
      const requests = await this.dmRequestRepo.findSupportRequestsByUserId(userId, {
        status: dmRequestStatus,
        cursor: options.cursor,
        limit: options.limit ? options.limit + 1 : undefined, // hasMore kontrolü için +1
      });

      // Get all support threads (is_support_thread = true) for these users
      // Thread'leri userOneId ve userTwoId'ye göre bul
      const userIdStr = String(userId);
      const supportThreads = await this.prisma.dMThread.findMany({
        where: {
          isSupportThread: true,
          OR: [
            { userOneId: userIdStr },
            { userTwoId: userIdStr },
          ],
        },
        select: { id: true, isActive: true, userOneId: true, userTwoId: true },
      });

      // Thread'leri request'lere eşleştir
      // ÖNEMLİ: Request'in kendi threadId'sini kontrol et, yoksa userOneId/userTwoId'ye göre eşleştir
      const threadMap = new Map<string, { threadId: string; isActive: boolean }>();
      for (const request of requests) {
        // Type assertion: Prisma type'ında threadId tanımlı olmayabilir
        const requestThreadId = request.threadId;
        
        // Önce request'in kendi threadId'sini kontrol et
        // Pending request'lerde threadId null olmalı, bu durumda eşleştirme yapma
        if (requestThreadId) {
          // Request'in kendi threadId'si var, direkt bunu kullan
          const matchingThread = supportThreads.find(thread => thread.id === requestThreadId);
          if (matchingThread) {
            threadMap.set(request.id, {
              threadId: matchingThread.id,
              isActive: matchingThread.isActive,
            });
          }
        } else if (request.status === DMRequestStatus.ACCEPTED) {
          // Request'in threadId'si yok ama ACCEPTED durumunda
          // Bu durumda aynı kullanıcılar arasındaki thread'i bul (eski mantık - backward compatibility)
          const matchingThread = supportThreads.find(
            (thread) =>
              (thread.userOneId === request.fromUserId && thread.userTwoId === request.toUserId) ||
              (thread.userOneId === request.toUserId && thread.userTwoId === request.fromUserId)
          );
          if (matchingThread) {
            threadMap.set(request.id, {
              threadId: matchingThread.id,
              isActive: matchingThread.isActive,
            });
          }
        }
        // PENDING durumunda threadId null kalır, eşleştirme yapılmaz
      }

      // Map requests to support request list items
      const supportRequests: SupportRequestListItem[] = [];

      for (const request of requests) {
        // Determine the other user (counterpart)
        const isFromUser = request.fromUserId === userId;
        const counterpart = isFromUser ? request.toUser : request.fromUser;

        // Skip if no description
        if (!request.description) {
          continue;
        }

        // Determine support request status
        let supportStatus: SupportRequestStatus;
        const threadInfo = threadMap.get(request.id);
        
        const requestStatus = request.status as DMRequestStatus;
        
        // ÖNEMLİ: COMPLETED ve AWAITING_COMPLETION durumlarını önce kontrol et
        // Çünkü bu durumlar thread'in active olup olmadığına bakılmaksızın geçerli
        if (requestStatus === DMRequestStatus.COMPLETED) {
          supportStatus = SupportRequestStatus.COMPLETED;
        } else if (requestStatus === DMRequestStatus.AWAITING_COMPLETION) {
          supportStatus = SupportRequestStatus.AWAITING_COMPLETION;
        } else if (requestStatus === DMRequestStatus.PENDING) {
          supportStatus = SupportRequestStatus.PENDING;
        } else if (requestStatus === DMRequestStatus.ACCEPTED) {
          // ACCEPTED durumunda thread'in active olup olmadığına bak
          // Ama eğer request COMPLETED ise yukarıdaki kontrol zaten yakaladı
          supportStatus = threadInfo?.isActive ? SupportRequestStatus.ACTIVE : SupportRequestStatus.COMPLETED;
        } else if (requestStatus === DMRequestStatus.DECLINED) {
          supportStatus = SupportRequestStatus.REJECTED;
        } else if (requestStatus === DMRequestStatus.CANCELED) {
          supportStatus = SupportRequestStatus.CANCELED;
        } else if (requestStatus === DMRequestStatus.REPORTED) {
          supportStatus = SupportRequestStatus.REPORTED;
        } else {
          supportStatus = SupportRequestStatus.COMPLETED;
        }

        // REJECTED request'ler listelenmemeli (sadece explicit olarak REJECTED status filtresi varsa gösterilir)
        if (!options.status && supportStatus === SupportRequestStatus.REJECTED) {
          continue;
        }

        // Apply status filter if specified
        if (options.status && supportStatus !== options.status) {
          continue;
        }

        // Get user info
        const userName = counterpart?.profile?.displayName
          || counterpart?.profile?.userName
          || counterpart?.email
          || 'Unknown';

        const userTitle = counterpart?.titles?.[0]?.title ?? null;
        const userAvatar = resolveMediaUrl(counterpart?.avatars?.[0]?.imageUrl, true) ?? null;

        // ThreadId'yi belirle: Önce request'in kendi threadId'sini kontrol et, sonra threadMap'i kontrol et
        // PENDING durumunda request.threadId null olmalı, bu durumda threadInfo da null olacak
        const requestThreadId = request.threadId;
        let finalThreadId: string | null = null;
        if (requestThreadId) {
          // Request'in kendi threadId'si varsa onu kullan
          finalThreadId = requestThreadId;
        } else if (threadInfo?.threadId) {
          // ThreadMap'ten bulunan threadId'yi kullan (backward compatibility)
          finalThreadId = threadInfo.threadId;
        }
        // PENDING durumunda finalThreadId null kalır

        supportRequests.push({
          id: request.id,
          userName,
          userTitle,
          userAvatar,
          requestDescription: request.description,
          status: supportStatus,
          threadId: finalThreadId,
          fromUserId: request.fromUserId,
          toUserId: request.toUserId,
          timestamp: request.sentAt.toISOString(), // Pagination için timestamp
        });
      }

      // If search is provided, filter by user name, title, or description
      let filteredRequests = supportRequests;
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        filteredRequests = supportRequests.filter((req) => {
          return (
            req.userName.toLowerCase().includes(searchLower) ||
            req.userTitle?.toLowerCase().includes(searchLower) ||
            req.requestDescription.toLowerCase().includes(searchLower)
          );
        });
      }

      // Pagination uygula (search filtresinden sonra)
      const limit = options.limit ?? 50;
      const hasMore = filteredRequests.length > limit;
      const items = hasMore ? filteredRequests.slice(0, limit) : filteredRequests;
      const nextCursor = hasMore && items.length > 0
        ? items[items.length - 1].timestamp // SupportRequestListItem'de timestamp field'ı var mı kontrol et
        : undefined;

      return { items, hasMore, nextCursor };
    } catch (error) {
      logger.error(`Failed to get support requests for user ${userId}:`, error);
      // Log the full error for debugging
      if (error instanceof Error) {
        logger.error(`Error message: ${error.message}`);
        logger.error(`Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  async createSupportRequest(
    senderId: string,
    payload: { recipientUserId: string; type: string; message: string; amount: number }
  ) {
    // Convert string type to SupportType enum
    const supportType = Object.values(SupportType).includes(payload.type.toUpperCase() as SupportType)
      ? (payload.type.toUpperCase() as SupportType)
      : SupportType.GENERAL;

    const request = await this.dmRequestRepo.create({
      fromUserId: senderId,
      toUserId: payload.recipientUserId,
      status: DMRequestStatus.PENDING,
      type: supportType,
      amount: payload.amount,
      description: payload.message,
    });

    // Normal DM thread'i bul veya oluştur (support request normal DM thread'de görünecek)
    // Support thread henüz oluşturulmadı - Accept edildiğinde oluşturulacak
    const normalDMThread = await this.prisma.dMThread.findFirst({
      where: {
        isSupportThread: false,
        OR: [
          { userOneId: senderId, userTwoId: payload.recipientUserId },
          { userOneId: payload.recipientUserId, userTwoId: senderId },
        ],
      },
    });

    let dmThreadId: string | null = null;
    if (normalDMThread) {
      dmThreadId = normalDMThread.id;
    } else {
      // Normal DM thread yoksa oluştur
      const newThread = await this.dmThreadRepo.create({
        userOneId: senderId,
        userTwoId: payload.recipientUserId,
        isActive: true,
        isSupportThread: false, // Normal DM thread
        startedAt: new Date(),
      });
      dmThreadId = newThread.id;
    }

    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const supportEvent = {
      messageId: request.id,
      threadId: dmThreadId,
      senderId,
      recipientId: payload.recipientUserId,
      message: payload.message,
      messageType: 'support-request' as const,
      type: payload.type,
      amount: payload.amount,
      status: 'pending' as const,
      context: 'DM' as const,
      timestamp: request.sentAt.toISOString(),
    };

    if (dmThreadId) {
      socketHandler.sendToRoom(`thread:${dmThreadId}`, 'new_message', supportEvent);
    }
    socketHandler.sendMessageToUser(payload.recipientUserId, 'new_message', supportEvent);
    socketHandler.sendMessageToUser(senderId, 'message_sent', supportEvent);

    // Alıcı kullanıcıya bildirim gönder (DM_REQUEST_RECEIVED)
    try {
      const sender = await this.userRepo.findById(senderId);
      if (sender) {
        await this.notificationService.sendNotification(
          payload.recipientUserId,
          NotificationType.DM_REQUEST_RECEIVED,
          {
            // Sadece oluşturan kişinin userId'si
            userId: sender.id,
          }
        );
      }
    } catch (error) {
      logger.error(`Failed to send DM_REQUEST_RECEIVED notification:`, error);
      // Don't throw - notification failure shouldn't break the create flow
    }

    // Cache invalidation - her iki kullanıcının DM cache'ini temizle
    invalidateDMCache(senderId, dmThreadId ?? undefined).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });
    invalidateDMCache(payload.recipientUserId, dmThreadId ?? undefined).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info(`Support request created from ${senderId} to ${payload.recipientUserId}, socket events emitted`);
  }

  /**
   * Support request'i accept et ve thread oluştur
   */
  async acceptSupportRequest(
    requestId: string,
    expertUserId: string
  ): Promise<{ requestId: string; threadId: string }> {
    const request = await this.dmRequestRepo.findById(requestId);
    if (!request) {
      throw new Error('Support request not found');
    }

    // DEBUG: Request ve user bilgilerini detaylı logla
    logger.info(`[DEBUG] Accept support request attempt:`, {
      requestId,
      expertUserId,
      expertUserIdType: typeof expertUserId,
      request: {
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        toUserIdType: typeof request.toUserId,
        status: request.status,
        type: request.type,
      },
      comparison: {
        expertUserId,
        requestToUserId: request.toUserId,
        areEqual: request.toUserId === expertUserId,
        looselyEqual: request.toUserId == expertUserId,
      },
    });

    // Sadece alıcı (expert) accept edebilir
    if (request.toUserId !== expertUserId) {
      logger.warn(`[DEBUG] Authorization failed:`, {
        expertUserId,
        requestToUserId: request.toUserId,
        expertUserIdType: typeof expertUserId,
        toUserIdType: typeof request.toUserId,
      });
      throw new Error(`Only the recipient can accept the support request. Request recipient: ${request.toUserId}, Current user: ${expertUserId}`);
    }

    // Sadece pending request'ler accept edilebilir
    if (!request.isPending()) {
      throw new Error('Only pending support requests can be accepted');
    }

    // Her support request için yeni bir thread oluştur (unique constraint kaldırıldı)
    // Her request accept edildiğinde yeni bir support thread oluşturulur
    const supportThread = await this.dmThreadRepo.create({
      userOneId: request.fromUserId,
      userTwoId: request.toUserId,
      isActive: true,
      isSupportThread: true, // Support thread
      startedAt: new Date(),
    });

    // Request'i ACCEPTED yap ve threadId'yi kaydet
    await this.dmRequestRepo.update(requestId, {
      status: DMRequestStatus.ACCEPTED,
      respondedAt: new Date(),
      threadId: supportThread.id, // Thread ID'yi DMRequest'e kaydet
    });

    // Socket bildirimi gönder - support request accepted
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    
    // Participants bilgilerini al (thread açıldığında userOne userTwo bilgileri için)
    try {
      const [fromUser, toUser] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: request.fromUserId },
          include: {
            profile: true,
            titles: { take: 1, orderBy: { createdAt: 'desc' } },
            avatars: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        }),
        this.prisma.user.findUnique({
          where: { id: request.toUserId },
          include: {
            profile: true,
            titles: { take: 1, orderBy: { createdAt: 'desc' } },
            avatars: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        }),
      ]);

      const fromUserName = fromUser?.profile?.displayName
        || fromUser?.profile?.userName
        || fromUser?.email
        || 'Unknown';
      const toUserName = toUser?.profile?.displayName
        || toUser?.profile?.userName
        || toUser?.email
        || 'Unknown';

      const participants = {
        userOne: {
          id: supportThread.userOneId,
          name: supportThread.userOneId === request.fromUserId ? fromUserName : toUserName,
          title: (supportThread.userOneId === request.fromUserId ? fromUser?.titles?.[0]?.title : toUser?.titles?.[0]?.title) ?? '',
          avatar: resolveMediaUrl(
            (supportThread.userOneId === request.fromUserId ? fromUser?.avatars?.[0]?.imageUrl : toUser?.avatars?.[0]?.imageUrl),
            true
          ) || '',
        },
        userTwo: {
          id: supportThread.userTwoId,
          name: supportThread.userTwoId === request.fromUserId ? fromUserName : toUserName,
          title: (supportThread.userTwoId === request.fromUserId ? fromUser?.titles?.[0]?.title : toUser?.titles?.[0]?.title) ?? '',
          avatar: resolveMediaUrl(
            (supportThread.userTwoId === request.fromUserId ? fromUser?.avatars?.[0]?.imageUrl : toUser?.avatars?.[0]?.imageUrl),
            true
          ) || '',
        },
      };

      const acceptedEvent = {
        requestId: request.id,
        threadId: supportThread.id,
        senderId: request.fromUserId,
        recipientId: request.toUserId,
        messageType: 'support-request-accepted' as const,
        timestamp: new Date().toISOString(),
        participants, // Participants bilgilerini ekle
      };

      // Her iki kullanıcıya da bildir
      socketHandler.sendMessageToUser(request.fromUserId, 'support_request_accepted', acceptedEvent);
      socketHandler.sendMessageToUser(request.toUserId, 'support_request_accepted', acceptedEvent);

      // Request gönderen kullanıcıya bildirim gönder
      // Her zaman DM_REQUEST_ACCEPTED gönder (1-on-1 request kabul edildi)
      if (toUser) {
        const expertUserName = toUser.profile?.displayName || toUser.profile?.userName || toUser.email || 'Kullanıcı';
        await this.notificationService.sendNotification(
          request.fromUserId,
          NotificationType.DM_REQUEST_ACCEPTED,
          {
            // Mobil navigasyon için gerekli fieldlar
            userId: toUser.id, // Request'i kabul eden kişinin ID'si (avatar için)
            userName: expertUserName, // Kullanıcı adı (displayName, userName veya email)
            threadId: supportThread.id, // Thread ID (direkt thread'e yönlendirme için)
            // Participants bilgilerini ekle (thread açıldığında userOne userTwo için)
            participants: {
              userOne: participants.userOne,
              userTwo: participants.userTwo,
            },
          }
        );
      }
    } catch (error) {
      logger.error(`Failed to get participants or send notification:`, error);
      // Participants alınamazsa bile socket event'i gönder (geriye dönük uyumluluk için)
      const acceptedEvent = {
        requestId: request.id,
        threadId: supportThread.id,
        senderId: request.fromUserId,
        recipientId: request.toUserId,
        messageType: 'support-request-accepted' as const,
        timestamp: new Date().toISOString(),
      };
      socketHandler.sendMessageToUser(request.fromUserId, 'support_request_accepted', acceptedEvent);
      socketHandler.sendMessageToUser(request.toUserId, 'support_request_accepted', acceptedEvent);
      
      // Notification göndermeyi dene (basit versiyon)
      try {
        const expert = await this.prisma.user.findUnique({
          where: { id: expertUserId },
          include: { profile: true },
        });
        if (expert) {
          const userName = expert.profile?.displayName || expert.profile?.userName || expert.email || 'Kullanıcı';
          await this.notificationService.sendNotification(
            request.fromUserId,
            NotificationType.DM_REQUEST_ACCEPTED,
            {
              userId: expert.id,
              userName: userName,
              threadId: supportThread.id,
            }
          );
        }
      } catch (notifError) {
        logger.error(`Failed to send DM_REQUEST_ACCEPTED notification:`, notifError);
      }
    }

    // Cache invalidation
    invalidateDMCache(request.fromUserId, supportThread.id).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });
    invalidateDMCache(request.toUserId, supportThread.id).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info(`Support request ${requestId} accepted by ${expertUserId}, thread ${supportThread.id} created`);

    return {
      requestId: request.id,
      threadId: supportThread.id,
    };
  }

  /**
   * Support request'i sender tarafından cancel et
   */
  async cancelSupportRequest(
    requestId: string,
    requesterId: string
  ): Promise<void> {
    const request = await this.dmRequestRepo.findById(requestId);
    if (!request) {
      throw new Error('Support request not found');
    }

    if (request.fromUserId !== requesterId) {
      throw new Error('Only the sender can cancel the support request');
    }

    if (!request.isPending()) {
      throw new Error('Only pending support requests can be canceled');
    }

    await this.dmRequestRepo.update(requestId, {
      status: DMRequestStatus.CANCELED,
      respondedAt: new Date(),
      threadId: null,
    });

    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const cancelledEvent = {
      requestId: request.id,
      status: 'canceled' as const,
      timestamp: new Date().toISOString(),
    };

    socketHandler.sendMessageToUser(request.fromUserId, 'support_request_cancelled', cancelledEvent);
    socketHandler.sendMessageToUser(request.toUserId, 'support_request_cancelled', cancelledEvent);

    // Cache invalidation
    invalidateDMCache(request.fromUserId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });
    invalidateDMCache(request.toUserId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info(`Support request ${requestId} cancelled by ${requesterId}`);
  }

  /**
   * Support request'i reject et
   */
  async rejectSupportRequest(
    requestId: string,
    expertUserId: string
  ): Promise<void> {
    const request = await this.dmRequestRepo.findById(requestId);
    if (!request) {
      throw new Error('Support request not found');
    }

    // Sadece alıcı (expert) reject edebilir
    if (request.toUserId !== expertUserId) {
      throw new Error('Only the recipient can reject the support request');
    }

    // Sadece pending request'ler reject edilebilir
    if (!request.isPending()) {
      throw new Error('Only pending support requests can be rejected');
    }

    // Request'i DECLINED yap
    await this.dmRequestRepo.update(requestId, {
      status: DMRequestStatus.DECLINED,
      respondedAt: new Date(),
    });

    // Socket bildirimi gönder - support request rejected
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    
    const rejectedEvent = {
      requestId: request.id,
      senderId: request.fromUserId,
      recipientId: request.toUserId,
      messageType: 'support-request-rejected' as const,
      timestamp: new Date().toISOString(),
    };

    // Göndericiye bildir
    socketHandler.sendMessageToUser(request.fromUserId, 'support_request_rejected', rejectedEvent);

    // Request gönderen kullanıcıya bildirim gönder (DM_REQUEST_DECLINED)
    try {
      const expert = await this.userRepo.findById(expertUserId);
      if (expert) {
        await this.notificationService.sendNotification(
          request.fromUserId,
          NotificationType.DM_REQUEST_DECLINED,
          {
            // Mobil navigasyon için gerekli fieldlar
            userId: expert.id, // Request'i reddeden kişinin ID'si (avatar için)
            userName: expert.name || expert.email,
          }
        );
      }
    } catch (error) {
      logger.error(`Failed to send DM_REQUEST_DECLINED notification:`, error);
      // Don't throw - notification failure shouldn't break the reject flow
    }

    // Cache invalidation
    invalidateDMCache(request.fromUserId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });
    invalidateDMCache(request.toUserId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info(`Support request ${requestId} rejected by ${expertUserId}`);
  }

  /**
   * Support request'i kapat ve rating ver
   * İlk kullanıcı close yaptığında AWAITING_COMPLETION olur
   * Karşı taraf finalize endpoint'i ile onaylayacak
   */
  async closeSupportRequest(
    requestId: string,
    userId: string,
    rating: number // 1-5 arası
  ): Promise<void> {
    const request = await this.dmRequestRepo.findById(requestId);
    if (!request) {
      throw new Error('Support request not found');
    }

    // Kullanıcının request'te rolü var mı kontrol et
    if (!request.involveUser(userId)) {
      throw new Error('User is not part of this support request');
    }

    // Sadece ACCEPTED request'ler close edilebilir
    if (!request.isAccepted()) {
      throw new Error('Only accepted support requests can be closed');
    }

    // Rating 1-5 arası olmalı
    if (!rating || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Zaten close yapmışsa tekrar yapamaz
    if (request.isClosedByUser(userId)) {
      throw new Error('User has already closed this request');
    }

    const now = new Date();
    const isFromUser = request.belongsToSender(userId);
    
    // ThreadId'yi koru (completed durumunda da threadId korunmalı - mesaj geçmişi görüntülenebilmeli)
    const currentThreadId = request.threadId;
    
    const updateData: {
      fromUserRating?: number | null;
      toUserRating?: number | null;
      closedByFromUserAt?: Date | null;
      closedByToUserAt?: Date | null;
      status?: DMRequestStatus;
      threadId?: string | null;
    } = {};

    // Rating ve close timestamp'i kaydet
    if (isFromUser) {
      updateData.fromUserRating = rating;
      updateData.closedByFromUserAt = now;
    } else {
      updateData.toUserRating = rating;
      updateData.closedByToUserAt = now;
    }

    // İlk close yapan kullanıcı için AWAITING_COMPLETION yap
    // Karşı taraf finalize endpoint'i ile onaylayacak
    updateData.status = DMRequestStatus.AWAITING_COMPLETION;

    // ThreadId'yi koru (completed durumunda da threadId korunmalı)
    if (currentThreadId !== undefined) {
      updateData.threadId = currentThreadId;
    }

    await this.dmRequestRepo.update(requestId, updateData);

    // Socket bildirimi gönder
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const closedEvent = {
      requestId: request.id,
      status: 'awaiting_completion' as const,
      userId,
      rating,
      timestamp: now.toISOString(),
      needsFinalize: true, // Karşı tarafın finalize yapması gerekiyor
    };

    // Her iki kullanıcıya da bildir
    socketHandler.sendMessageToUser(request.fromUserId, 'support_request_closed', closedEvent);
    socketHandler.sendMessageToUser(request.toUserId, 'support_request_closed', closedEvent);

    // Cache invalidation
    const closeThreadId = (request as unknown as { threadId?: string }).threadId;
    invalidateDMCache(request.fromUserId, closeThreadId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });
    invalidateDMCache(request.toUserId, closeThreadId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info(`Support request ${requestId} closed by ${userId} with rating ${rating}, status: AWAITING_COMPLETION (waiting for finalize)`);
  }

  /**
   * Support request'i finalize et (karşı tarafın close'unu onayla)
   * AWAITING_COMPLETION durumundaki request'i COMPLETED yapar
   */
  async finalizeSupportRequest(
    requestId: string,
    userId: string,
    rating: number // 1-5 arası
  ): Promise<void> {
    const request = await this.dmRequestRepo.findById(requestId);
    if (!request) {
      throw new Error('Support request not found');
    }

    // Kullanıcının request'te rolü var mı kontrol et
    if (!request.involveUser(userId)) {
      throw new Error('User is not part of this support request');
    }

    // Sadece AWAITING_COMPLETION durumundaki request'ler finalize edilebilir
    if (request.status !== DMRequestStatus.AWAITING_COMPLETION) {
      throw new Error('Only awaiting_completion support requests can be finalized');
    }

    // Rating 1-5 arası olmalı
    if (!rating || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Zaten close yapmışsa tekrar yapamaz
    if (request.isClosedByUser(userId)) {
      throw new Error('User has already closed this request');
    }

    // Karşı taraf close yapmış olmalı
    const isFromUser = request.belongsToSender(userId);
    const otherUserClosed = isFromUser 
      ? request.closedByToUserAt !== null
      : request.closedByFromUserAt !== null;

    if (!otherUserClosed) {
      throw new Error('Other user has not closed the request yet');
    }

    const now = new Date();
    
    // ThreadId'yi koru (completed durumunda da threadId korunmalı - mesaj geçmişi görüntülenebilmeli)
    const currentThreadId = request.threadId;
    
    const updateData: {
      fromUserRating?: number | null;
      toUserRating?: number | null;
      closedByFromUserAt?: Date | null;
      closedByToUserAt?: Date | null;
      status?: DMRequestStatus;
      threadId?: string | null;
    } = {
      status: DMRequestStatus.COMPLETED, // Finalize ile COMPLETED yap
    };

    // Rating ve close timestamp'i kaydet
    if (isFromUser) {
      updateData.fromUserRating = rating;
      updateData.closedByFromUserAt = now;
    } else {
      updateData.toUserRating = rating;
      updateData.closedByToUserAt = now;
    }

    // ThreadId'yi koru (completed durumunda da threadId korunmalı)
    if (currentThreadId !== undefined) {
      updateData.threadId = currentThreadId;
    }

    await this.dmRequestRepo.update(requestId, updateData);

    // Socket bildirimi gönder
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const finalizedEvent = {
      requestId: request.id,
      status: 'completed' as const,
      userId,
      rating,
      timestamp: now.toISOString(),
      finalized: true, // Finalize ile tamamlandı
    };

    // Her iki kullanıcıya da bildir
    socketHandler.sendMessageToUser(request.fromUserId, 'support_request_finalized', finalizedEvent);
    socketHandler.sendMessageToUser(request.toUserId, 'support_request_finalized', finalizedEvent);

    // Cache invalidation
    const finalizeThreadId = (request as unknown as { threadId?: string }).threadId;
    invalidateDMCache(request.fromUserId, finalizeThreadId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });
    invalidateDMCache(request.toUserId, finalizeThreadId).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info(`Support request ${requestId} finalized by ${userId} with rating ${rating}, status: COMPLETED`);
  }

  /**
   * AWAITING_COMPLETION durumundaki request'leri 1 gün sonra otomatik olarak COMPLETED yap
   * Sadece bir kullanıcı close yaptıysa ve 1 gün geçtiyse, diğer kullanıcının da close yapmış gibi işle
   */
  async autoCompleteAwaitingRequests(): Promise<void> {
    try {
      // AWAITING_COMPLETION durumundaki tüm request'leri bul
      // Tüm kullanıcıların request'lerini almak için Prisma'yı direkt kullanıyoruz
      const awaitingRequests = await this.prisma.dMRequest.findMany({
        where: {
          status: 'AWAITING_COMPLETION',
          description: { not: null }, // Support requests only
        },
        include: {
          fromUser: {
            include: {
              profile: true,
            },
          },
          toUser: {
            include: {
              profile: true,
            },
          },
        },
      });

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 gün önce
      // Worker HTTP server'dan önce çalışabilir; SocketHandler henüz initialize edilmemiş olabilir
      let socketHandler: SocketHandler | null = null;
      try {
        socketHandler = SocketManager.getInstance().getSocketHandler();
      } catch {
        socketHandler = null;
      }

      let completedCount = 0;

      for (const prismaRequest of awaitingRequests) {
        const request = this.dmRequestRepo.toDomain(prismaRequest as unknown as Parameters<typeof this.dmRequestRepo.toDomain>[0]);
        if (!request) continue;

        // Sadece AWAITING_COMPLETION durumundaki request'ler
        if (request.status !== DMRequestStatus.AWAITING_COMPLETION) continue;

        // Prisma request'inden closed timestamps'leri al (domain entity'de henüz güncel olmayabilir)
        const closedByFromUserAt = prismaRequest.closedByFromUserAt;
        const closedByToUserAt = prismaRequest.closedByToUserAt;

        // Hangi kullanıcı close yaptı ve ne zaman?
        let closedTimestamp: Date | null = null;
        let closedByUserId: string | null = null;
        let needsAutoClose = false;

        if (closedByFromUserAt && !closedByToUserAt) {
          // Sadece fromUser close yaptı, toUser yapmadı
          if (closedByFromUserAt <= oneDayAgo) {
            closedTimestamp = closedByFromUserAt;
            closedByUserId = request.fromUserId;
            needsAutoClose = true;
          }
        } else if (closedByToUserAt && !closedByFromUserAt) {
          // Sadece toUser close yaptı, fromUser yapmadı
          if (closedByToUserAt <= oneDayAgo) {
            closedTimestamp = closedByToUserAt;
            closedByUserId = request.toUserId;
            needsAutoClose = true;
          }
        }

        if (needsAutoClose && closedTimestamp && closedByUserId) {
          // Diğer kullanıcının da close yapmış gibi işle
          // Rating'i yoksa varsayılan olarak 3 ver (orta değer)
          const isFromUser = closedByUserId === request.fromUserId;
          
          // ThreadId'yi koru (completed durumunda da threadId korunmalı - mesaj geçmişi görüntülenebilmeli)
          const currentThreadId = prismaRequest.threadId;
          
          const updateData: {
            fromUserRating?: number | null;
            toUserRating?: number | null;
            closedByFromUserAt?: Date | null;
            closedByToUserAt?: Date | null;
            status?: DMRequestStatus;
            threadId?: string | null;
          } = {
            status: DMRequestStatus.COMPLETED,
          };

          if (isFromUser) {
            // fromUser close yaptı, toUser için otomatik close
            updateData.toUserRating = 3; // Varsayılan rating
            updateData.closedByToUserAt = now;
          } else {
            // toUser close yaptı, fromUser için otomatik close
            updateData.fromUserRating = 3; // Varsayılan rating
            updateData.closedByFromUserAt = now;
          }

          // ThreadId'yi koru (completed durumunda da threadId korunmalı)
          if (currentThreadId !== undefined) {
            updateData.threadId = currentThreadId;
          }

          await this.dmRequestRepo.update(request.id, updateData);

          // Socket bildirimi gönder (handler hazırsa)
          if (socketHandler) {
            const completedEvent = {
              requestId: request.id,
              status: 'completed' as const,
              userId: null, // Sistem otomatik olarak yaptı
              rating: 3,
              timestamp: now.toISOString(),
              autoCompleted: true,
            };
            socketHandler.sendMessageToUser(request.fromUserId, 'support_request_closed', completedEvent);
            socketHandler.sendMessageToUser(request.toUserId, 'support_request_closed', completedEvent);
          }

          completedCount++;
          logger.info(`Auto-completed support request ${request.id} after 1 day (closed by ${closedByUserId})`);
        }
      }

      if (completedCount > 0) {
        logger.info(`Auto-completed ${completedCount} support request(s) after 1 day`);
      }
    } catch (error: unknown) {
      logger.error('Error in autoCompleteAwaitingRequests:', error);
    }
  }

  /**
   * Support request için rapor oluştur
   */
  async reportSupportRequest(
    requestId: string,
    reporterId: string,
    category: SupportRequestReportCategory,
    description?: string | null,
  ): Promise<void> {
    const request = await this.dmRequestRepo.findById(requestId);
    if (!request) {
      throw new Error('Support request not found');
    }

    if (!request.involveUser(reporterId)) {
      throw new Error('Only participants can report the support request');
    }

    // Aynı kullanıcı aynı request'i birden fazla kez raporlayamaz
    const existingReport = await this.supportRequestReportRepo.findByRequestIdAndReporterId(requestId, reporterId);
    if (existingReport) {
      throw new Error('Bu destek talebi zaten raporlanmış. Her kullanıcı bir request için sadece bir kez rapor gönderebilir.');
    }

    const normalizedCategory = String(category || '').toUpperCase() as SupportRequestReportCategory;
    if (!SupportRequestService.REPORT_CATEGORIES.includes(normalizedCategory)) {
      throw new Error('Invalid report category');
    }

    const trimmedDescription = description?.trim();
    if (trimmedDescription && trimmedDescription.length > 500) {
      throw new Error('Description is too long');
    }
    await this.supportRequestReportRepo.create({
      requestId,
      reporterId,
      category: normalizedCategory,
      description: trimmedDescription || null,
    });

    // ThreadId'yi al (mesaj geçmişi görünsün diye korunacak)
    const requestThreadId = request.threadId;

    // Thread varsa kapat (isActive = false) - mesaj geçmişi görünsün ama yeni mesaj gönderilemesin
    if (requestThreadId) {
      await this.prisma.dMThread.update({
        where: { id: requestThreadId },
        data: { isActive: false },
      });
      logger.info(`Thread ${requestThreadId} closed after support request ${requestId} was reported`);
    }

    // Update request status to COMPLETED (raporlandıktan sonra completed olur)
    await this.dmRequestRepo.update(requestId, {
      status: DMRequestStatus.COMPLETED,
    });

    const socketHandler = SocketManager.getInstance().getSocketHandler();
    const reportEvent = {
      requestId: request.id,
      category: normalizedCategory,
      description: trimmedDescription || null,
      reporterId,
      timestamp: new Date().toISOString(),
    };

    socketHandler.sendMessageToUser(request.fromUserId, 'support_request_reported', reportEvent);
    socketHandler.sendMessageToUser(request.toUserId, 'support_request_reported', reportEvent);

    // Cache invalidation
    invalidateDMCache(request.fromUserId, requestThreadId ?? undefined).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });
    invalidateDMCache(request.toUserId, requestThreadId ?? undefined).catch((err) => {
      logger.warn('Failed to invalidate DM cache', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info(`Support request ${requestId} reported by ${reporterId} with category ${normalizedCategory}, status set to COMPLETED, thread closed`);
  }
}

