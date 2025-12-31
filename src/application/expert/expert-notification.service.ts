import { PrismaClient } from '@prisma/client';
import { ExpertMatchingService } from './expert-matching.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import logger from '../../infrastructure/logger/logger';

export class ExpertNotificationService {
  private readonly prisma: PrismaClient;
  private readonly matchingService: ExpertMatchingService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.prisma = new PrismaClient();
    this.matchingService = new ExpertMatchingService();
    this.notificationService = new NotificationService();
  }

  /**
   * Expert request oluşturulduğunda ilgili kullanıcılara bildirim gönder
   */
  async notifyPotentialExperts(
    requestId: string,
    category: string | null,
    description: string,
    tipsAmount: number,
    requestUserId: string
  ): Promise<void> {
    try {
      // Potansiyel expert'leri bul
      const potentialExpertIds = await this.matchingService.findPotentialExperts(
        category,
        requestUserId
      );

      if (potentialExpertIds.length === 0) {
        logger.warn({
          message: 'No potential experts found for request',
          requestId,
          category,
        });
        return;
      }

      // Request bilgilerini al
      const request = await this.prisma.expertRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        logger.error({
          message: 'Expert request not found for notification',
          requestId,
        });
        return;
      }

      // Her expert için bildirim gönder
      const notificationPromises = potentialExpertIds.map(async (expertUserId) => {
        try {
          await this.notificationService.sendNotification(
            expertUserId,
            NotificationType.EXPERT_REQUEST_AVAILABLE,
            {
            requestId,
            category,
            description: description.substring(0, 100) + (description.length > 100 ? '...' : ''),
            tipsAmount,
            createdAt: request.createdAt.toISOString(),
            }
          );

          logger.debug({
            message: 'Expert notification sent',
            requestId,
            expertUserId,
          });
        } catch (error) {
          logger.error({
            message: 'Error sending notification to expert',
            requestId,
            expertUserId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.allSettled(notificationPromises);

      logger.info({
        message: 'Expert notifications sent',
        requestId,
        category,
        notifiedCount: potentialExpertIds.length,
      });
    } catch (error) {
      logger.error({
        message: 'Error notifying potential experts',
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Expert bir soruyu yanıtlamayı onayladığında request sahibine bildirim gönder
   */
  async notifyRequestOwnerAboutExpertFound(
    requestId: string,
    expertUserId: string
  ): Promise<void> {
    try {
      const request = await this.prisma.expertRequest.findUnique({
        where: { id: requestId },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      });

      if (!request) {
        logger.error({
          message: 'Expert request not found',
          requestId,
        });
        return;
      }

      // Expert bilgilerini al
      const expert = await this.prisma.user.findUnique({
        where: { id: expertUserId },
        include: {
          profile: true,
          titles: true,
          avatars: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!expert) {
        logger.error({
          message: 'Expert user not found',
          expertUserId,
        });
        return;
      }

      // Request sahibine Socket.IO bildirimi
      const { default: SocketManager } = await import('../../infrastructure/realtime/socket-manager');
      const socketHandler = SocketManager.getInstance().getSocketHandler();
      socketHandler.sendMessageToUser(request.userId, 'expert_found', {
        type: 'EXPERT_FOUND',
        requestId,
        expert: {
          id: expert.id,
          name: expert.profile?.displayName || 'Expert',
          title: expert.titles?.map((t: any) => t.title) || [],
          avatar: expert.avatars?.[0]?.imageUrl || null,
        },
        message: 'Bir uzman sorunuzla ilgilenmeye başladı!',
        timestamp: new Date().toISOString(),
      });

      logger.info({
        message: 'Expert found notification sent to request owner',
        requestId,
        requestOwnerId: request.userId,
        expertUserId,
      });
    } catch (error) {
      logger.error({
        message: 'Error notifying request owner about expert found',
        requestId,
        expertUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

