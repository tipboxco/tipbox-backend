import { PrismaClient } from '@prisma/client';
import logger from '../../infrastructure/logger/logger';

export class ExpertMatchingService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Kategoriye göre potansiyel expert kullanıcıları bul
   */
  async findPotentialExperts(
    category: string | null,
    excludeUserId: string
  ): Promise<string[]> {
    try {
      const expertUserIds = new Set<string>();

      // 1. Kategori bazlı eşleşme (şimdilik basit bir yaklaşım)
      // TODO: İleride UserExpertInterest veya benzeri bir model eklenebilir
      if (category) {
        // Kategoriye göre ilgili badge'lere sahip kullanıcıları bul
        const categoryBadges = await this.findCategoryBadges(category);
        if (categoryBadges.length > 0) {
          const usersWithCategoryBadges = await this.prisma.userBadge.findMany({
            where: {
              badgeId: { in: categoryBadges },
              claimed: true,
            },
            select: { userId: true },
            distinct: ['userId'],
          });
          usersWithCategoryBadges.forEach((ub: any) => {
            if (ub.userId !== excludeUserId) {
              expertUserIds.add(ub.userId);
            }
          });
        }
      }

      // 2. Expert badge'ine sahip kullanıcıları bul
      const expertBadges = await this.prisma.badge.findMany({
        where: {
          OR: [
            { name: { contains: 'Expert', mode: 'insensitive' } },
            { name: { contains: 'Uzman', mode: 'insensitive' } },
            { name: { contains: 'Specialist', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      if (expertBadges.length > 0) {
        const expertBadgeIds = expertBadges.map((b: any) => b.id);
        const usersWithExpertBadges = await this.prisma.userBadge.findMany({
          where: {
            badgeId: { in: expertBadgeIds },
            claimed: true,
          },
          select: { userId: true },
          distinct: ['userId'],
        });
        usersWithExpertBadges.forEach((ub: any) => {
          if (ub.userId !== excludeUserId) {
            expertUserIds.add(ub.userId);
          }
        });
      }

      // 3. Expert rolüne sahip kullanıcıları bul
      const expertRoleUsers = await this.prisma.userRole.findMany({
        where: {
          role: { in: ['EXPERT', 'ADMIN', 'MODERATOR'] },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      expertRoleUsers.forEach((ur: any) => {
        if (ur.userId !== excludeUserId) {
          expertUserIds.add(ur.userId);
        }
      });

      // 4. Daha önce expert answer vermiş aktif kullanıcıları bul
      const activeExperts = await this.prisma.expertAnswer.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Son 30 gün
          },
        },
        select: { expertUserId: true },
        distinct: ['expertUserId'],
        take: 50, // En aktif 50 expert
      });
      activeExperts.forEach((ea: any) => {
        if (ea.expertUserId !== excludeUserId) {
          expertUserIds.add(ea.expertUserId);
        }
      });

      const expertIds = Array.from(expertUserIds);
      logger.info({
        message: 'Potential experts found',
        category,
        excludeUserId,
        count: expertIds.length,
      });

      return expertIds;
    } catch (error) {
      logger.error({
        message: 'Error finding potential experts',
        category,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Kategoriye göre ilgili badge'leri bul
   */
  private async findCategoryBadges(category: string): Promise<string[]> {
    try {
      // Kategori adına göre badge'leri bul
      const badges = await this.prisma.badge.findMany({
        where: {
          OR: [
            { name: { contains: category, mode: 'insensitive' } },
            { description: { contains: category, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      return badges.map((b: any) => b.id);
    } catch (error) {
      logger.error({
        message: 'Error finding category badges',
        category,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

