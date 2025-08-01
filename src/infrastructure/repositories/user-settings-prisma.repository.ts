import { PrismaClient } from '@prisma/client';
import { UserSettings } from '../../domain/user/user-settings.entity';
import { UserVisibility } from '../../domain/user/user-visibility.enum';

export class UserSettingsPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.findUnique({ where: { id } });
    return settings ? this.toDomain(settings) : null;
  }

  async findByUserId(userId: number): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    return settings ? this.toDomain(settings) : null;
  }

  async create(userId: number, themeId?: number, receiveNotifications?: boolean, visibility?: UserVisibility): Promise<UserSettings> {
    const settings = await this.prisma.userSettings.create({
      data: {
        userId,
        themeId,
        receiveNotifications,
        visibility
      }
    });
    return this.toDomain(settings);
  }

  async update(id: number, data: { themeId?: number; receiveNotifications?: boolean; visibility?: UserVisibility }): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.update({
      where: { id },
      data
    });
    return settings ? this.toDomain(settings) : null;
  }

  async updateByUserId(userId: number, data: { themeId?: number; receiveNotifications?: boolean; visibility?: UserVisibility }): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.update({
      where: { userId },
      data
    });
    return settings ? this.toDomain(settings) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.userSettings.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserSettings[]> {
    const settings = await this.prisma.userSettings.findMany();
    return settings.map(setting => this.toDomain(setting));
  }

  private toDomain(prismaSettings: any): UserSettings {
    return new UserSettings(
      prismaSettings.id,
      prismaSettings.userId,
      prismaSettings.themeId,
      prismaSettings.receiveNotifications,
      prismaSettings.visibility as UserVisibility,
      prismaSettings.createdAt,
      prismaSettings.updatedAt
    );
  }
}