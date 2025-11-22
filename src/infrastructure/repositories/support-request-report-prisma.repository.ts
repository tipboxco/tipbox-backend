import { PrismaClient } from '@prisma/client';
import { SupportRequestReportCategory } from '../../domain/messaging/support-request-report-category.enum';
import { randomUUID } from 'crypto';
import logger from '../logger/logger';

export class SupportRequestReportPrismaRepository {
  private prisma = new PrismaClient();

  /**
   * Belirli bir request için belirli bir kullanıcının daha önce rapor oluşturup oluşturmadığını kontrol et
   */
  async findByRequestIdAndReporterId(requestId: string, reporterId: string) {
    try {
      return await (this.prisma as any).supportRequestReport.findFirst({
        where: {
          requestId,
          reporterId,
        },
      });
    } catch (error: any) {
      logger.error('Error finding support request report:', {
        error: error.message,
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
  }) {
    try {
      return await (this.prisma as any).supportRequestReport.create({
        data: {
          id: randomUUID(),
          requestId: data.requestId,
          reporterId: data.reporterId,
          category: data.category,
          description: data.description ?? null,
        },
      });
    } catch (error: any) {
      logger.error('Error creating support request report:', {
        error: error.message,
        stack: error.stack,
        requestId: data.requestId,
        reporterId: data.reporterId,
      });
      throw error;
    }
  }
}

