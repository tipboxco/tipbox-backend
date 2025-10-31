import { PrismaClient } from '@prisma/client';
import { UserPrivacySetting } from '../../domain/user/user-privacy-setting.entity';
import { PrivacyCode } from '../../domain/user/privacy-code.enum';

export class UserPrivacySettingPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<UserPrivacySetting | null> {
    const setting = await this.prisma.userPrivacySetting.findUnique({ where: { id } });
    return setting ? this.toDomain(setting) : null;
  }

  async findByUserId(userId: string): Promise<UserPrivacySetting[]> {
    const settings = await this.prisma.userPrivacySetting.findMany({
      where: { userId },
      orderBy: { privacyCode: 'asc' },
    });
    return settings.map((setting) => this.toDomain(setting));
  }

  async findByUserIdAndPrivacyCode(
    userId: string,
    privacyCode: PrivacyCode
  ): Promise<UserPrivacySetting | null> {
    const setting = await this.prisma.userPrivacySetting.findUnique({
      where: {
        userId_privacyCode: {
          userId,
          privacyCode,
        },
      },
    });
    return setting ? this.toDomain(setting) : null;
  }

  async create(
    userId: string,
    privacyCode: PrivacyCode,
    selectedValue: string
  ): Promise<UserPrivacySetting> {
    const setting = await this.prisma.userPrivacySetting.create({
      data: {
        userId,
        privacyCode,
        selectedValue,
      },
    });
    return this.toDomain(setting);
  }

  async update(
    id: string,
    data: { selectedValue: string }
  ): Promise<UserPrivacySetting | null> {
    const setting = await this.prisma.userPrivacySetting.update({
      where: { id },
      data,
    });
    return setting ? this.toDomain(setting) : null;
  }

  async upsert(
    userId: string,
    privacyCode: PrivacyCode,
    selectedValue: string
  ): Promise<UserPrivacySetting> {
    const setting = await this.prisma.userPrivacySetting.upsert({
      where: {
        userId_privacyCode: {
          userId,
          privacyCode,
        },
      },
      update: {
        selectedValue,
      },
      create: {
        userId,
        privacyCode,
        selectedValue,
      },
    });
    return this.toDomain(setting);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userPrivacySetting.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.userPrivacySetting.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  private toDomain(prismaSetting: any): UserPrivacySetting {
    return new UserPrivacySetting(
      prismaSetting.id,
      prismaSetting.userId,
      prismaSetting.privacyCode as PrivacyCode,
      prismaSetting.selectedValue,
      prismaSetting.createdAt,
      prismaSetting.updatedAt
    );
  }
}

