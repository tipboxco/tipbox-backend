import { PrismaClient } from '@prisma/client';
import { UserKycRecord } from '../../domain/user/user-kyc-record.entity';
import { KycReviewStatus, KycReviewResult, KycProvider } from '../../domain/user/kyc-enums';

export class UserKycRecordPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<UserKycRecord | null> {
    const record = await this.prisma.userKycRecord.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByUserId(userId: string): Promise<UserKycRecord[]> {
    const records = await this.prisma.userKycRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return records.map(record => this.toDomain(record));
  }

  async findLatestByUserId(userId: string): Promise<UserKycRecord | null> {
    const record = await this.prisma.userKycRecord.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return record ? this.toDomain(record) : null;
  }

  async findByStatus(reviewStatus: KycReviewStatus): Promise<UserKycRecord[]> {
    const records = await this.prisma.userKycRecord.findMany({
      where: { reviewStatus },
      orderBy: { createdAt: 'desc' }
    });
    return records.map(record => this.toDomain(record));
  }

  async create(
    userId: string, 
    sumsubApplicantId: string,
    reviewStatus?: KycReviewStatus,
    reviewResult?: KycReviewResult,
    reviewReason?: string,
    kycLevel?: string,
    provider?: KycProvider
  ): Promise<UserKycRecord> {
    const record = await this.prisma.userKycRecord.create({
      data: {
        userId,
        sumsubApplicantId,
        reviewStatus: reviewStatus || KycReviewStatus.INIT,
        reviewResult: reviewResult || KycReviewResult.NULL,
        reviewReason,
        kycLevel,
        provider: provider || KycProvider.SUMSUB
      }
    });
    return this.toDomain(record);
  }

  async update(id: string, data: { 
    reviewStatus?: KycReviewStatus; 
    reviewResult?: KycReviewResult; 
    reviewReason?: string; 
    kycLevel?: string;
  }): Promise<UserKycRecord | null> {
    const record = await this.prisma.userKycRecord.update({
      where: { id },
      data
    });
    return record ? this.toDomain(record) : null;
  }

  async updateStatus(id: string, reviewStatus: KycReviewStatus, reviewReason?: string): Promise<UserKycRecord | null> {
    const record = await this.prisma.userKycRecord.update({
      where: { id },
      data: { 
        reviewStatus,
        reviewReason
      }
    });
    return record ? this.toDomain(record) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userKycRecord.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserKycRecord[]> {
    const records = await this.prisma.userKycRecord.findMany();
    return records.map(record => this.toDomain(record));
  }

  private toDomain(prismaRecord: any): UserKycRecord {
    return new UserKycRecord(
      prismaRecord.id,
      prismaRecord.userId,
      prismaRecord.sumsubApplicantId,
      prismaRecord.reviewStatus as KycReviewStatus,
      prismaRecord.reviewResult as KycReviewResult,
      prismaRecord.reviewReason,
      prismaRecord.kycLevel,
      prismaRecord.provider as KycProvider,
      prismaRecord.createdAt,
      prismaRecord.updatedAt,
      prismaRecord.lastUpdatedAt,
      prismaRecord.lastSyncedAt
    );
  }
}