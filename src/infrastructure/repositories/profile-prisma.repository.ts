import { Profile } from '../../domain/user/profile.entity';
import { getPrisma } from './prisma.client';

export class ProfilePrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { id } as any });
    return profile ? this.toDomain(profile) : null;
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } as any });
    return profile ? this.toDomain(profile) : null;
  }

  async create(userId: string, displayName?: string, userName?: string, bio?: string, country?: string, birthDate?: Date): Promise<Profile> {
    const profile = await this.prisma.profile.create({
      data: {
        userId,
        displayName,
        userName,
        bio,
        bannerUrl: undefined,
        country,
        birthDate
      } as any
    });
    return this.toDomain(profile);
  }

  async update(id: string, data: { displayName?: string; userName?: string; bio?: string; bannerUrl?: string | null; country?: string; birthDate?: Date }): Promise<Profile | null> {
    const profile = await this.prisma.profile.update({
      where: { id } as any,
      data: data as any
    });
    return profile ? this.toDomain(profile) : null;
  }

  async updateByUserId(userId: string, data: { displayName?: string; userName?: string; bio?: string; bannerUrl?: string | null; country?: string; birthDate?: Date }): Promise<Profile | null> {
    const profile = await this.prisma.profile.update({
      where: { userId } as any,
      data: data as any
    });
    return profile ? this.toDomain(profile) : null;
  }

  async findByUserName(userName: string): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({ where: { userName } as any });
    return profile ? this.toDomain(profile) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.profile.delete({ where: { id } as any });
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
      prismaProfile.userName,
      prismaProfile.bio,
      prismaProfile.bannerUrl ?? null,
      prismaProfile.country,
      prismaProfile.birthDate,
      prismaProfile.postsCount ?? 0,
      prismaProfile.trustCount ?? 0,
      prismaProfile.trusterCount ?? 0,
      prismaProfile.unseenFeedCount ?? 0,
      prismaProfile.createdAt,
      prismaProfile.updatedAt
    );
  }
}