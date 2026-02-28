import type { ContentFavorite as PrismaContentFavoriteModel } from '@prisma/client';
import { ContentFavorite } from '../../domain/interaction/content-favorite.entity';
import { getPrisma } from './prisma.client';

export class ContentFavoritePrismaRepository {
  private prisma = getPrisma();

  async create(data: {
    userId: string;
    postId: string;
  }): Promise<ContentFavorite> {
    const favorite = await this.prisma.contentFavorite.create({
      data: {
        userId: data.userId,
        postId: data.postId,
      },
    });
    return this.toDomain(favorite);
  }

  async findByUserAndPost(userId: string, postId: string): Promise<ContentFavorite | null> {
    const favorite = await this.prisma.contentFavorite.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    return favorite ? this.toDomain(favorite) : null;
  }

  async delete(userId: string, postId: string): Promise<boolean> {
    try {
      await this.prisma.contentFavorite.delete({
        where: {
          userId_postId: { userId, postId },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByPostId(postId: string): Promise<number> {
    return this.prisma.contentFavorite.count({ where: { postId } });
  }

  async findByUserId(userId: string, limit = 50): Promise<ContentFavorite[]> {
    const favorites = await this.prisma.contentFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return favorites.map(f => this.toDomain(f));
  }

  private toDomain(prismaFavorite: PrismaContentFavoriteModel): ContentFavorite {
    return new ContentFavorite(
      prismaFavorite.id,
      prismaFavorite.userId,
      prismaFavorite.postId,
      prismaFavorite.createdAt,
      prismaFavorite.updatedAt
    );
  }
}

