import { UserReportCategory } from '../../domain/user/user-report-category.enum';
import { getPrisma } from './prisma.client';
import logger from '../logger/logger';
import { Prisma } from '@prisma/client';

export class UserReportPrismaRepository {
  private prisma = getPrisma();

  /**
   * Belirli bir kullanıcı için belirli bir raporlayıcının daha önce rapor oluşturup oluşturmadığını kontrol et
   */
  async findByReporterIdAndReportedUserId(
    reporterId: string,
    reportedUserId: string
  ): Promise<Prisma.UserReportGetPayload<{}> | null> {
    try {
      const report = await this.prisma.userReport.findFirst({
        where: {
          reporterId,
          reportedUserId,
        },
      });
      return report;
    } catch (error) {
      logger.error('Error finding user report:', {
        error: error instanceof Error ? error.message : String(error),
        reporterId,
        reportedUserId,
      });
      return null;
    }
  }

  async create(data: {
    reportedUserId: string;
    reporterId: string;
    category: UserReportCategory;
    description?: string | null;
  }): Promise<Prisma.UserReportGetPayload<{}>> {
    try {
      const report = await this.prisma.userReport.create({
        data: {
          reportedUserId: data.reportedUserId,
          reporterId: data.reporterId,
          category: data.category,
          description: data.description ?? null,
        },
      });
      return report;
    } catch (error) {
      logger.error('Error creating user report:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        reportedUserId: data.reportedUserId,
        reporterId: data.reporterId,
      });
      throw error;
    }
  }
}

