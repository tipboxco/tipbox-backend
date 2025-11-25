import { PostTip } from '../../domain/content/post-tip.entity';
import { getPrisma } from './prisma.client';
import { TipCategory } from '../../domain/content/tip-category.enum';

export class PostTipPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<PostTip | null> {
    const tip = await this.prisma.postTip.findUnique({ 
      where: { id },
      include: {
        post: true
      }
    });
    return tip ? this.toDomain(tip) : null;
  }

  async findByPostId(postId: string): Promise<PostTip | null> {
    const tip = await this.prisma.postTip.findUnique({
      where: { postId },
      include: {
        post: true
      }
    });
    return tip ? this.toDomain(tip) : null;
  }

  async findByCategory(category: TipCategory): Promise<PostTip[]> {
    const tips = await this.prisma.postTip.findMany({
      where: { tipCategory: category },
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return tips.map(tip => this.toDomain(tip));
  }

  async findVerified(): Promise<PostTip[]> {
    const tips = await this.prisma.postTip.findMany({
      where: { isVerified: true },
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return tips.map(tip => this.toDomain(tip));
  }

  async findUnverified(): Promise<PostTip[]> {
    const tips = await this.prisma.postTip.findMany({
      where: { isVerified: false },
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return tips.map(tip => this.toDomain(tip));
  }

  async create(
    postId: string,
    tipCategory: TipCategory,
    isVerified: boolean = false
  ): Promise<PostTip> {
    const tip = await this.prisma.postTip.create({
      data: {
        postId,
        tipCategory,
        isVerified
      },
      include: {
        post: true
      }
    });
    return this.toDomain(tip);
  }

  async update(id: string, data: { 
    tipCategory?: TipCategory;
    isVerified?: boolean;
  }): Promise<PostTip | null> {
    const tip = await this.prisma.postTip.update({
      where: { id },
      data,
      include: {
        post: true
      }
    });
    return tip ? this.toDomain(tip) : null;
  }

  async toggleVerification(id: string): Promise<PostTip | null> {
    const tip = await this.prisma.postTip.findUnique({ where: { id } });
    if (!tip) return null;

    const updated = await this.prisma.postTip.update({
      where: { id },
      data: { isVerified: !tip.isVerified },
      include: {
        post: true
      }
    });
    return updated ? this.toDomain(updated) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.postTip.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByPostId(postId: string): Promise<boolean> {
    try {
      await this.prisma.postTip.delete({ where: { postId } });
      return true;
    } catch {
      return false;
    }
  }

  async countByCategory(category: TipCategory): Promise<number> {
    return await this.prisma.postTip.count({
      where: { tipCategory: category }
    });
  }

  async countVerified(): Promise<number> {
    return await this.prisma.postTip.count({
      where: { isVerified: true }
    });
  }

  async list(): Promise<PostTip[]> {
    const tips = await this.prisma.postTip.findMany({
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return tips.map(tip => this.toDomain(tip));
  }

  private toDomain(prismaTip: any): PostTip {
    return new PostTip(
      prismaTip.id,
      prismaTip.postId,
      prismaTip.tipCategory as TipCategory,
      prismaTip.isVerified,
      prismaTip.createdAt,
      prismaTip.updatedAt
    );
  }
}