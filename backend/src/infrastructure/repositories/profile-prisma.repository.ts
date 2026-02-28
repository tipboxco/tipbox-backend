import type { Profile as PrismaProfileModel } from '@prisma/client';
import { Profile } from '../../domain/user/profile.entity';
import { DEFAULT_PROFILE_BANNER_URL } from '../../domain/user/profile.constants';
import { getPrisma } from './prisma.client';

export class ProfilePrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    return profile ? this.toDomain(profile) : null;
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    return profile ? this.toDomain(profile) : null;
  }

  async create(userId: string, displayName?: string, userName?: string, bio?: string, country?: string, birthDate?: Date, cosmeticBadgeId?: string | null): Promise<Profile> {
    const profile = await this.prisma.profile.create({
      data: {
        userId,
        displayName: displayName ?? null,
        userName: userName ?? null,
        bio: bio ?? null,
        bannerUrl: DEFAULT_PROFILE_BANNER_URL,
        cosmeticBadgeId: cosmeticBadgeId ?? null,
        country: country ?? null,
        birthDate: birthDate ?? null,
      }
    });
    return this.toDomain(profile);
  }

  async update(id: string, data: { displayName?: string; userName?: string; bio?: string; bannerUrl?: string | null; cosmeticBadgeId?: string | null; country?: string; birthDate?: Date }): Promise<Profile | null> {
    const profile = await this.prisma.profile.update({
      where: { id },
      data
    });
    return profile ? this.toDomain(profile) : null;
  }

  async updateByUserId(userId: string, data: { displayName?: string; userName?: string; bio?: string; bannerUrl?: string | null; cosmeticBadgeId?: string | null; country?: string; birthDate?: Date }): Promise<Profile | null> {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data
    });
    return profile ? this.toDomain(profile) : null;
  }

  async findByUserName(userName: string): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { userName } });
    return profile ? this.toDomain(profile) : null;
  }

  async delete(id: string): Promise<boolean> {
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

  private toDomain(prismaProfile: PrismaProfileModel): Profile {
    return new Profile(
      prismaProfile.id,
      prismaProfile.userId,
      prismaProfile.displayName,
      prismaProfile.userName,
      prismaProfile.bio,
      prismaProfile.bannerUrl ?? DEFAULT_PROFILE_BANNER_URL,
      prismaProfile.cosmeticBadgeId ?? null,
      prismaProfile.country,
      prismaProfile.birthDate,
      prismaProfile.postsCount || 0,
      prismaProfile.trustCount || 0,
      prismaProfile.trusterCount || 0,
      prismaProfile.unseenFeedCount || 0,
      prismaProfile.createdAt,
      prismaProfile.updatedAt
    );
  }
}