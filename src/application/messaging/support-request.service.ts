import { DMRequestPrismaRepository } from '../../infrastructure/repositories/dm-request-prisma.repository';
import { DMThreadPrismaRepository } from '../../infrastructure/repositories/dm-thread-prisma.repository';
import { SupportRequestStatus } from '../../domain/messaging/support-request-status.enum';
import { DMRequestStatus } from '../../domain/messaging/dm-request-status.enum';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import logger from '../../infrastructure/logger/logger';
import { PrismaClient } from '@prisma/client';

export interface SupportRequestListItem {
  id: string;
  userName: string;
  userTitle: string | null;
  userAvatar: string | null;
  requestDescription: string;
  status: SupportRequestStatus;
  threadId: string | null; // Accept edilmişse thread ID, yoksa null
}

export interface SupportRequestQueryOptions {
  status?: SupportRequestStatus;
  search?: string;
  limit?: number;
}

export class SupportRequestService {
  private dmRequestRepo = new DMRequestPrismaRepository();
  private dmThreadRepo = new DMThreadPrismaRepository();
  private prisma = new PrismaClient();

  /**
   * Kullanıcının birebir destek sohbetlerini listele
   */
  async getUserSupportRequests(
    userId: string,
    options: SupportRequestQueryOptions = {}
  ): Promise<SupportRequestListItem[]> {
    try {
      // Map SupportRequestStatus to DMRequestStatus for filtering
      let dmRequestStatus: DMRequestStatus | undefined;
      if (options.status === SupportRequestStatus.PENDING) {
        dmRequestStatus = DMRequestStatus.PENDING;
      } else if (options.status === SupportRequestStatus.ACTIVE) {
        dmRequestStatus = DMRequestStatus.ACCEPTED;
      } else if (options.status === SupportRequestStatus.COMPLETED) {
        // Completed: include both DECLINED and ACCEPTED without active thread.
        // Do NOT pre-filter by status here; fetch all and filter at service layer.
        dmRequestStatus = undefined;
      }

      // Get support requests (requests with description)
      // Don't apply limit here - we'll apply it after search filtering
      const requests = await this.dmRequestRepo.findSupportRequestsByUserId(userId, {
        status: dmRequestStatus,
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
        } as any,
        select: { id: true, isActive: true, userOneId: true, userTwoId: true },
      });

      // Thread'leri request'lere eşleştir
      // ÖNEMLİ: Request'in kendi threadId'sini kontrol et, yoksa userOneId/userTwoId'ye göre eşleştir
      const threadMap = new Map<string, { threadId: string; isActive: boolean }>();
      for (const request of requests) {
        // Type assertion: Prisma type'ında threadId tanımlı olmayabilir
        const requestThreadId = (request as any).threadId as string | null | undefined;
        
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
        const otherUserId = isFromUser ? request.toUserId : request.fromUserId;

        // Skip if no description
        if (!request.description) {
          continue;
        }

        // Determine support request status
        let supportStatus: SupportRequestStatus;
        const threadInfo = threadMap.get(request.id);
        
        if (request.status === DMRequestStatus.PENDING) {
          supportStatus = SupportRequestStatus.PENDING;
        } else if (request.status === DMRequestStatus.ACCEPTED) {
          supportStatus = threadInfo?.isActive ? SupportRequestStatus.ACTIVE : SupportRequestStatus.COMPLETED;
        } else {
          supportStatus = SupportRequestStatus.COMPLETED;
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
        const userAvatar = counterpart?.avatars?.[0]?.imageUrl ?? null;

        // ThreadId'yi belirle: Önce request'in kendi threadId'sini kontrol et, sonra threadMap'i kontrol et
        // PENDING durumunda request.threadId null olmalı, bu durumda threadInfo da null olacak
        const requestThreadId = (request as any).threadId as string | null | undefined;
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
        });
      }

      // If search is provided, filter by user name, title, or description
      let filteredRequests = supportRequests;
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        console.log('[Support Requests Service] Filtering with search:', searchLower);
        console.log('[Support Requests Service] Total requests before filter:', supportRequests.length);
        filteredRequests = supportRequests.filter((req) => {
          const matches = (
            req.userName.toLowerCase().includes(searchLower) ||
            req.userTitle?.toLowerCase().includes(searchLower) ||
            req.requestDescription.toLowerCase().includes(searchLower)
          );
          if (matches) {
            console.log('[Support Requests Service] Match found:', {
              userName: req.userName,
              userTitle: req.userTitle,
              descriptionPreview: req.requestDescription.substring(0, 50),
            });
          }
          return matches;
        });
        console.log('[Support Requests Service] Filtered requests count:', filteredRequests.length);
      }

      // Apply limit after search filtering
      if (options.limit) {
        filteredRequests = filteredRequests.slice(0, options.limit);
      }

      return filteredRequests;
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
    const request = await this.dmRequestRepo.create({
      fromUserId: senderId,
      toUserId: payload.recipientUserId,
      status: DMRequestStatus.PENDING,
      type: payload.type,
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
      } as any,
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

    // Sadece alıcı (expert) accept edebilir
    if (request.toUserId !== expertUserId) {
      throw new Error('Only the recipient can accept the support request');
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
    
    const acceptedEvent = {
      requestId: request.id,
      threadId: supportThread.id,
      senderId: request.fromUserId,
      recipientId: request.toUserId,
      messageType: 'support-request-accepted' as const,
      timestamp: new Date().toISOString(),
    };

    // Her iki kullanıcıya da bildir
    socketHandler.sendMessageToUser(request.fromUserId, 'support_request_accepted', acceptedEvent);
    socketHandler.sendMessageToUser(request.toUserId, 'support_request_accepted', acceptedEvent);

    logger.info(`Support request ${requestId} accepted by ${expertUserId}, thread ${supportThread.id} created`);

    return {
      requestId: request.id,
      threadId: supportThread.id,
    };
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

    logger.info(`Support request ${requestId} rejected by ${expertUserId}`);
  }
}

