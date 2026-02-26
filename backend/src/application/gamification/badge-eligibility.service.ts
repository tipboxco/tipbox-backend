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
      const event = await this.prisma.event.findUnique({
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
   * DEPRECATED: Event badges are now distributed by upvote ranking after event ends
   * See EventBadgeDistributorService.distributeEventBadges()
   *
   * This method is kept for backward compatibility but returns empty array.
   */
  async getEventBadgeRequirements(eventId: string): Promise<EventBadgeRequirement[]> {
    logger.info(
      `getEventBadgeRequirements called for event ${eventId} - ` +
      `Event badges are now distributed by upvote ranking. ` +
      `Use EventBadgeDistributorService.distributeEventBadges() instead.`
    );
    return [];
  }

  /**
   * DEPRECATED: Event badges are now distributed by upvote ranking after event ends
   * See EventBadgeDistributorService.distributeEventBadges()
   *
   * This method is kept for backward compatibility but does nothing.
   * Event badges are no longer granted based on individual actions during the event.
   * Instead, they are awarded to top users (by upvote count) after the event ends.
   */
  async checkAndGrantEventBadges(
    userId: string,
    eventId: string,
    currentMetrics: EventMetrics
  ): Promise<void> {
    logger.debug(
      `checkAndGrantEventBadges called for user ${userId} in event ${eventId} - ` +
      `Event badges are now distributed by upvote ranking after event ends. ` +
      `Use EventBadgeDistributorService.distributeEventBadges() instead.`
    );
    // No-op: Event badges are now handled by EventBadgeDistributorService
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
