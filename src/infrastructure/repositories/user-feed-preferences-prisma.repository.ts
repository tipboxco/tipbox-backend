import { PrismaClient } from '@prisma/client';
import { UserFeedPreferences } from '../../domain/user/user-feed-preferences.entity';

export class UserFeedPreferencesPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<UserFeedPreferences | null> {
    const preferences = await this.prisma.userFeedPreferences.findUnique({ where: { id } });
    return preferences ? this.toDomain(preferences) : null;
  }

  async findByUserId(userId: number): Promise<UserFeedPreferences | null> {
    const preferences = await this.prisma.userFeedPreferences.findUnique({ where: { userId } });
    return preferences ? this.toDomain(preferences) : null;
  }

  async create(userId: number, preferredCategories?: string, preferredContentTypes?: string, language?: string): Promise<UserFeedPreferences> {
    const preferences = await this.prisma.userFeedPreferences.create({
      data: {
        userId,
        preferredCategories,
        preferredContentTypes,
        language
      }
    });
    return this.toDomain(preferences);
  }

  async update(id: number, data: { preferredCategories?: string; preferredContentTypes?: string; language?: string }): Promise<UserFeedPreferences | null> {
    const preferences = await this.prisma.userFeedPreferences.update({
      where: { id },
      data
    });
    return preferences ? this.toDomain(preferences) : null;
  }

  async updateByUserId(userId: number, data: { preferredCategories?: string; preferredContentTypes?: string; language?: string }): Promise<UserFeedPreferences | null> {
    const preferences = await this.prisma.userFeedPreferences.update({
      where: { userId },
      data
    });
    return preferences ? this.toDomain(preferences) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.userFeedPreferences.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserFeedPreferences[]> {
    const preferences = await this.prisma.userFeedPreferences.findMany();
    return preferences.map(pref => this.toDomain(pref));
  }

  private toDomain(prismaPreferences: any): UserFeedPreferences {
    return new UserFeedPreferences(
      prismaPreferences.id,
      prismaPreferences.userId,
      prismaPreferences.preferredCategories,
      prismaPreferences.preferredContentTypes,
      prismaPreferences.language,
      prismaPreferences.createdAt,
      prismaPreferences.updatedAt
    );
  }
}