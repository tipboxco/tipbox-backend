import { PrismaClient } from '@prisma/client';
import { UserTitle } from '../../domain/user/user-title.entity';

export class UserTitlePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<UserTitle | null> {
    const title = await this.prisma.userTitle.findUnique({ where: { id } });
    return title ? this.toDomain(title) : null;
  }

  async findByUserId(userId: number): Promise<UserTitle[]> {
    const titles = await this.prisma.userTitle.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' }
    });
    return titles.map(title => this.toDomain(title));
  }

  async findByTitle(title: string): Promise<UserTitle[]> {
    const titles = await this.prisma.userTitle.findMany({
      where: { title },
      orderBy: { earnedAt: 'desc' }
    });
    return titles.map(userTitle => this.toDomain(userTitle));
  }

  async create(userId: number, title: string): Promise<UserTitle> {
    const userTitle = await this.prisma.userTitle.create({
      data: {
        userId,
        title
      }
    });
    return this.toDomain(userTitle);
  }

  async update(id: number, data: { title?: string }): Promise<UserTitle | null> {
    const updatedTitle = await this.prisma.userTitle.update({
      where: { id },
      data
    });
    return updatedTitle ? this.toDomain(updatedTitle) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.userTitle.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserTitle[]> {
    const titles = await this.prisma.userTitle.findMany();
    return titles.map(title => this.toDomain(title));
  }

  private toDomain(prismaTitle: any): UserTitle {
    return new UserTitle(
      prismaTitle.id,
      prismaTitle.userId,
      prismaTitle.title,
      prismaTitle.earnedAt,
      prismaTitle.createdAt,
      prismaTitle.updatedAt
    );
  }
}