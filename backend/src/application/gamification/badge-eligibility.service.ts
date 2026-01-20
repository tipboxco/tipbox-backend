import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { EventMetrics } from '../../domain/event/event-metrics.entity';
import { EventBadgeRequirement } from '../../domain/event/event-badge-requirement.entity';
import { EventBadgeRequirementType } from '../../domain/event/event-badge-requirement-type.enum';
import { GamificationService } from '../gamification/gamification.service';
import logger from '../../infrastructure/logger/logger';

export class BadgeEligibilityService {
  private prisma: ReturnType<typeof getPrisma>;
  private gamificationService: GamificationService;

  constructor() {
    this.prisma = getPrisma();
    this.gamificationService = new GamificationService();
  }

  /**
   * Event'in aktif olup olmadığını kontrol et
   */
  async isEventActive(eventId: string): Promise<boolean> {
    try {
      const event = await this.prisma.wishboxEvent.findUnique({
        where: { id: eventId },
        select: {
          status: true,
          endDate: true,
        },
      });

      if (!event) {
        return false;
      }

      const now = new Date();
      return event.status === 'PUBLISHED' && event.endDate > now;
    } catch (error) {
      logger.error(`Failed to check if event ${eventId} is active:`, error);
      return false;
    }
  }

  /**
   * Event için tanımlı badge requirement'ları getir
   * ✅ GÜNCELLEND İ: EventBadge tablosundan getirir
   */
  async getEventBadgeRequirements(eventId: string): Promise<EventBadgeRequirement[]> {
    try {
      // EventBadge tablosundan event'e özgü badge'leri getir
      const eventBadges = await this.prisma.eventBadge.findMany({
        where: {
          eventId,
          enabled: true,
        },
        select: {
          badgeId: true,
          requirementType: true,
          threshold: true,
        },
      });

      const requirements: EventBadgeRequirement[] = eventBadges.map((eb) => ({
        badgeId: eb.badgeId,
        type: eb.requirementType as EventBadgeRequirementType,
        threshold: eb.threshold,
      }));

      return requirements;
    } catch (error) {
      logger.error(`Failed to get badge requirements for event ${eventId}:`, error);
      return [];
    }
  }

  /**
   * Kullanıcının event badge'lerini kontrol et ve hak ettiği badge'leri ver
   * ✅ ÖNEMLİ: Kullanıcının event'e join olması gerekir (ödül/rozet almak için)
   */
  async checkAndGrantEventBadges(
    userId: string,
    eventId: string,
    currentMetrics: EventMetrics
  ): Promise<void> {
    try {
      // Event aktif mi kontrol et
      const isActive = await this.isEventActive(eventId);
      if (!isActive) {
        logger.info(`Event ${eventId} is not active, skipping badge check for user ${userId}`);
        return;
      }

      // ✅ YENİ: Kullanıcının event'e join olup olmadığını kontrol et
      const userStats = await this.prisma.wishboxStats.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (!userStats) {
        logger.info(
          `User ${userId} has not joined event ${eventId}, skipping badge check. ` +
          `User must join the event before receiving badges/rewards.`
        );
        return;
      }

      // Event için tanımlı badge requirement'ları getir
      const requirements = await this.getEventBadgeRequirements(eventId);
      if (requirements.length === 0) {
        logger.info(`No badge requirements found for event ${eventId}`);
        return;
      }

      // Her requirement için kontrol et
      for (const requirement of requirements) {
        try {
          // Kullanıcıda zaten bu badge var mı kontrol et
          const existingBadge = await this.prisma.userBadge.findUnique({
            where: {
              userId_badgeId: {
                userId,
                badgeId: requirement.badgeId,
              },
            },
          });

          if (existingBadge) {
            // Zaten var, atla
            continue;
          }

          // Threshold'a ulaşıldı mı kontrol et
          let hasReachedThreshold = false;

          switch (requirement.type) {
            case EventBadgeRequirementType.POSTS_COUNT:
              hasReachedThreshold = currentMetrics.postsCount >= requirement.threshold;
              break;
            case EventBadgeRequirementType.LIKES_RECEIVED:
              hasReachedThreshold = currentMetrics.likesReceivedCount >= requirement.threshold;
              break;
            case EventBadgeRequirementType.TOTAL_SCORE:
              // TODO: Total score hesaplama
              hasReachedThreshold = false;
              break;
          }

          // Threshold'a ulaşıldıysa ve badge yok ise badge ver
          if (hasReachedThreshold) {
            await this.gamificationService.grantBadgeToUser(userId, requirement.badgeId);
            logger.info(
              `Badge ${requirement.badgeId} granted to user ${userId} for event ${eventId} ` +
              `(${requirement.type}: ${requirement.threshold})`
            );
          }
        } catch (error) {
          logger.error(
            `Failed to check/grant badge ${requirement.badgeId} for user ${userId}:`,
            error
          );
          // Bir badge başarısız olsa da diğerlerini kontrol et
          continue;
        }
      }
    } catch (error) {
      logger.error(`Failed to check and grant badges for user ${userId} in event ${eventId}:`, error);
      // Badge kontrolü başarısız olsa da ana işlem devam etsin
    }
  }

  /**
   * Kullanıcının survey'e cevap verip vermediğini kontrol et
   * ✅ ÖNEMLİ: Survey reward/badge almak için kullanıcının survey'e cevap vermiş olması gerekir
   * @param userId - Kullanıcı ID'si
   * @param surveyId - Survey ID'si
   * @returns Kullanıcı survey'e cevap vermişse true, aksi halde false
   */
  async hasUserAnsweredSurvey(userId: string, surveyId: string): Promise<boolean> {
    try {
      // Survey'in sorularını getir
      const survey = await this.prisma.brandSurvey.findUnique({
        where: { id: surveyId },
        include: {
          questions: true,
        },
      });

      if (!survey || survey.questions.length === 0) {
        return false;
      }

      // Kullanıcının survey'in tüm sorularına cevap verip vermediğini kontrol et
      const questionIds = survey.questions.map((q) => q.id);
      const userAnswers = await this.prisma.brandSurveyAnswer.findMany({
        where: {
          userId,
          questionId: { in: questionIds },
        },
      });

      // Tüm sorulara cevap verilmişse true döndür
      return userAnswers.length === questionIds.length;
    } catch (error) {
      logger.error(`Failed to check if user ${userId} answered survey ${surveyId}:`, error);
      return false;
    }
  }
}
