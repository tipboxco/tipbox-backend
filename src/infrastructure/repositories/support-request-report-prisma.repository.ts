import { SupportRequestReportCategory } from '../../domain/messaging/support-request-report-category.enum';
import { getPrisma } from './prisma.client';
import { randomUUID } from 'crypto';
import logger from '../logger/logger';

export class SupportRequestReportPrismaRepository {
  private prisma = getPrisma();

  /**
   * Belirli bir request için belirli bir kullanıcının daha önce rapor oluşturup oluşturmadığını kontrol et
   */
  async findByRequestIdAndReporterId(requestId: string, reporterId: string) {
    try {
      if (!this.prisma.supportRequestReport) {
        return null;
      }

      return await this.prisma.supportRequestReport.findFirst({
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
      // Prisma client'ın supportRequestReport modelini tanıdığından emin ol
      if (!this.prisma.supportRequestReport) {
        logger.error('Prisma client does not have supportRequestReport model. Available models:', Object.keys(this.prisma).filter(key => !key.startsWith('_')));
        throw new Error('Prisma client does not have supportRequestReport model. Please run: npx prisma generate');
      }

      return await this.prisma.supportRequestReport.create({
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

