import { AuthenticatedSocket } from '../socket.handler';
import { SocketHandler } from '../socket.handler';
import logger from '../../logger/logger';
import { SupportRequestService } from '../../../application/messaging/support-request.service';
import { DMRequestPrismaRepository } from '../../repositories/dm-request-prisma.repository';
import { DMRequestStatus } from '../../../domain/messaging/dm-request-status.enum';

export class RequestSocketService {
  private socketHandler: SocketHandler;
  private supportRequestService: SupportRequestService;
  private requestRepo = new DMRequestPrismaRepository();

  constructor(socketHandler: SocketHandler) {
    this.socketHandler = socketHandler;
    this.supportRequestService = new SupportRequestService();
  }

  /**
   * Socket bağlantısı için request event handler'larını kur
   */
  public setupHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId;

    // Support request'i accept et
    socket.on('accept_support_request', async (data: { requestId: string }) => {
      try {
        const { requestId } = data;

        if (!requestId) {
          socket.emit('error', { message: 'requestId is required' });
          return;
        }

        // Request'i bul
        const request = await this.requestRepo.findById(requestId);
        if (!request) {
          socket.emit('error', { message: 'Support request not found' });
          return;
        }

        // Sadece alıcı (expert) accept edebilir
        if (request.toUserId !== userId) {
          socket.emit('error', {
            message: 'Only the recipient can accept the support request',
          });
          return;
        }

        // Sadece pending request'ler accept edilebilir
        if (!request.isPending()) {
          socket.emit('error', {
            message: 'Only pending support requests can be accepted',
          });
          return;
        }

        // SupportRequestService ile accept et
        const result = await this.supportRequestService.acceptSupportRequest(
          requestId,
          userId
        );

        // Socket event'leri zaten SupportRequestService tarafından gönderiliyor
        // Burada sadece onay gönderiyoruz
        socket.emit('support_request_accepted', {
          requestId: result.requestId,
          threadId: result.threadId,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Support request ${requestId} accepted by ${userId} via socket`
        );
      } catch (error: any) {
        logger.error('Error in accept_support_request handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to accept support request',
        });
      }
    });

    // Support request'i reject et
    socket.on('reject_support_request', async (data: { requestId: string }) => {
      try {
        const { requestId } = data;

        if (!requestId) {
          socket.emit('error', { message: 'requestId is required' });
          return;
        }

        // Request'i bul
        const request = await this.requestRepo.findById(requestId);
        if (!request) {
          socket.emit('error', { message: 'Support request not found' });
          return;
        }

        // Sadece alıcı (expert) reject edebilir
        if (request.toUserId !== userId) {
          socket.emit('error', {
            message: 'Only the recipient can reject the support request',
          });
          return;
        }

        // Sadece pending request'ler reject edilebilir
        if (!request.isPending()) {
          socket.emit('error', {
            message: 'Only pending support requests can be rejected',
          });
          return;
        }

        // SupportRequestService ile reject et
        await this.supportRequestService.rejectSupportRequest(requestId, userId);

        // Socket event'leri zaten SupportRequestService tarafından gönderiliyor
        // Burada sadece onay gönderiyoruz
        socket.emit('support_request_rejected', {
          requestId,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Support request ${requestId} rejected by ${userId} via socket`
        );
      } catch (error: any) {
        logger.error('Error in reject_support_request handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to reject support request',
        });
      }
    });

    // Support request'i iptal et
    socket.on('cancel_support_request', async (data: { requestId: string }) => {
      try {
        const { requestId } = data;

        if (!requestId) {
          socket.emit('error', { message: 'requestId is required' });
          return;
        }

        // Request'i bul
        const request = await this.requestRepo.findById(requestId);
        if (!request) {
          socket.emit('error', { message: 'Support request not found' });
          return;
        }

        // Sadece gönderen (fromUserId) iptal edebilir
        if (request.fromUserId !== userId) {
          socket.emit('error', {
            message: 'Only the sender can cancel the support request',
          });
          return;
        }

        // Sadece pending veya accepted request'ler iptal edilebilir
        if (
          request.status !== DMRequestStatus.PENDING &&
          request.status !== DMRequestStatus.ACCEPTED
        ) {
          socket.emit('error', {
            message:
              'Only pending or accepted support requests can be cancelled',
          });
          return;
        }

        // SupportRequestService ile iptal et
        await this.supportRequestService.cancelSupportRequest(requestId, userId);

        // Socket event'leri zaten SupportRequestService tarafından gönderiliyor
        // Burada sadece onay gönderiyoruz
        socket.emit('support_request_cancelled', {
          requestId,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Support request ${requestId} cancelled by ${userId} via socket`
        );
      } catch (error: any) {
        logger.error('Error in cancel_support_request handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to cancel support request',
        });
      }
    });
  }
}


