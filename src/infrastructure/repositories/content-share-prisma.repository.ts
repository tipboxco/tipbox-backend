import { ContentShare } from '../../domain/interaction/content-share.entity';
import { ShareType } from '../../domain/interaction/share-type.enum';
import { getPrisma } from './prisma.client';

export class ContentSharePrismaRepository {
  private prisma = getPrisma();

  async create(data: {
    userId: string;
    postId: string;
    shareType: ShareType;
    platform?: string;
  }): Promise<ContentShare> {
    const share = await (this.prisma as any).contentShare.create({
      data: {
        userId: data.userId,
        postId: data.postId,
        shareType: data.shareType,
        platform: data.platform || null,
      },
    });
    return this.toDomain(share);
  }

  async findByUserAndPost(userId: string, postId: string): Promise<ContentShare | null> {
    const share = await (this.prisma as any).contentShare.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    return share ? this.toDomain(share) : null;
  }

  async countByPostId(postId: string): Promise<number> {
    return (this.prisma as any).contentShare.count({ where: { postId } });
  }

  private toDomain(prismaShare: any): ContentShare {
    return new ContentShare(
      prismaShare.id,
      prismaShare.userId,
      prismaShare.postId,
      prismaShare.shareType as ShareType,
      prismaShare.platform,
      prismaShare.createdAt
    );
  }
}

