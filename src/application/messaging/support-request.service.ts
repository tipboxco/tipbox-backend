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

      // Get thread activity map to determine support request status
      const threadMap = await this.dmThreadRepo.getThreadActivityMap(userId);

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
        
        if (request.status === DMRequestStatus.PENDING) {
          supportStatus = SupportRequestStatus.PENDING;
        } else if (request.status === DMRequestStatus.ACCEPTED) {
          const threadInfo = threadMap.get(otherUserId);
          
          if (threadInfo && threadInfo.isActive) {
            supportStatus = SupportRequestStatus.ACTIVE;
          } else {
            supportStatus = SupportRequestStatus.COMPLETED;
          }
        } else {
          // DECLINED requests are considered completed
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

        supportRequests.push({
          id: request.id,
          userName,
          userTitle,
          userAvatar,
          requestDescription: request.description,
          status: supportStatus,
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

    // Thread oluştur veya mevcut thread'i al
    const existingThread = await this.prisma.dMThread.findFirst({
      where: {
        OR: [
          { userOneId: senderId, userTwoId: payload.recipientUserId },
          { userOneId: payload.recipientUserId, userTwoId: senderId },
        ],
      },
    });

    let threadId: string;
    if (!existingThread) {
      const newThread = await this.dmThreadRepo.create({
        userOneId: senderId,
        userTwoId: payload.recipientUserId,
        isActive: true,
        startedAt: new Date(),
      });
      threadId = newThread.id;
    } else {
      threadId = existingThread.id;
    }

    // Socket bildirimi gönder - new_message event'i (messageType: 'support-request')
    const socketHandler = SocketManager.getInstance().getSocketHandler();
    
    const newMessageEvent = {
      messageId: request.id,
      threadId: threadId,
      senderId: senderId,
      recipientId: payload.recipientUserId,
      message: payload.message,
      messageType: 'support-request' as const,
      timestamp: request.sentAt.toISOString(),
    };

    // Alıcıya kendi odasına gönder
    socketHandler.sendMessageToUser(payload.recipientUserId, 'new_message', newMessageEvent);
    
    // Thread room'una gönder
    socketHandler.sendToRoom(`thread:${threadId}`, 'new_message', newMessageEvent);

    logger.info(`Support request created from ${senderId} to ${payload.recipientUserId}, socket events emitted`);
  }
}

