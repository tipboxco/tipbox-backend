import { PrismaClient } from '@prisma/client';
import { UserDevice } from '../../domain/user/user-device.entity';

export class UserDevicePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<UserDevice | null> {
    const device = await this.prisma.userDevice.findUnique({ where: { id } });
    return device ? this.toDomain(device) : null;
  }

  async findByUserId(userId: string): Promise<UserDevice[]> {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastLoginAt: 'desc' },
    });
    return devices.map((device) => this.toDomain(device));
  }

  async findByUserIdAndUserAgent(userId: string, userAgent: string): Promise<UserDevice | null> {
    const device = await this.prisma.userDevice.findUnique({
      where: {
        userId_userAgent: {
          userId,
          userAgent,
        },
      },
    });
    return device ? this.toDomain(device) : null;
  }

  async create(
    userId: string,
    name: string,
    location: string | null,
    userAgent: string,
    ipAddress: string | null,
    isActive: boolean = false
  ): Promise<UserDevice> {
    const device = await this.prisma.userDevice.create({
      data: {
        userId,
        name,
        location,
        userAgent,
        ipAddress,
        isActive,
      },
    });
    return this.toDomain(device);
  }

  async update(
    id: string,
    data: {
      name?: string;
      location?: string | null;
      isActive?: boolean;
      lastLoginAt?: Date;
    }
  ): Promise<UserDevice | null> {
    const device = await this.prisma.userDevice.update({
      where: { id },
      data,
    });
    return device ? this.toDomain(device) : null;
  }

  async setActiveDevice(userId: string, deviceId?: string): Promise<void> {
    // Tüm cihazları inactive yap
    await this.prisma.userDevice.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Eğer deviceId belirtilmişse, o cihazı active yap
    if (deviceId) {
      await this.prisma.userDevice.update({
        where: { id: deviceId },
        data: { isActive: true, lastLoginAt: new Date() },
      });
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userDevice.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.userDevice.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  async upsert(
    userId: string,
    name: string,
    location: string | null,
    userAgent: string,
    ipAddress: string | null,
    isActive: boolean
  ): Promise<UserDevice> {
    const device = await this.prisma.userDevice.upsert({
      where: {
        userId_userAgent: {
          userId,
          userAgent,
        },
      },
      update: {
        name,
        location,
        ipAddress,
        isActive,
        lastLoginAt: new Date(),
      },
      create: {
        userId,
        name,
        location,
        userAgent,
        ipAddress,
        isActive,
        firstLoginAt: new Date(),
        lastLoginAt: new Date(),
      },
    });
    return this.toDomain(device);
  }

  private toDomain(prismaDevice: any): UserDevice {
    return new UserDevice(
      prismaDevice.id,
      prismaDevice.userId,
      prismaDevice.name,
      prismaDevice.location,
      prismaDevice.userAgent,
      prismaDevice.ipAddress,
      prismaDevice.isActive,
      prismaDevice.firstLoginAt,
      prismaDevice.lastLoginAt,
      prismaDevice.createdAt,
      prismaDevice.updatedAt
    );
  }
}

