import { PrismaClient } from '@prisma/client';
import { ExpertRequestMedia } from '../../domain/expert/expert-request-media.entity';

export class ExpertRequestMediaPrismaRepository {
  private prisma = new PrismaClient();

  async findByRequestId(requestId: string): Promise<ExpertRequestMedia[]> {
    const media = await this.prisma.expertRequestMedia.findMany({
      where: { requestId },
      orderBy: { uploadedAt: 'desc' },
    });
    return media.map((m: any) => this.toDomain(m));
  }

  async create(
    requestId: string,
    mediaUrl: string,
    mediaType: string
  ): Promise<ExpertRequestMedia> {
    const media = await this.prisma.expertRequestMedia.create({
      data: {
        requestId,
        mediaUrl,
        mediaType,
      },
    });
    return this.toDomain(media);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.expertRequestMedia.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByRequestId(requestId: string): Promise<boolean> {
    try {
      await this.prisma.expertRequestMedia.deleteMany({
        where: { requestId },
      });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(prismaMedia: any): ExpertRequestMedia {
    return new ExpertRequestMedia(
      prismaMedia.id,
      prismaMedia.requestId,
      prismaMedia.mediaUrl,
      prismaMedia.mediaType,
      prismaMedia.uploadedAt,
      prismaMedia.createdAt,
      prismaMedia.updatedAt
    );
  }
}

