import { PrismaClient } from '@prisma/client';
import { Profile } from '../../domain/user/profile.entity';

export class ProfilePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    return profile ? this.toDomain(profile) : null;
  }

  async findByUserId(userId: number): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    return profile ? this.toDomain(profile) : null;
  }

  async create(userId: number, displayName?: string, bio?: string, country?: string, birthDate?: Date): Promise<Profile> {
    const profile = await this.prisma.profile.create({
      data: {
        userId,
        displayName,
        bio,
        country,
        birthDate
      }
    });
    return this.toDomain(profile);
  }

  async update(id: number, data: { displayName?: string; bio?: string; country?: string; birthDate?: Date }): Promise<Profile | null> {
    const profile = await this.prisma.profile.update({
      where: { id },
      data
    });
    return profile ? this.toDomain(profile) : null;
  }

  async updateByUserId(userId: number, data: { displayName?: string; bio?: string; country?: string; birthDate?: Date }): Promise<Profile | null> {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data
    });
    return profile ? this.toDomain(profile) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.profile.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<Profile[]> {
    const profiles = await this.prisma.profile.findMany();
    return profiles.map(profile => this.toDomain(profile));
  }

  private toDomain(prismaProfile: any): Profile {
    return new Profile(
      prismaProfile.id,
      prismaProfile.userId,
      prismaProfile.displayName,
      prismaProfile.bio,
      prismaProfile.country,
      prismaProfile.birthDate,
      prismaProfile.createdAt,
      prismaProfile.updatedAt
    );
  }
}