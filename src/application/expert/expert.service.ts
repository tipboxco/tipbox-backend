import { PrismaClient } from '@prisma/client';
import { ExpertRequestPrismaRepository } from '../../infrastructure/repositories/expert-request-prisma.repository';
import { ExpertAnswerPrismaRepository } from '../../infrastructure/repositories/expert-answer-prisma.repository';
import { ExpertRequestMediaPrismaRepository } from '../../infrastructure/repositories/expert-request-media-prisma.repository';
import { ExpertNotificationService } from './expert-notification.service';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserTitlePrismaRepository } from '../../infrastructure/repositories/user-title-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { ExpertRequestStatus } from '../../domain/expert/expert-request-status.enum';
import {
  CreateExpertRequestDto,
  UpdateExpertRequestTipsDto,
  CreateExpertAnswerDto,
  ExpertRequestResponse,
  ExpertAnswerResponse,
  ExpertAnsweredDetailResponse,
  ExpertAnswerDetailResponse,
  MyExpertRequestsResponse,
} from '../../interfaces/expert/expert.dto';
import logger from '../../infrastructure/logger/logger';

export class ExpertService {
  private readonly prisma: PrismaClient;
  private readonly expertRequestRepo: ExpertRequestPrismaRepository;
  private readonly expertAnswerRepo: ExpertAnswerPrismaRepository;
  private readonly expertMediaRepo: ExpertRequestMediaPrismaRepository;
  private readonly expertNotificationService: ExpertNotificationService;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly titleRepo: UserTitlePrismaRepository;
  private readonly avatarRepo: UserAvatarPrismaRepository;

  constructor() {
    this.prisma = new PrismaClient();
    this.expertRequestRepo = new ExpertRequestPrismaRepository();
    this.expertAnswerRepo = new ExpertAnswerPrismaRepository();
    this.expertMediaRepo = new ExpertRequestMediaPrismaRepository();
    this.expertNotificationService = new ExpertNotificationService();
    this.profileRepo = new ProfilePrismaRepository();
    this.titleRepo = new UserTitlePrismaRepository();
    this.avatarRepo = new UserAvatarPrismaRepository();
  }

