import { PrismaClient } from '@prisma/client';
import { UserSettings } from '../../domain/user/user-settings.entity';
import { UserVisibility } from '../../domain/user/user-visibility.enum';

export class UserSettingsPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.findUnique({ where: { id } });
    return settings ? this.toDomain(settings) : null;
  }

  async findByUserId(userId: string): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    return settings ? this.toDomain(settings) : null;
  }

  async create(
    userId: string,
    themeId?: string,
    receiveNotifications?: boolean,
    visibility?: UserVisibility
  ): Promise<UserSettings> {
    const settings = await this.prisma.userSettings.create({
      data: {
        userId,
        themeId,
        receiveNotifications,
        visibility,
      },
    });
    return this.toDomain(settings);
  }

  async update(
    id: string,
    data: {
      themeId?: string;
      receiveNotifications?: boolean;
      visibility?: UserVisibility;
      notificationEmailEnabled?: boolean;
      notificationPushEnabled?: boolean;
      notificationInAppEnabled?: boolean;
      supportSessionPrice?: number | null;
      supportSessionPriceUpdatedAt?: Date | null;
    }
  ): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.update({
      where: { id },
      data,
    });
    return settings ? this.toDomain(settings) : null;
  }

  async updateByUserId(
    userId: string,
    data: {
      themeId?: string;
      receiveNotifications?: boolean;
      visibility?: UserVisibility;
      notificationEmailEnabled?: boolean;
      notificationPushEnabled?: boolean;
      notificationInAppEnabled?: boolean;
      supportSessionPrice?: number | null;
      supportSessionPriceUpdatedAt?: Date | null;
    }
  ): Promise<UserSettings | null> {
    const settings = await this.prisma.userSettings.update({
      where: { userId },
      data,
    });
    return settings ? this.toDomain(settings) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userSettings.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserSettings[]> {
    const settings = await this.prisma.userSettings.findMany();
    return settings.map((setting) => this.toDomain(setting));
  }

  private toDomain(prismaSettings: any): UserSettings {
    return new UserSettings(
      prismaSettings.id,
      prismaSettings.userId,
      prismaSettings.themeId,
      prismaSettings.receiveNotifications,
      prismaSettings.visibility as UserVisibility,
      prismaSettings.notificationEmailEnabled ?? true,
      prismaSettings.notificationPushEnabled ?? true,
      prismaSettings.notificationInAppEnabled ?? true,
      prismaSettings.supportSessionPrice,
      prismaSettings.supportSessionPriceUpdatedAt,
      prismaSettings.createdAt,
      prismaSettings.updatedAt
    );
  }
}