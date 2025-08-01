import { PrismaClient } from '@prisma/client';
import { UserAvatar } from '../../domain/user/user-avatar.entity';

export class UserAvatarPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<UserAvatar | null> {
    const avatar = await this.prisma.userAvatar.findUnique({ where: { id } });
    return avatar ? this.toDomain(avatar) : null;
  }

  async findByUserId(userId: number): Promise<UserAvatar[]> {
    const avatars = await this.prisma.userAvatar.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return avatars.map(avatar => this.toDomain(avatar));
  }

  async findActiveByUserId(userId: number): Promise<UserAvatar | null> {
    const avatar = await this.prisma.userAvatar.findFirst({
      where: { 
        userId,
        isActive: true 
      }
    });
    return avatar ? this.toDomain(avatar) : null;
  }

  async create(userId: number, imageUrl: string, isActive: boolean = false): Promise<UserAvatar> {
    // If setting as active, deactivate other avatars
    if (isActive) {
      await this.prisma.userAvatar.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
      });
    }

    const avatar = await this.prisma.userAvatar.create({
      data: {
        userId,
        imageUrl,
        isActive
      }
    });
    return this.toDomain(avatar);
  }

  async update(id: number, data: { imageUrl?: string; isActive?: boolean }): Promise<UserAvatar | null> {
    const avatar = await this.prisma.userAvatar.findUnique({ where: { id } });
    
    // If setting as active, deactivate other avatars for same user
    if (data.isActive && avatar) {
      await this.prisma.userAvatar.updateMany({
        where: { 
          userId: avatar.userId, 
          isActive: true,
          id: { not: id }
        },
        data: { isActive: false }
      });
    }

    const updatedAvatar = await this.prisma.userAvatar.update({
      where: { id },
      data
    });
    return updatedAvatar ? this.toDomain(updatedAvatar) : null;
  }

  async setActiveAvatar(userId: number, avatarId: number): Promise<UserAvatar | null> {
    // Deactivate all avatars for user
    await this.prisma.userAvatar.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });

    // Activate selected avatar
    const avatar = await this.prisma.userAvatar.update({
      where: { id: avatarId },
      data: { isActive: true }
    });
    return avatar ? this.toDomain(avatar) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.userAvatar.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserAvatar[]> {
    const avatars = await this.prisma.userAvatar.findMany();
    return avatars.map(avatar => this.toDomain(avatar));
  }

  private toDomain(prismaAvatar: any): UserAvatar {
    return new UserAvatar(
      prismaAvatar.id,
      prismaAvatar.userId,
      prismaAvatar.imageUrl,
      prismaAvatar.isActive,
      prismaAvatar.createdAt,
      prismaAvatar.updatedAt
    );
  }
}