  /**
   * Uzman desteği almak için gönderi oluştur
   */
  async createExpertRequest(
    userId: string,
    dto: CreateExpertRequestDto
  ): Promise<ExpertRequestResponse> {
    try {
      const request = await this.expertRequestRepo.create(
        userId,
        dto.description,
        dto.tipsAmount || 0,
        dto.category
      );

      // Media'ları oluştur
      if (dto.mediaUrls && dto.mediaUrls.length > 0) {
        for (const media of dto.mediaUrls) {
          await this.expertMediaRepo.create(request.id, media.url, media.type);
        }
      }

      // Media'ları da dahil ederek response döndür
      const mediaList = await this.expertMediaRepo.findByRequestId(request.id);
      const response = this.mapToResponse(request);
      response.media = mediaList.map((m) => ({
        id: m.id,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        uploadedAt: m.uploadedAt.toISOString(),
      }));

      // Request'i BROADCASTING durumuna güncelle
      await this.expertRequestRepo.update(request.id, {
        status: ExpertRequestStatus.BROADCASTING,
      });

      // Potansiyel expert'lere bildirim gönder (asenkron)
      this.expertNotificationService
        .notifyPotentialExperts(
          request.id,
          dto.category || null,
          dto.description,
          dto.tipsAmount || 0,
          userId
        )
        .catch((error) => {
          logger.error({
            message: 'Error sending expert notifications',
            requestId: request.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      logger.info({
        message: 'Expert request created',
        userId,
        requestId: request.id,
      });

      return response;
    } catch (error) {
      logger.error({
        message: 'Error creating expert request',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Oluşturulan isteğin zaman içerisinde TIPS miktarını güncelle
   */
  async updateExpertRequestTips(
    userId: string,
    requestId: string,
    dto: UpdateExpertRequestTipsDto
  ): Promise<ExpertRequestResponse> {
    try {
      // İsteğin kullanıcıya ait olduğunu kontrol et
      const existingRequest = await this.expertRequestRepo.findById(requestId);
      if (!existingRequest) {
        throw new Error('Expert request not found');
      }

      if (!existingRequest.belongsToUser(userId)) {
        throw new Error('Unauthorized: Request does not belong to user');
      }

      if (!existingRequest.canUpdateTips()) {
        throw new Error('Cannot update tips: Request is not in PENDING status');
      }

      if (dto.tipsAmount < 0) {
        throw new Error('Tips amount cannot be negative');
      }

      const updatedRequest = await this.expertRequestRepo.updateTipsAmount(
        requestId,
        dto.tipsAmount
      );

      if (!updatedRequest) {
        throw new Error('Failed to update expert request');
      }

      logger.info({
        message: 'Expert request tips updated',
        userId,
        requestId,
        tipsAmount: dto.tipsAmount,
      });

      return this.mapToResponse(updatedRequest);
    } catch (error) {
      logger.error({
        message: 'Error updating expert request tips',
        userId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Uzman desteğinin yanıtlanması durumunda cevaplanmış içeriğin detaylarını göster
   */
  async getAnsweredExpertRequests(): Promise<ExpertAnswerResponse[]> {
    try {
      const answeredRequests = await this.expertRequestRepo.findAnsweredRequests();

      const result: ExpertAnswerResponse[] = [];

      for (const request of answeredRequests) {
        const answers = await this.expertAnswerRepo.findByRequestId(request.id);

        for (const answer of answers) {
          // Expert user bilgilerini getir
          const expertProfile = await this.profileRepo.findByUserId(answer.expertUserId);
          const expertTitles = await this.titleRepo.findByUserId(answer.expertUserId);
          const expertAvatar = await this.avatarRepo.findActiveByUserId(answer.expertUserId);

          const expertUser = {
            id: answer.expertUserId,
            name: expertProfile?.displayName || 'Anonymous',
            title: expertTitles.map((t) => t.title),
            avatar: expertAvatar?.imageUrl || null,
          };

          result.push({
            question: {
              description: request.description,
            },
            answer: {
              user: expertUser,
              content: answer.content,
            },
          });
        }
      }

      logger.info({
        message: 'Answered expert requests retrieved',
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error({
        message: 'Error getting answered expert requests',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Belirli bir isteğin detaylarını getir (cevaplanmış ise)
   */
  async getExpertRequestDetail(
    requestId: string
  ): Promise<ExpertAnsweredDetailResponse | null> {
    try {
      const request = await this.expertRequestRepo.findById(requestId);

      if (!request || !request.isAnswered()) {
        return null;
      }

      const answers = await this.expertAnswerRepo.findByRequestId(requestId);
      const mediaList = await this.expertMediaRepo.findByRequestId(requestId);

      const answerDetails = await Promise.all(
        answers.map(async (answer) => {
          const expertProfile = await this.profileRepo.findByUserId(answer.expertUserId);
          const expertTitles = await this.titleRepo.findByUserId(answer.expertUserId);
          const expertAvatar = await this.avatarRepo.findActiveByUserId(answer.expertUserId);

          return {
            id: answer.id,
            user: {
              id: answer.expertUserId,
              name: expertProfile?.displayName || 'Anonymous',
              title: expertTitles.map((t) => t.title),
              avatar: expertAvatar?.imageUrl || null,
            },
            content: answer.content,
            createdAt: answer.createdAt.toISOString(),
          };
        })
      );

      return {
        id: request.id,
        description: request.description,
        category: request.category || null,
        tipsAmount: request.tipsAmount,
        createdAt: request.createdAt.toISOString(),
        answeredAt: request.answeredAt?.toISOString() || '',
        media: mediaList.map((m) => ({
          id: m.id,
          mediaUrl: m.mediaUrl,
          mediaType: m.mediaType,
          uploadedAt: m.uploadedAt.toISOString(),
        })),
        answers: answerDetails,
      };
    } catch (error) {
      logger.error({
        message: 'Error getting expert request detail',
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının kendi answered request'lerini getir
   */
  async getMyAnsweredRequests(userId: string): Promise<ExpertRequestResponse[]> {
    try {
      const allRequests = await this.expertRequestRepo.findByUserId(userId);
      const answeredRequests = allRequests.filter((r) => r.isAnswered());

      logger.info({
        message: 'User answered requests retrieved',
        userId,
        count: answeredRequests.length,
      });

      return answeredRequests.map((request) => this.mapToResponse(request));
    } catch (error) {
      logger.error({
        message: 'Error getting user answered requests',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının kendi pending request'lerini getir
   */
  async getMyPendingRequests(userId: string): Promise<ExpertRequestResponse[]> {
    try {
      const allRequests = await this.expertRequestRepo.findByUserId(userId);
      const pendingRequests = allRequests.filter((r) => r.isPending());

      logger.info({
        message: 'User pending requests retrieved',
        userId,
        count: pendingRequests.length,
      });

      return pendingRequests.map((request) => this.mapToResponse(request));
    } catch (error) {
      logger.error({
        message: 'Error getting user pending requests',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının kendi request'lerini getir (answered ve pending)
   */
  async getMyExpertRequests(userId: string): Promise<MyExpertRequestsResponse> {
    try {
      const allRequests = await this.expertRequestRepo.findByUserId(userId);
      const answeredRequests = allRequests.filter((r) => r.isAnswered());
      const pendingRequests = allRequests.filter((r) => r.isPending());

      logger.info({
        message: 'User expert requests retrieved',
        userId,
        answeredCount: answeredRequests.length,
        pendingCount: pendingRequests.length,
      });

      return {
        answered: answeredRequests.map((request) => this.mapToResponse(request)),
        pending: pendingRequests.map((request) => this.mapToResponse(request)),
      };
    } catch (error) {
      logger.error({
        message: 'Error getting user expert requests',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Expert bir soruyu yanıtlamayı onaylar (EXPERT_FOUND durumuna geçer)
   */
  async acceptToAnswer(
    expertUserId: string,
    requestId: string
  ): Promise<ExpertRequestResponse> {
    try {
      const request = await this.expertRequestRepo.findById(requestId);
      if (!request) {
        throw new Error('Expert request not found');
      }

      if (!request.canBeAnswered() && request.status !== ExpertRequestStatus.BROADCASTING) {
        throw new Error('Cannot accept: Request is not available for answering');
      }

      if (request.belongsToUser(expertUserId)) {
        throw new Error('Cannot accept your own request');
      }

      // Zaten cevap vermiş mi kontrol et
      const existingAnswer = await this.expertAnswerRepo.findByRequestId(requestId);
      const hasMyAnswer = existingAnswer.some((a) => a.belongsToExpert(expertUserId));
      if (hasMyAnswer) {
        throw new Error('You have already answered this request');
      }

      // Request'i EXPERT_FOUND durumuna güncelle
      const updatedRequest = await this.expertRequestRepo.update(requestId, {
        status: ExpertRequestStatus.EXPERT_FOUND,
      });

      if (!updatedRequest) {
        throw new Error('Failed to update expert request');
      }

      // Request sahibine bildirim gönder
      await this.expertNotificationService.notifyRequestOwnerAboutExpertFound(
        requestId,
        expertUserId
      );

      logger.info({
        message: 'Expert accepted to answer request',
        expertUserId,
        requestId,
      });

      return this.mapToResponse(updatedRequest);
    } catch (error) {
      logger.error({
        message: 'Error accepting to answer',
        expertUserId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Expert'in bir request'e cevap vermesi
   */
  async createExpertAnswer(
    expertUserId: string,
    requestId: string,
    dto: CreateExpertAnswerDto
  ): Promise<ExpertAnswerDetailResponse> {
    try {
      // Request'i kontrol et
      const request = await this.expertRequestRepo.findById(requestId);
      if (!request) {
        throw new Error('Expert request not found');
      }

      if (
        !request.canBeAnswered() &&
        request.status !== ExpertRequestStatus.BROADCASTING &&
        request.status !== ExpertRequestStatus.EXPERT_FOUND
      ) {
        throw new Error('Cannot answer: Request is not available for answering');
      }

      // Expert'in kendi request'ine cevap verip veremeyeceğini kontrol et
      if (request.belongsToUser(expertUserId)) {
        throw new Error('Cannot answer your own request');
      }

      // Cevabı oluştur
      const answer = await this.expertAnswerRepo.create(requestId, expertUserId, dto.content);

      // Request'i ANSWERED durumuna güncelle
      await this.expertRequestRepo.update(requestId, {
        status: ExpertRequestStatus.ANSWERED,
        answeredAt: new Date(),
      });

      // Expert user bilgilerini getir
      const expertProfile = await this.profileRepo.findByUserId(expertUserId);
      const expertTitles = await this.titleRepo.findByUserId(expertUserId);
      const expertAvatar = await this.avatarRepo.findActiveByUserId(expertUserId);

      logger.info({
        message: 'Expert answer created',
        expertUserId,
        requestId,
        answerId: answer.id,
      });

      return {
        id: answer.id,
        requestId: answer.requestId,
        expertUserId: answer.expertUserId,
        content: answer.content,
        createdAt: answer.createdAt.toISOString(),
        updatedAt: answer.updatedAt.toISOString(),
        request: {
          id: request.id,
          description: request.description,
          tipsAmount: request.tipsAmount,
          status: ExpertRequestStatus.ANSWERED,
          userId: request.userId,
        },
        expertUser: {
          id: expertUserId,
          name: expertProfile?.displayName || 'Anonymous',
          title: expertTitles.map((t) => t.title),
          avatar: expertAvatar?.imageUrl || null,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Error creating expert answer',
        expertUserId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Expert'in verdiği cevapları getir
   */
  async getMyExpertAnswers(expertUserId: string): Promise<ExpertAnswerDetailResponse[]> {
    try {
      // Tüm cevaplanmış request'leri getir
      const answeredRequests = await this.expertRequestRepo.findAnsweredRequests();

      const myAnswers: ExpertAnswerDetailResponse[] = [];

      for (const request of answeredRequests) {
        const answers = await this.expertAnswerRepo.findByRequestId(request.id);
        const myAnswer = answers.find((a) => a.belongsToExpert(expertUserId));

        if (myAnswer) {
          const expertProfile = await this.profileRepo.findByUserId(expertUserId);
          const expertTitles = await this.titleRepo.findByUserId(expertUserId);
          const expertAvatar = await this.avatarRepo.findActiveByUserId(expertUserId);

          myAnswers.push({
            id: myAnswer.id,
            requestId: myAnswer.requestId,
            expertUserId: myAnswer.expertUserId,
            content: myAnswer.content,
            createdAt: myAnswer.createdAt.toISOString(),
            updatedAt: myAnswer.updatedAt.toISOString(),
            request: {
              id: request.id,
              description: request.description,
              tipsAmount: request.tipsAmount,
              status: request.status,
              userId: request.userId,
            },
            expertUser: {
              id: expertUserId,
              name: expertProfile?.displayName || 'Anonymous',
              title: expertTitles.map((t) => t.title),
              avatar: expertAvatar?.imageUrl || null,
            },
          });
        }
      }

      logger.info({
        message: 'Expert answers retrieved',
        expertUserId,
        count: myAnswers.length,
      });

      return myAnswers;
    } catch (error) {
      logger.error({
        message: 'Error getting expert answers',
        expertUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcı bir cevabı kabul eder (Accept Answer)
   */
  async acceptExpertAnswer(
    userId: string,
    requestId: string,
    dto: { answerId?: string } = {}
  ): Promise<ExpertRequestResponse> {
    try {
      // Request'i kontrol et
      const request = await this.expertRequestRepo.findById(requestId);
      if (!request) {
        throw new Error('Expert request not found');
      }

      if (!request.belongsToUser(userId)) {
        throw new Error('Unauthorized: Request does not belong to user');
      }

      if (!request.isAnswered()) {
        throw new Error('Cannot accept answer: Request has not been answered yet');
      }

      // Request'i CLOSED durumuna güncelle
      const updatedRequest = await this.expertRequestRepo.update(requestId, {
        status: ExpertRequestStatus.CLOSED,
      });

      if (!updatedRequest) {
        throw new Error('Failed to accept expert answer');
      }

      logger.info({
        message: 'Expert answer accepted',
        userId,
        requestId,
        answerId: dto.answerId,
      });

      return this.mapToResponse(updatedRequest);
    } catch (error) {
      logger.error({
        message: 'Error accepting expert answer',
        userId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Expert request status'ünü getir (frontend polling için)
   */
  async getExpertRequestStatus(requestId: string): Promise<{
    id: string;
    status: ExpertRequestStatus;
    description: string;
    category: string | null;
    tipsAmount: number;
    estimatedWaitTimeMinutes: number | null;
    expertFound: {
      expertUserId: string;
      expertName: string;
      expertTitle: string[];
      expertAvatar: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      const request = await this.expertRequestRepo.findById(requestId);
      if (!request) {
        throw new Error('Expert request not found');
      }

      // Estimated wait time hesapla (basit bir yaklaşım)
      const estimatedWaitTimeMinutes = request.isBroadcasting() ? 3 : null; // Şimdilik 3 dakika

      // Expert found bilgilerini getir
      let expertFound: {
        expertUserId: string;
        expertName: string;
        expertTitle: string[];
        expertAvatar: string | null;
      } | null = null;
      if (request.isExpertFound() || request.isAnswered()) {
        const answers = await this.expertAnswerRepo.findByRequestId(requestId);
        if (answers.length > 0) {
          const firstExpertId = answers[0].expertUserId;
          const expertProfile = await this.profileRepo.findByUserId(firstExpertId);
          const expertTitles = await this.titleRepo.findByUserId(firstExpertId);
          const expertAvatar = await this.avatarRepo.findActiveByUserId(firstExpertId);

          expertFound = {
            expertUserId: firstExpertId,
            expertName: expertProfile?.displayName || 'Expert',
            expertTitle: expertTitles.map((t) => t.title),
            expertAvatar: expertAvatar?.imageUrl || null,
          };
        }
      }

      return {
        id: request.id,
        status: request.status,
        description: request.description,
        category: request.category,
        tipsAmount: request.tipsAmount,
        estimatedWaitTimeMinutes,
        expertFound,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    } catch (error) {
      logger.error({
        message: 'Error getting expert request status',
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private mapToResponse(request: any): ExpertRequestResponse {
    return {
      id: request.id,
      userId: request.userId,
      description: request.description,
      category: request.category || null,
      tipsAmount: request.tipsAmount,
      status: request.status,
      answeredAt: request.answeredAt ? request.answeredAt.toISOString() : null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}

