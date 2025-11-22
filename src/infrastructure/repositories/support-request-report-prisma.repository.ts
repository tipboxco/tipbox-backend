import { PrismaClient, Prisma } from '@prisma/client';
import { SupportRequestReportCategory } from '../../domain/messaging/support-request-report-category.enum';
import logger from '../logger/logger';

export class SupportRequestReportPrismaRepository {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  /**
   * Belirli bir request için belirli bir kullanıcının daha önce rapor oluşturup oluşturmadığını kontrol et
   */
  async findByRequestIdAndReporterId(
    requestId: string,
    reporterId: string
  ): Promise<Prisma.SupportRequestReportGetPayload<{}> | null> {
    try {
      const report = await this.prisma.supportRequestReport.findFirst({
        where: {
          requestId,
          reporterId,
        },
      });
      return report;
    } catch (error) {
      logger.error('Error finding support request report:', {
        error: error instanceof Error ? error.message : String(error),
        requestId,
        reporterId,
      });
      return null;
    }
  }

  async create(data: {
    requestId: string;
    reporterId: string;
    category: SupportRequestReportCategory;
    description?: string | null;
  }): Promise<Prisma.SupportRequestReportGetPayload<{}>> {
    try {
      // Prisma schema'da @default(uuid()) var, id'yi manuel oluşturmaya gerek yok
      const report = await this.prisma.supportRequestReport.create({
        data: {
          requestId: data.requestId,
          reporterId: data.reporterId,
          category: data.category,
          description: data.description ?? null,
        },
      });
      return report;
    } catch (error) {
      logger.error('Error creating support request report:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestId: data.requestId,
        reporterId: data.reporterId,
      });
      throw error;
    }
  }
}

