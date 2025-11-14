import { PrismaClient } from '@prisma/client';
import { UserTheme } from '../../domain/user/user-theme.entity';

export class UserThemePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<UserTheme | null> {
    const theme = await this.prisma.userTheme.findUnique({ where: { id } });
    return theme ? this.toDomain(theme) : null;
  }

  async findByName(name: string): Promise<UserTheme | null> {
    const theme = await this.prisma.userTheme.findFirst({ where: { name } });
    return theme ? this.toDomain(theme) : null;
  }

  async findByDescription(description: string): Promise<UserTheme | null> {
    const theme = await this.prisma.userTheme.findFirst({
      where: { description }
    });
    return theme ? this.toDomain(theme) : null;
  }

  async create(name: string, description?: string): Promise<UserTheme> {
    const theme = await this.prisma.userTheme.create({
      data: {
        name,
        description
      }
    });
    return this.toDomain(theme);
  }

  async update(id: string, data: { name?: string; description?: string }): Promise<UserTheme | null> {
    const theme = await this.prisma.userTheme.update({
      where: { id },
      data
    });
    return theme ? this.toDomain(theme) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userTheme.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserTheme[]> {
    const themes = await this.prisma.userTheme.findMany({
      orderBy: { name: 'asc' }
    });
    return themes.map(theme => this.toDomain(theme));
  }

  async listWithUsageCount(): Promise<UserTheme[]> {
    const themes = await this.prisma.userTheme.findMany({
      include: {
        _count: {
          select: { userSettings: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    return themes.map(theme => this.toDomain(theme));
  }

  private toDomain(prismaTheme: any): UserTheme {
    return new UserTheme(
      prismaTheme.id,
      prismaTheme.name,
      prismaTheme.description,
      prismaTheme.createdAt,
      prismaTheme.updatedAt
    );
  }
}