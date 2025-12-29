import { User } from '../../domain/user/user.entity';
import { ContextType } from '../../domain/content/context-type.enum';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserSettingsPrismaRepository } from '../../infrastructure/repositories/user-settings-prisma.repository';
import { UserDevicePrismaRepository } from '../../infrastructure/repositories/user-device-prisma.repository';
import { UserPrivacySettingPrismaRepository } from '../../infrastructure/repositories/user-privacy-setting-prisma.repository';
import { TrustRelationPrismaRepository } from '../../infrastructure/repositories/trust-relation-prisma.repository';
import { NotificationCode } from '../../domain/user/notification-code.enum';
import { PrivacyCode } from '../../domain/user/privacy-code.enum';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import logger from '../../infrastructure/logger/logger';
import { DEFAULT_PROFILE_BANNER_URL } from '../../domain/user/profile.constants';
import { ExperienceContent } from '../../interfaces/feed/feed.dto';

type CosmeticSummary = {
  id: string;
  title: string;
  image: string | null;
} | null;

type ProfileBadgeSummary = {
  id: string;
  title: string;
  image: string | null;
};

type BasicStats = {
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
};

type TaskType = 'Comment' | 'Like' | 'Share';

type CollectionTask = {
  id: string;
  title: string;
  type: TaskType;
};

type RarityType = 'Usual' | 'Rare' | 'Epic' | 'Legendary';

type CollectionResponse = {
  id: string;
  image: string | null;
  title: string;
  rarity: RarityType;
  isClaimed: boolean;
  nftAddress: string | null;
  totalEarned: number;
  earnedDate: string | null;
  tasks: CollectionTask[];
};

type UserProfileDetails = {
  id: string;
  name: string;
  avatar: string | null;
  banner: string | null;
  biography: string | null;
  cosmetic: string | null;
  cosmeticDetail: CosmeticSummary;
  titles: string[];
  stats: { posts: number; trust: number; truster: number };
  badges: ProfileBadgeSummary[];
};

const EXPERIENCE_SECTION_TITLES = {
  PRICE: 'Price and Shopping Experience',
  USAGE: 'Product and Usage Experience',
} as const;

// Default badge image path (bucket path format)
const DEFAULT_BADGE_IMAGE_PATH = 'badges/custom/HardwareExpert.png'; // Fallback badge görseli

const COLLECTION_RARITY_MAP: Record<string, RarityType> = {
  COMMON: 'Usual',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
};

const TASK_TYPE_KEYWORDS: Array<{ matcher: RegExp; type: TaskType }> = [
  { matcher: /yorum|comment/i, type: 'Comment' },
  { matcher: /beğeni|like/i, type: 'Like' },
  { matcher: /paylaş|share/i, type: 'Share' },
];

const inferTaskType = (title?: string, requirement?: string): TaskType => {
  const source = `${title ?? ''} ${requirement ?? ''}`.trim();
  if (!source) return 'Comment';
  const match = TASK_TYPE_KEYWORDS.find(({ matcher }) => matcher.test(source));
  return match?.type ?? 'Comment';
};

export const PROFILE_FEED_CARD_TYPES = ['post', 'feed', 'benchmark', 'tipsAndTricks', 'question', 'experience', 'update'] as const;
export type ProfileFeedCardType = (typeof PROFILE_FEED_CARD_TYPES)[number];

export class UserService {
  private readonly s3Service: S3Service;
  private readonly cacheService: CacheService;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly settingsRepo: UserSettingsPrismaRepository;
  private readonly deviceRepo: UserDevicePrismaRepository;
  private readonly privacySettingRepo: UserPrivacySettingPrismaRepository;
  private readonly trustRelationRepo: TrustRelationPrismaRepository;
  private readonly prisma: PrismaClient;

  constructor(private readonly userRepo = new UserPrismaRepository()) {
    this.s3Service = new S3Service();
    this.cacheService = CacheService.getInstance();
    this.profileRepo = new ProfilePrismaRepository();
    this.settingsRepo = new UserSettingsPrismaRepository();
    this.deviceRepo = new UserDevicePrismaRepository();
    this.privacySettingRepo = new UserPrivacySettingPrismaRepository();
    this.trustRelationRepo = new TrustRelationPrismaRepository();
    this.prisma = new PrismaClient();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  /**
   * Kullanıcı profilini cache'ten veya veritabanından alır (Cache-Aside Pattern)
   * @param userId - Kullanıcı ID'si
   * @returns Kullanıcı profili
   */
  async getUserProfile(userId: string): Promise<User | null> {
    const cacheKey = `user:${userId}:profile`;
    
    // Önce cache'ten kontrol et (graceful degradation)
    // CacheService otomatik olarak cache hit/miss işaretler
    try {
      const cachedUser = await this.cacheService.get<User>(cacheKey);
      if (cachedUser) {
        logger.debug(`Cache hit for user profile: ${userId}`);
        return cachedUser;
      }
    } catch (error) {
      logger.warn('Cache error while getting user profile, falling back to database', { 
        error, 
        userId,
        operation: 'getUserProfile'
      });
    }

    // Cache miss veya cache error - veritabanından çek
    const user = await this.userRepo.findById(userId);
    if (user) {
      // Cache'e kaydet (best effort - hata olsa bile devam et)
      try {
        await this.cacheService.set(cacheKey, user, 3600);
      } catch (error) {
        logger.warn('Cache set failed for user profile', { 
          error, 
          userId,
          operation: 'getUserProfile'
        });
      }
    }
    
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findByEmail(email);
  }

  async createUser(email: string, displayName?: string): Promise<User> {
    return this.userRepo.create(email, displayName);
  }

  async createUserWithPassword(email: string, passwordHash: string, displayName?: string): Promise<User> {
    return this.userRepo.createWithPassword(email, passwordHash, displayName);
  }

  async updateUser(id: string, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    return this.userRepo.update(id, data);
  }

  /**
   * Kullanıcı profilini günceller ve cache'i temizler
   * @param userId - Kullanıcı ID'si
   * @param data - Güncellenecek veri
   * @returns Güncellenmiş kullanıcı profili
   */
  async updateUserProfile(userId: string, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    try {
      // Veritabanını güncelle
      const updatedUser = await this.userRepo.update(userId, data);
      
      if (updatedUser) {
        // Cache'i temizle (cache invalidation)
        const cacheKey = `user:${userId}:profile`;
        await this.cacheService.del(cacheKey);
      }
      
      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userRepo.delete(id);
  }

  async listUsers(): Promise<User[]> {
    return this.userRepo.list();
  }

  async getUserProfileCard(userId: string): Promise<{
    id: string;
    name: string;
    avatar: string | null;
    bannerUrl: string | null;
    description: string | null;
    titles: string[];
    stats: { posts: number; trust: number; truster: number };
    badges: Array<{ imageUrl: string | null; title: string }>
  } | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) return null;

    const [profile, activeAvatar, titles, userBadges] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.prisma.userAvatar.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.userTitle.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' }, take: 5 }),
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { claimedAt: 'desc' },
        take: 6,
      }),
    ]);

    return {
      id: user.id,
      name: profile?.displayName || user.name || 'Anonymous User',
      avatar: resolveMediaUrl(activeAvatar?.imageUrl ?? null),
      bannerUrl: resolveMediaUrl(profile?.bannerUrl ?? DEFAULT_PROFILE_BANNER_URL),
      description: profile?.bio ?? null,
      titles: titles.map(t => t.title),
      stats: {
        posts: profile?.postsCount ?? 0,
        trust: profile?.trustCount ?? 0,
        truster: profile?.trusterCount ?? 0,
      },
      badges: userBadges.map(ub => ({ imageUrl: resolveMediaUrl(ub.badge.imageUrl ?? null), title: ub.badge.name })),
    };
  }

  /**
   * Self profile (for account page) - maps to required UserProfile shape
   */
  async getSelfUserProfile(userId: string): Promise<UserProfileDetails | null> {
    const card = await this.getUserProfileCard(userId);
    if (!card) return null;

    const profileRecord = await this.prisma.profile.findUnique({ where: { userId } });
    const cosmeticBadgeId = profileRecord ? ((profileRecord as any).cosmeticBadgeId ?? null) : null;
    const [cosmeticBadge, userBadges] = await Promise.all([
      cosmeticBadgeId
        ? this.prisma.badge.findUnique({
            where: { id: cosmeticBadgeId },
            select: { id: true, name: true, imageUrl: true },
          })
        : Promise.resolve(null),
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { claimedAt: 'desc' },
        take: 6,
      }),
    ]);

    const cosmeticDetail: CosmeticSummary = cosmeticBadge
      ? {
          id: cosmeticBadge.id,
          title: cosmeticBadge.name,
          image: resolveMediaUrl(cosmeticBadge.imageUrl ?? null),
        }
      : null;

    return {
      id: card.id,
      name: card.name,
      avatar: card.avatar,
      banner: card.bannerUrl,
      biography: card.description,
      cosmetic: cosmeticBadgeId,
      cosmeticDetail,
      titles: card.titles,
      stats: card.stats,
      badges: userBadges.map((ub) => ({
        id: String(ub.badgeId),
        title: ub.badge.name,
        image: resolveMediaUrl(ub.badge.imageUrl ?? null),
      })),
    };
  }

  /**
   * Other user's profile for a viewer, includes isTrusted flag
   */
  async getUserProfileForViewer(
    viewerUserId: string,
    targetUserId: string,
  ): Promise<(UserProfileDetails & { isTrusted: boolean }) | null> {
    const base = await this.getSelfUserProfile(targetUserId);
    if (!base) return null;

    const rel = await this.prisma.trustRelation.findUnique({
      where: { trusterId_trustedUserId: { trusterId: viewerUserId, trustedUserId: targetUserId } },
    });

    return {
      ...base,
      isTrusted: !!rel,
    };
  }

  async updateProfileDetails(userId: string, payload: {
    name?: string;
    biography?: string;
    banner?: string | null;
    avatar?: string;
    cosmeticId?: string | null;
    badges?: Array<{ id: string }>;
  }): Promise<void> {
    const { name, biography, banner, avatar, cosmeticId, badges } = payload;

    await this.prisma.$transaction(async (tx) => {
      let validatedCosmeticId: string | null | undefined = undefined;
      if (typeof cosmeticId !== 'undefined') {
        if (cosmeticId) {
          const badge = await tx.badge.findUnique({
            where: { id: cosmeticId },
            select: { id: true, type: true },
          });
          if (!badge || badge.type !== 'COSMETIC') {
            throw new Error('Geçersiz cosmetic seçimi');
          }
          const ownsCosmetic = await tx.userBadge.findUnique({
            where: { userId_badgeId: { userId, badgeId: cosmeticId } },
          });
          if (!ownsCosmetic) {
            throw new Error('Bu cosmetic kullanıcıya ait değil');
          }
          validatedCosmeticId = cosmeticId;
        } else {
          validatedCosmeticId = null;
        }
      }

      const profileData: any = {};
      if (typeof name === 'string') {
        const trimmed = name.trim();
        if (!trimmed) {
          throw new Error('İsim alanı boş olamaz');
        }
        profileData.displayName = trimmed;
      }
      if (typeof biography !== 'undefined') {
        profileData.bio = biography ?? null;
      }
      if (typeof banner !== 'undefined') {
        profileData.bannerUrl = banner || DEFAULT_PROFILE_BANNER_URL;
      }
      if (typeof validatedCosmeticId !== 'undefined') {
        profileData.cosmeticBadgeId = validatedCosmeticId;
      }

      const existingProfile = await tx.profile.findUnique({ where: { userId } });
      if (Object.keys(profileData).length > 0) {
        if (existingProfile) {
          await tx.profile.update({
            where: { userId },
            data: profileData,
          });
        } else {
          await tx.profile.create({
            data: {
              userId,
              displayName: profileData.displayName ?? name ?? 'Anonymous User',
              userName: null,
              bio: typeof biography !== 'undefined' ? biography : null,
              bannerUrl: typeof banner !== 'undefined' ? (banner || DEFAULT_PROFILE_BANNER_URL) : DEFAULT_PROFILE_BANNER_URL,
              cosmeticBadgeId: typeof validatedCosmeticId !== 'undefined' ? validatedCosmeticId : undefined,
            } as any,
          });
        }
      }

      if (avatar) {
        await tx.userAvatar.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });
        await tx.userAvatar.create({
          data: {
            userId,
            imageUrl: avatar,
            isActive: true,
          },
        });
      }

      if (Array.isArray(badges)) {
        await tx.userBadge.updateMany({
          where: { userId },
          data: { isVisible: false, displayOrder: null },
        });

        for (const [index, badge] of badges.entries()) {
          if (!badge?.id) continue;
          
          // Badge ID'si UUID formatında mı kontrol et
          // Eğer değilse, name'e göre badge'i bul
          let badgeId = badge.id;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          
          if (!uuidRegex.test(badgeId)) {
            // UUID değilse, name'e göre badge'i bul
            // Önce direkt name ile dene
            let foundBadge = await tx.badge.findFirst({
              where: {
                name: { equals: badgeId, mode: 'insensitive' },
              },
              select: { id: true },
            });
            
            // Bulunamazsa, slug formatını normal formata çevirip dene
            // Örn: "home_appliance" -> "Home Appliance"
            if (!foundBadge) {
              const normalizedName = badgeId
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
              
              foundBadge = await tx.badge.findFirst({
                where: {
                  name: { equals: normalizedName, mode: 'insensitive' },
                },
                select: { id: true },
              });
            }
            
            // Hala bulunamazsa, contains ile dene (kısmi eşleşme)
            if (!foundBadge) {
              foundBadge = await tx.badge.findFirst({
                where: {
                  OR: [
                    { name: { contains: badgeId, mode: 'insensitive' } },
                    { name: { contains: badgeId.replace(/_/g, ' '), mode: 'insensitive' } },
                  ],
                },
                select: { id: true },
              });
            }
            
            if (!foundBadge) {
              logger.warn(`Badge not found by name: ${badgeId}`);
              continue;
            }
            
            badgeId = foundBadge.id;
          }
          
          await tx.userBadge.upsert({
            where: { userId_badgeId: { userId, badgeId } },
            update: {
              isVisible: true,
              displayOrder: index,
              visibility: 'PUBLIC',
            },
            create: {
              userId,
              badgeId,
              isVisible: true,
              displayOrder: index,
              visibility: 'PUBLIC',
              claimed: true,
              claimedAt: new Date(),
            } as any,
          });
        }
      }
    });

    await this.cacheService.del(`user:${userId}:profile`);
  }

  async listTrustedUsers(userId: string, query?: string): Promise<Array<{
    id: string;
    userName: string | null;
    titles: string[];
    avatar: string | null;
    name: string | null;
  }>> {
    const trustedRelations = await this.prisma.trustRelation.findMany({
      where: { trusterId: userId },
      select: { trustedUserId: true },
    });
    const trustedIds = trustedRelations.map(r => r.trustedUserId);
    if (trustedIds.length === 0) return [];

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: { in: trustedIds } as any,
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { userName: { contains: query, mode: 'insensitive' } },
              ] as any,
            }
          : {}),
      },
      select: { userId: true, displayName: true, userName: true } as any,
    });
    const titles = await this.prisma.userTitle.findMany({
      where: { userId: { in: profiles.map(p => p.userId) } },
      orderBy: { earnedAt: 'desc' },
    });
    const avatars = await this.prisma.userAvatar.findMany({
      where: { userId: { in: profiles.map(p => p.userId) }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const titleMap = new Map<string, string[]>();
    titles.forEach(t => {
      const arr = titleMap.get(t.userId) || [];
      arr.push(t.title);
      titleMap.set(t.userId, arr);
    });
    const avatarMap = new Map<string, string>();
    avatars.forEach(a => {
      if (!avatarMap.has(a.userId)) avatarMap.set(a.userId, a.imageUrl);
    });

    // Default avatar path'ini resolve et
    const defaultAvatarPath = 'avatars/default/default-useravatar.png';
    const defaultAvatarUrl = resolveMediaUrl(defaultAvatarPath);

    return profiles.map(p => {
      const avatarUrl = resolveMediaUrl(avatarMap.get(String(p.userId)) ?? null);
      return {
        id: String(p.userId),
        userName: p.userName ?? null,
        titles: (titleMap.get(String(p.userId)) || []).slice(0, 3),
        avatar: avatarUrl || defaultAvatarUrl || '',
        name: p.displayName,
      };
    });
  }

  async removeTrust(userId: string, targetUserId: string): Promise<boolean> {
    try {
      await this.prisma.trustRelation.delete({
        where: { trusterId_trustedUserId: { trusterId: userId, trustedUserId: targetUserId } },
      });

      // Decrement truster's trustCount
      await this.prisma.profile.updateMany({
        where: { userId },
        data: {
          trustCount: {
            increment: -1
          }
        } as any
      });

      // Decrement trusted user's trusterCount
      await this.prisma.profile.updateMany({
        where: { userId: targetUserId },
        data: {
          trusterCount: {
            increment: -1
          }
        } as any
      });

      return true;
    } catch {
      return false;
    }
  }

  async addTrust(userId: string, targetUserId: string): Promise<void> {
    // Check if relation already exists
    const existing = await this.trustRelationRepo.findByUsers(userId, targetUserId);

    if (existing) {
      logger.info({ message: 'Trust relation already exists', userId, targetUserId });
      return;
    }

    // Create trust relation using repository
    // Bu metod otomatik olarak:
    // 1. Trust relation oluşturur
    // 2. Profile count'ları günceller
    // 3. Backfill job'ı kuyruğa ekler
    await this.trustRelationRepo.create(userId, targetUserId);
    
    logger.info({ message: 'Trust relation created successfully', userId, targetUserId });
  }

  /**
   * Recalculate trust and truster counts for users after trust operations
   * Updates both trustCount (how many users this user trusts) and trusterCount (how many users trust this user)
   */
  private async recalculateTrustCounts(trusterId: string, trustedUserId: string): Promise<void> {
    // Calculate all counts in parallel for both users
    const [
      trusterTrustCount,      // How many users trusterId trusts
      trusterTrusterCount,    // How many users trust trusterId
      trustedTrustCount,      // How many users trustedUserId trusts
      trustedTrusterCount     // How many users trust trustedUserId
    ] = await Promise.all([
      // truster's trustCount: count where trusterId is the truster
      this.prisma.trustRelation.count({
        where: { trusterId }
      }),
      // truster's trusterCount: count where trusterId is the trusted user
      this.prisma.trustRelation.count({
        where: { trustedUserId: trusterId }
      }),
      // trusted user's trustCount: count where trustedUserId is the truster
      this.prisma.trustRelation.count({
        where: { trusterId: trustedUserId }
      }),
      // trusted user's trusterCount: count where trustedUserId is the trusted user
      this.prisma.trustRelation.count({
        where: { trustedUserId }
      })
    ]);

    // Update both users' profiles with recalculated counts
    await Promise.all([
      // Update truster's profile
      this.prisma.profile.updateMany({
        where: { userId: trusterId },
        data: {
          trustCount: trusterTrustCount,
          trusterCount: trusterTrusterCount
        } as any
      }),
      // Update trusted user's profile
      this.prisma.profile.updateMany({
        where: { userId: trustedUserId },
        data: {
          trustCount: trustedTrustCount,
          trusterCount: trustedTrusterCount
        } as any
      })
    ]);
  }

  async listTrusters(userId: string, query?: string): Promise<Array<{
    id: string;
    userName: string | null;
    titles: string[];
    avatar: string | null;
    name: string | null;
    isTrusted: boolean;
  }>> {
    const trusterRelations = await this.prisma.trustRelation.findMany({
      where: { trustedUserId: userId },
      select: { trusterId: true },
    });
    const trusterIds = trusterRelations.map(r => r.trusterId);
    if (trusterIds.length === 0) return [];

    const profiles = await this.prisma.profile.findMany({
      where: {
        userId: { in: trusterIds } as any,
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { userName: { contains: query, mode: 'insensitive' } },
              ] as any,
            }
          : {}),
      },
      select: { userId: true, displayName: true, userName: true } as any,
    });

    const titles = await this.prisma.userTitle.findMany({
      where: { userId: { in: profiles.map(p => p.userId) } },
      orderBy: { earnedAt: 'desc' },
    });
    const avatars = await this.prisma.userAvatar.findMany({
      where: { userId: { in: profiles.map(p => p.userId) }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // who current user trusts to compute isTrusted
    const myTrusted = await this.prisma.trustRelation.findMany({ where: { trusterId: userId } });
    const myTrustedSet = new Set(myTrusted.map(r => r.trustedUserId));

    const titleMap = new Map<string, string[]>();
    titles.forEach(t => {
      const arr = titleMap.get(t.userId) || [];
      arr.push(t.title);
      titleMap.set(t.userId, arr);
    });
    const avatarMap = new Map<string, string>();
    avatars.forEach(a => {
      if (!avatarMap.has(a.userId)) avatarMap.set(a.userId, a.imageUrl);
    });

    // Default avatar path'ini resolve et
    const defaultAvatarPath = 'avatars/default/default-useravatar.png';
    const defaultAvatarUrl = resolveMediaUrl(defaultAvatarPath);

    return profiles.map(p => {
      const avatarUrl = resolveMediaUrl(avatarMap.get(String(p.userId)) ?? null);
      return {
        id: String(p.userId),
        userName: p.userName ?? null,
        titles: (titleMap.get(String(p.userId)) || []).slice(0, 3),
        avatar: avatarUrl || defaultAvatarUrl || '',
        name: p.displayName,
        isTrusted: myTrustedSet.has(String(p.userId)),
      };
    });
  }

  async blockUser(userId: string, targetUserId: string): Promise<void> {
    // idempotent create - Prisma model name is UserBlock
    await (this.prisma as any).userBlock.upsert({
      where: { blockerId_blockedUserId: { blockerId: userId, blockedUserId: targetUserId } },
      update: {},
      create: { blockerId: userId, blockedUserId: targetUserId },
    });
  }

  async unblockUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      await (this.prisma as any).userBlock.delete({
        where: { blockerId_blockedUserId: { blockerId: userId, blockedUserId: targetUserId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async muteUser(userId: string, targetUserId: string): Promise<void> {
    // idempotent create - Prisma model name is UserMute
    await (this.prisma as any).userMute.upsert({
      where: { muterId_mutedUserId: { muterId: userId, mutedUserId: targetUserId } },
      update: {},
      create: { muterId: userId, mutedUserId: targetUserId },
    });
  }

  async unmuteUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      await (this.prisma as any).userMute.delete({
        where: { muterId_mutedUserId: { muterId: userId, mutedUserId: targetUserId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async listAchievementBadges(
    userId: string,
    query?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: CollectionResponse[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor =
      options?.cursor && /^[0-9a-fA-F-]{36}$/.test(options.cursor) ? options.cursor : undefined;

    const where: any = {
      userId,
      badge: {
        type: 'ACHIEVEMENT',
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        } : {}),
      },
    };

    if (cursor) {
      where.badgeId = { lt: cursor };
    }

    const userBadges = await this.prisma.userBadge.findMany({
      where,
      include: {
        badge: {
          include: {
            achievementGoals: {
              include: {
                chain: true,
                userAchievements: {
                  where: { userId },
                },
              },
            },
            _count: {
              select: { userBadges: true },
            },
          },
        },
      },
      orderBy: { claimedAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = userBadges.length > limit;
    const paginatedBadges = hasMore ? userBadges.slice(0, limit) : userBadges;

    const items = paginatedBadges.map((ub) => {
      const badge = (ub as any).badge;
      const goals = (badge?.achievementGoals || []) as any[];
      const tasks: CollectionTask[] = goals.map((goal) => ({
          id: String(goal.id),
          title: goal.title,
        type: inferTaskType(goal.title, goal.requirement),
      }));

      return {
        id: String(badge?.id || ''),
        title: badge?.name || '',
        rarity: COLLECTION_RARITY_MAP[badge?.rarity || 'COMMON'] || 'Usual',
        image: this.resolveBadgeImage(badge),
        isClaimed: !!ub.claimed,
        nftAddress: badge?.nftAddress ?? null,
        earnedDate: ub.claimedAt ? ub.claimedAt.toISOString() : null,
        totalEarned: badge?._count?.userBadges ?? 0,
        tasks,
      } as CollectionResponse;
    });

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Achievement sekmesi için badge listesi (infinite scroll + status filtresi)
   */
  async getAchievementBadges(
    userId: string,
    options?: {
      cursor?: string;
      limit?: number;
      status?: 'not-started' | 'in_progress' | 'completed';
    }
  ): Promise<{
    items: Array<{
      id: string;
      title: string;
      image: string;
      description: string;
      current: number;
      total: number;
      status: 'not-started' | 'in_progress' | 'completed';
    }>;
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;

    // Tüm ACHIEVEMENT tipindeki badgeleri kullanıcı progress'i ile birlikte çek
    const badges = await this.prisma.badge.findMany({
      where: {
        type: 'ACHIEVEMENT',
      },
      include: {
        achievementGoals: {
          include: {
            userAchievements: {
              where: { userId },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    } as any);

    const mapStatus = (current: number, total: number): 'not-started' | 'in_progress' | 'completed' => {
      if (current <= 0) return 'not-started';
      if (current >= total) return 'completed';
      return 'in_progress';
    };

    const mapped = badges.map((badge: any) => {
      const goals = badge.achievementGoals || [];
      const total = goals.reduce(
        (sum: number, g: any) => sum + (g.pointsRequired || 0),
        0
      );
      const current = goals.reduce(
        (sum: number, g: any) => sum + (g.userAchievements?.[0]?.progress || 0),
        0
      );

      const status = mapStatus(current, total || 1);

      return {
        id: String(badge.id),
        title: badge.name || '',
        image: this.resolveBadgeImage(badge),
        description: badge.description || '',
        current,
        total: total || 1,
        status,
      };
    });

    // Status filtresi uygula
    const filtered = options?.status
      ? mapped.filter((b) => b.status === options.status)
      : mapped;

    // Basit cursor: badge id'sine göre
    let startIndex = 0;
    if (options?.cursor) {
      const idx = filtered.findIndex((b) => b.id === options.cursor);
      if (idx >= 0) {
        startIndex = idx + 1;
      }
    }

    const sliced = filtered.slice(startIndex, startIndex + limit + 1);
    const hasMore = sliced.length > limit;
    const items = hasMore ? sliced.slice(0, limit) : sliced;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async listBridgeBadges(
    userId: string,
    query?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: CollectionResponse[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const whereClause: any = {
      userId,
      badge: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ] as any,
          }
        : undefined,
    };

    if (cursor) {
      whereClause.badgeId = { lt: cursor };
    }

    const rewards = await this.prisma.bridgeReward.findMany({
      where: whereClause,
      include: {
        badge: {
          include: {
            _count: { select: { bridgeRewards: true } },
            achievementGoals: {
              include: {
                chain: true,
                userAchievements: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
      orderBy: { awardedAt: 'desc' },
      take: limit + 1,
    } as any);

    const hasMore = rewards.length > limit;
    const paginatedRewards = hasMore ? rewards.slice(0, limit) : rewards;

    const items = paginatedRewards.map((rw: any) => {
      const badge = rw.badge;
      const goals = (badge?.achievementGoals || []) as any[];
      const tasks: CollectionTask[] = goals.map((goal) => ({
        id: String(goal.id),
        title: goal.title,
        type: inferTaskType(goal.title, goal.requirement),
      }));

      return {
        id: String(badge?.id || ''),
        title: badge?.name || '',
        rarity: COLLECTION_RARITY_MAP[badge?.rarity || 'COMMON'] || 'Usual',
        image: this.resolveBadgeImage(badge),
        isClaimed: true,
        nftAddress: rw.nftAddress ?? null,
        earnedDate: rw.awardedAt ? rw.awardedAt.toISOString() : null,
        totalEarned: badge?._count?.bridgeRewards ?? 0,
        tasks,
      };
    });

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async claimAchievementBadge(userId: string, badgeId: string): Promise<{ success: boolean }> {
    await this.prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      update: { claimed: true, claimedAt: new Date() },
      create: {
        userId,
        badgeId,
        isVisible: true,
        visibility: 'PUBLIC',
        claimed: true,
        claimedAt: new Date(),
      } as any,
    });
    return { success: true };
  }

  async claimBridgeBadge(userId: string, badgeId: string): Promise<{ success: boolean }> {
    // Create a RewardClaim record to represent claiming action
    await this.prisma.rewardClaim.create({
      data: {
        userId,
        badgeId,
        amount: 0,
        vestingStatus: 'VESTED',
      } as any,
    });
    return { success: true };
  }

  // Profile Feed EP'leri için yardımcı fonksiyonlar
  private async getPostStats(postId: string) {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        likesCount: true,
        commentsCount: true,
        favoritesCount: true,
        viewsCount: true,
        sharesCount: true,
      } as any
    });

    return {
      likes: post?.likesCount || 0,
      comments: post?.commentsCount || 0,
      shares: post?.sharesCount || 0,
      bookmarks: post?.favoritesCount || 0
    };
  }

  private async getUserBase(userId: string) {
    const [profile, avatar, title] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.prisma.userAvatar.findFirst({ where: { userId, isActive: true } }),
      this.prisma.userTitle.findFirst({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    ]);
    return {
      id: userId,
      name: profile?.displayName || 'Anonymous',
      title: title?.title || '',
      avatar: resolveMediaUrl(avatar?.imageUrl ?? null) || '',
    };
  }

  private async getProductBase(productId: string | null) {
    if (!productId) return null;
    const product = await this.prisma.product.findUnique({ 
      where: { id: productId } as any, 
      include: { 
        group: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
      } as any 
    });
    if (!product) return null;
    
    const group = (product as any).group;
    const subCategory = group?.subCategory;
    const mainCategory = subCategory?.mainCategory;
    
    // Image URL'ini bul ve prefix ekle (fallback chain: product -> group -> subCategory -> mainCategory)
    const imagePath = (product as any).imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;
    
    return {
      id: String(product.id),
      name: product.name,
      subName: product.brand || group?.name || subCategory?.name || mainCategory?.name || '',
      image: resolveMediaUrl(imagePath),
    };
  }

  private normalizeContextType(value?: string | null): ContextType {
    const normalized = (value ?? ContextType.PRODUCT).toString().toLowerCase();
    switch (normalized) {
      case ContextType.PRODUCT_GROUP:
      case ContextType.PRODUCT:
      case ContextType.SUB_CATEGORY:
        return normalized as ContextType;
      default:
        return ContextType.PRODUCT;
    }
  }

  private mapContextType(post: any): ContextType {
    if (post?.productId) {
      return this.normalizeContextType(ContextType.PRODUCT);
    }
    if (post?.productGroupId) {
      return this.normalizeContextType(ContextType.PRODUCT_GROUP);
    }
    return this.normalizeContextType(ContextType.SUB_CATEGORY);
  }

  private buildContextDataFromPost(post: any, ownedProductIds?: Set<string> | null) {
    const contextType = this.mapContextType(post);

    if (contextType === ContextType.PRODUCT && post.product) {
      const product = post.product;
      const group = product.group;
      const subCategory = group?.subCategory;
      const mainCategory = subCategory?.mainCategory || post.subCategory?.mainCategory || post.mainCategory;
      const imagePath = product.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;
      return {
        id: String(product.id),
        name: product.name,
        subName: group?.name || subCategory?.name || mainCategory?.name || '',
        image: resolveMediaUrl(imagePath),
        isOwned: ownedProductIds ? ownedProductIds.has(String(product.id)) : undefined,
      };
    }

    if (contextType === ContextType.PRODUCT_GROUP && post.productGroup) {
      const group = post.productGroup;
      const subCategory = group.subCategory;
      const mainCategory = subCategory?.mainCategory || post.mainCategory;
      const imagePath = group.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;
      return {
        id: String(group.id),
        name: group.name,
        subName: subCategory?.name || mainCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    if (contextType === ContextType.SUB_CATEGORY && post.subCategory) {
      const subCategory = post.subCategory;
      const imagePath = subCategory.imageUrl || subCategory.mainCategory?.imageUrl || null;
      return {
        id: String(subCategory.id),
        name: subCategory.name,
        subName: subCategory.mainCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    if (post.mainCategory) {
      return {
        id: String(post.mainCategory.id),
        name: post.mainCategory.name,
        subName: '',
        image: resolveMediaUrl(post.mainCategory.imageUrl || null),
      };
    }

    return null;
  }

  async getUserPosts(userId: string): Promise<any[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { userId, type: 'FREE' } as any,
      include: {
        product: {
          include: {
            group: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
          },
        },
        productGroup: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
        subCategory: {
          include: {
            mainCategory: true,
          },
        },
        mainCategory: true,
        likes: true,
        comments: true,
        favorites: true,
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    const userBase = await this.getUserBase(userId);
    
    // Batch fetch images from PostMedia (orderIndex'e göre sıralı)
    const postIds = posts.map((p) => p.id);
    const postMediaMap = new Map<string, string[]>();
    const ownedProductIds = new Set<string>();
    
    if (postIds.length > 0) {
      const allPostMedia = await this.prisma.postMedia.findMany({
        where: {
          postId: { in: postIds },
        },
        orderBy: { orderIndex: 'asc' }, // Kullanıcının yüklediği sırada
        select: { postId: true, mediaUrl: true },
      });

      // Map'e dönüştür (postId -> mediaUrl array)
      allPostMedia.forEach((media) => {
        if (!postMediaMap.has(media.postId)) {
          postMediaMap.set(media.postId, []);
        }
        const resolvedUrl = resolveMediaUrl(media.mediaUrl);
        if (resolvedUrl) {
          postMediaMap.get(media.postId)!.push(resolvedUrl);
        }
      });
    }
    
    // Owned products için inventory kontrolü (başka bir yerde kullanılıyor olabilir)
    const postProductIds = posts.map((p) => p.productId).filter(Boolean) as string[];
    if (postProductIds.length > 0) {
      const inventories = await this.prisma.inventory.findMany({
        where: {
          userId,
          productId: { in: postProductIds },
        },
        select: { productId: true },
      });
      inventories.forEach((inv) => {
        ownedProductIds.add(String(inv.productId));
      });
    }
    
    const results = await Promise.all(
      posts.map(async (post) => {
        const stats = await this.getPostStats(post.id);
        const contextType = this.mapContextType(post);
        const contextData = this.buildContextDataFromPost(post, ownedProductIds);
        // Get images for this post from PostMedia (orderIndex'e göre sıralı)
        const images = postMediaMap.get(post.id) || [];
        return {
          id: String(post.id),
          type: 'post' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          contextData,
          content: post.body,
          images,
        };
      })
    );
    return results;
  }

  async getUserUpdates(
    userId: string,
    options?: { limit?: number }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 100;

    const posts = await this.prisma.contentPost.findMany({
      where: { userId, type: 'UPDATE' } as any,
      include: {
        product: {
          include: {
            group: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
          },
        },
        productGroup: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
        subCategory: {
          include: {
            mainCategory: true,
          },
        },
        mainCategory: true,
        likes: true,
        comments: true,
        favorites: true,
      } as any,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const userBase = await this.getUserBase(userId);

    // Batch fetch images from PostMedia (orderIndex'e göre sıralı)
    const postIds = posts.map((p) => p.id);
    const postMediaMap = new Map<string, string[]>();
    const ownedProductIds = new Set<string>();
    
    if (postIds.length > 0) {
      const allPostMedia = await this.prisma.postMedia.findMany({
        where: {
          postId: { in: postIds },
        },
        orderBy: { orderIndex: 'asc' }, // Kullanıcının yüklediği sırada
        select: { postId: true, mediaUrl: true },
      });

      // Map'e dönüştür (postId -> mediaUrl array)
      allPostMedia.forEach((media) => {
        if (!postMediaMap.has(media.postId)) {
          postMediaMap.set(media.postId, []);
        }
        const resolvedUrl = resolveMediaUrl(media.mediaUrl);
        if (resolvedUrl) {
          postMediaMap.get(media.postId)!.push(resolvedUrl);
        }
      });
    }

    // Owned products için inventory kontrolü
    const postProductIds = posts.map((p) => p.productId).filter(Boolean) as string[];
    if (postProductIds.length > 0) {
      const inventories = await this.prisma.inventory.findMany({
        where: {
          userId,
          productId: { in: postProductIds },
        },
        select: { productId: true },
      });
      inventories.forEach((inv) => {
        ownedProductIds.add(String(inv.productId));
      });
    }
    
    const results = await Promise.all(
      posts.map(async (post) => {
        const stats = await this.getPostStats(post.id);
        const contextType = this.mapContextType(post);
        const contextData = this.buildContextDataFromPost(post, ownedProductIds);
        // Get images for this post from PostMedia (orderIndex'e göre sıralı)
        const images = postMediaMap.get(post.id) || [];
        const productBase = contextData
          ? {
              id: contextData.id,
              name: contextData.name,
              subName: contextData.subName || '',
              image: contextData.image,
              isOwned: contextData.isOwned,
            }
          : null;

        const relatedPost = {
          id: String(post.id),
          product: productBase,
          content: this.buildUpdateContentFromBody(post.body),
          tags: await this.collectProductTags(String(post.productId || '')),
          images,
        };

        return {
          id: String(post.id),
          type: 'update' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          contextData,
          relatedPost,
          content: post.body,
          images,
        };
      })
    );

    const hasMore = results.length > limit;
    const paginatedResults = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && paginatedResults.length > 0 ? paginatedResults[paginatedResults.length - 1].id : undefined;

    return {
      items: paginatedResults,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getUserReviews(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor =
      options?.cursor && /^[0-9a-fA-F-]{36}$/.test(options.cursor) ? options.cursor : undefined;

    // Cursor dış ID = inventory.id (en son dönen item)
    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            group: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
          },
        },
        productExperiences: true,
        media: true,
      } as any,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const userBase = await this.getUserBase(userId);

    const results: any[] = [];

    for (const inv of inventories) {
      const experiences = this.buildExperienceSections(
        ((inv as any).productExperiences || []) as Array<{
          title: string;
          experienceText: string;
        }>,
        (inv as any).experienceSummary ?? null,
      );

      const tags = await this.collectProductTags(String(inv.productId));
      const images = ((inv as any).media || [])
        .map((m: any) => {
          const mediaUrl = m.mediaUrl;
          // Eğer zaten tam URL ise olduğu gibi kullan, değilse prefix ekle
          if (mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
            return mediaUrl;
          } else if (mediaUrl) {
            return resolveMediaUrl(mediaUrl);
          }
          return null;
        })
        .filter((url: string | null) => url !== null); // null değerleri filtrele

      const contextData = this.buildContextDataFromInventory(inv as any);

      results.push({
        id: String(inv.id),
        type: 'experience' as const,
          user: userBase,
        stats: this.buildExperienceStats(String(inv.id)),
        createdAt: inv.createdAt.toISOString(),
        contextType: ContextType.PRODUCT,
        contextData,
        content: experiences,
        tags,
        images,
      });
    }

    const hasMore = results.length > limit;
    const paginatedResults = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && paginatedResults.length > 0 ? paginatedResults[paginatedResults.length - 1].id : undefined;

    return {
      items: paginatedResults,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  private buildExperienceSections(
    experiences: Array<{ title: string; experienceText: string }>,
    summary?: string | null,
  ): ExperienceContent[] {
    const sections: {
      price: ExperienceContent | null;
      usage: ExperienceContent | null;
    } = {
      price: null,
      usage: null,
    };

    for (const exp of experiences) {
      const normalizedTitle = (exp.title || '').toLowerCase();
      if (!sections.price && normalizedTitle.includes('price')) {
        sections.price = {
          title: EXPERIENCE_SECTION_TITLES.PRICE,
          content: exp.experienceText,
          rating: this.calculateExperienceRating(exp.experienceText + '-price'),
        };
        continue;
      }

      if (
        !sections.usage &&
        (normalizedTitle.includes('product') || normalizedTitle.includes('usage'))
      ) {
        sections.usage = {
          title: EXPERIENCE_SECTION_TITLES.USAGE,
          content: exp.experienceText,
          rating: this.calculateExperienceRating(exp.experienceText + '-usage'),
        };
      }
    }

    const fallbackText =
      summary || experiences[0]?.experienceText || 'Experience details not provided.';

    if (!sections.price) {
      sections.price = {
        title: EXPERIENCE_SECTION_TITLES.PRICE,
        content: fallbackText,
        rating: this.calculateExperienceRating(fallbackText + '-price'),
      };
    }

    if (!sections.usage) {
      const usageText = experiences[1]?.experienceText || fallbackText;
      sections.usage = {
        title: EXPERIENCE_SECTION_TITLES.USAGE,
        content: usageText,
        rating: this.calculateExperienceRating(usageText + '-usage'),
      };
    }

    return [sections.price, sections.usage].filter(
      (section): section is ExperienceContent => section !== null,
    );
  }

  private buildUpdateContentFromBody(body: string | null | undefined): ExperienceContent[] {
    const contentText = body || '';
    return [
      {
        title: EXPERIENCE_SECTION_TITLES.USAGE,
        content: contentText,
        rating: 0,
      },
    ];
  }

  async getUserBenchmarks(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const whereClause: any = { userId, type: 'COMPARE' };
    if (cursor) {
      whereClause.id = { lt: cursor };
    }

    const posts = await this.prisma.contentPost.findMany({
      where: whereClause,
      include: {
        comparison: {
          include: {
            product1: true,
            product2: true,
            scores: true,
          },
        },
      } as any,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const userBase = await this.getUserBase(userId);
    const inventories = await this.prisma.inventory.findMany({
      where: { userId } as any,
      select: { productId: true },
    });
    const ownedSet = new Set(inventories.map((i) => String(i.productId)));

    const filteredPosts = posts.filter((p) => (p as any).comparison);
    const hasMore = filteredPosts.length > limit;
    const paginatedPosts = hasMore ? filteredPosts.slice(0, limit) : filteredPosts;

    const results = await Promise.all(
      paginatedPosts.map(async (post) => {
        const comp = (post as any).comparison!;
        const stats = await this.getPostStats(String(post.id));
        const choiceProductId = this.selectComparisonWinner(comp);
        return {
          id: String(post.id),
          type: 'benchmark' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType: this.mapContextType(post),
          products: [
            {
              ...(await this.getProductBase(String(comp.product1Id)))!,
              isOwned: ownedSet.has(String(comp.product1Id)),
              choice: choiceProductId
                ? choiceProductId === String(comp.product1Id)
                : true,
            },
            {
              ...(await this.getProductBase(String(comp.product2Id)))!,
              isOwned: ownedSet.has(String(comp.product2Id)),
              choice: choiceProductId
                ? choiceProductId === String(comp.product2Id)
                : false,
            },
          ],
          content: post.body,
        };
      })
    );

    const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : undefined;

    return {
      items: results,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  private selectComparisonWinner(
    comparison: {
      product1Id: string;
      product2Id: string;
      scores?: Array<{ scoreProduct1?: number | null; scoreProduct2?: number | null }>;
    } | null,
  ): string | null {
    if (!comparison || !comparison.scores || comparison.scores.length === 0) {
      return null;
    }

    let product1Score = 0;
    let product2Score = 0;

    for (const score of comparison.scores) {
      product1Score += score.scoreProduct1 ?? 0;
      product2Score += score.scoreProduct2 ?? 0;
    }

    if (product1Score === product2Score) {
      return String(comparison.product1Id);
    }

    return product1Score > product2Score
      ? String(comparison.product1Id)
      : String(comparison.product2Id);
  }

  async getUserTips(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const whereClause: any = { userId, type: 'TIPS' };
    if (cursor) {
      whereClause.id = { lt: cursor };
    }

    const posts = await this.prisma.contentPost.findMany({
      where: whereClause,
      include: {
        tip: true,
        product: {
          include: {
            group: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
          },
        },
        productGroup: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
        subCategory: {
          include: {
            mainCategory: true,
          },
        },
        mainCategory: true,
      } as any,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const userBase = await this.getUserBase(userId);
    const ownedProducts = await this.prisma.inventory.findMany({
      where: { userId } as any,
      select: { productId: true },
    });
    const ownedProductIds = new Set(ownedProducts.map((inv) => String(inv.productId)));

    const results = await Promise.all(
      posts.map(async (post) => {
        const stats = await this.getPostStats(String(post.id));
        const contextType = this.mapContextType(post);
        const contextData = this.buildContextDataFromPost(post, ownedProductIds);
        const tags = await this.prisma.postTag.findMany({ where: { postId: String(post.id) } as any });
        return {
          id: String(post.id),
          type: 'tipsAndTricks' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          contextData,
          content: post.body,
          tag: tags[0]?.tag || '',
          images: [], // TODO: InventoryMedia
        };
      })
    );

    const hasMore = results.length > limit;
    const paginatedResults = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && paginatedResults.length > 0 ? paginatedResults[paginatedResults.length - 1].id : undefined;

    return {
      items: paginatedResults,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getUserReplies(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor || undefined;

    const comments = await this.prisma.contentComment.findMany({
      where: {
        userId,
        post: {
          type: 'QUESTION',
        },
      },
      include: {
        post: {
          include: {
            product: {
              include: {
                group: {
                  include: {
                    subCategory: {
                      include: {
                        mainCategory: true,
                      },
                    },
                  },
                },
              },
            },
            productGroup: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
            mainCategory: true,
          },
        },
      } as any,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const userBase = await this.getUserBase(userId);
    const ownedProducts = await this.prisma.inventory.findMany({
      where: { userId } as any,
      select: { productId: true },
    });
    const ownedProductIds = new Set(ownedProducts.map((inv) => String(inv.productId)));

    const results = await Promise.all(
      comments.map(async (comment) => {
        const stats = await this.getPostStats(String(comment.postId));
        const commentPost = (comment as any).post;
        const contextType = this.mapContextType(commentPost);
        const contextData = this.buildContextDataFromPost(commentPost, ownedProductIds);
        return {
          id: String(comment.id),
          type: 'question' as const,
          user: userBase,
          stats,
          createdAt: comment.createdAt.toISOString(),
          contextType,
          contextData,
          content: comment.comment,
          isBoosted: false, // TODO: Post'tan alınacak
          images: [], // TODO
        };
      })
    );

    const hasMore = results.length > limit;
    const paginatedResults = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && paginatedResults.length > 0 ? paginatedResults[paginatedResults.length - 1].id : undefined;

    return {
      items: paginatedResults,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getUserLadderBadges(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor =
      options?.cursor && /^[0-9a-fA-F-]{36}$/.test(options.cursor) ? options.cursor : undefined;

    const [userBadges, totalUsers] = await Promise.all([
      this.prisma.userBadge.findMany({
        where: { userId },
        include: {
          badge: {
            include: {
              achievementGoals: {
                include: {
                  userAchievements: {
                    where: { userId },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { claimed: 'desc' },
          { displayOrder: 'asc' },
          { claimedAt: 'asc' },
          { id: 'asc' },
        ],
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      }),
      this.prisma.user.count(),
    ]);

    const badgeIds = Array.from(new Set(userBadges.map((ub) => ub.badgeId))).filter(Boolean);
    const claimedCounts = badgeIds.length
      ? await this.prisma.userBadge.groupBy({
          by: ['badgeId'],
          where: {
            badgeId: { in: badgeIds },
            claimed: true,
          },
          _count: {
            badgeId: true,
          },
        })
      : [];
    const claimedCountMap = new Map<string, number>(
      claimedCounts.map((entry) => [entry.badgeId, entry._count.badgeId]),
    );

    const rarityMap: Record<string, 'Usual' | 'Rare'> = {
      COMMON: 'Usual',
      RARE: 'Rare',
      EPIC: 'Rare',
    };

    const hasMore = userBadges.length > limit;
    const paginatedBadges = hasMore ? userBadges.slice(0, limit) : userBadges;

    const items = paginatedBadges.map((ub) => {
      const badge = ub.badge as any;
      const tasks = this.buildBadgeTasks(badge);
      const currentProgress = tasks.reduce(
        (sum, task) => sum + Math.min(task.current, task.total),
        0,
      );
      const totalProgress = tasks.reduce((sum, task) => sum + task.total, 0);
      const totalEarned = claimedCountMap.get(ub.badgeId) ?? 0;
      const totalPercentage =
        totalUsers > 0
          ? Number(((totalEarned / totalUsers) * 100).toFixed(2))
          : 0;

      return {
        id: String(badge?.id || ''),
        image: this.resolveBadgeImage(badge),
        title: badge?.name || '',
        description: badge?.description || '',
        rarity: rarityMap[badge?.rarity || 'COMMON'] || 'Usual',
        isClaimed: ub.claimed,
        nftAddress: ub.claimed ? this.buildNftAddress(badge?.id, ub.id) : null,
        totalEarned,
        totalPercentage,
        current: currentProgress,
        total: totalProgress,
        tasks,
      };
    });

    const nextCursor =
      hasMore && paginatedBadges.length > 0 ? String(paginatedBadges[paginatedBadges.length - 1].id) : undefined;

    return {
      items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getUserBookmarks(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    // Cursor olarak öncelik: UUID favorite.id, değilse postId ile favorite id'yi çözmeye çalış
    let favoriteCursorId: string | undefined;
    if (options?.cursor) {
      if (/^[0-9a-fA-F-]{36}$/.test(options.cursor)) {
        favoriteCursorId = options.cursor;
      } else {
        const fav = await this.prisma.contentFavorite.findFirst({
          where: { userId, postId: options.cursor },
          select: { id: true },
        });
        favoriteCursorId = fav?.id;
      }
    }

    // Bookmarks = Kullanıcının favorite ettiği post'lar (tüm tiplerde)
    const favorites = await this.prisma.contentFavorite.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            product: {
              include: {
                group: {
                  include: {
                    subCategory: {
                      include: {
                        mainCategory: true,
                      },
                    },
                  },
                },
              },
            },
            productGroup: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
            mainCategory: true,
            comparison: { include: { product1: true, product2: true } } as any,
            tip: true,
            question: true,
          },
        },
      } as any,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(favoriteCursorId && {
        cursor: { id: favoriteCursorId },
        skip: 1,
      }),
    });

    // Post'lardaki unique userId'leri topla
    const postUserIds = [...new Set(favorites.map((f) => String((f as any).post?.userId)).filter(Boolean))];

    // User bilgilerini toplu çek
    const users = await Promise.all(
      postUserIds.map(async (uid) => {
        const [profile, avatar, title] = await Promise.all([
          this.profileRepo.findByUserId(uid as unknown as string), // uid tek başına hata veriyor
          this.prisma.userAvatar.findFirst({ where: { userId: uid, isActive: true } as any }),
          this.prisma.userTitle.findFirst({ where: { userId: uid } as any, orderBy: { earnedAt: 'desc' } }),
        ]);
        return {
          userId: uid,
          userBase: {
            id: uid,
            name: profile?.displayName || 'Anonymous',
            title: title?.title || '',
            avatar: resolveMediaUrl(avatar?.imageUrl ?? null) || '',
          },
        };
      })
    );

    const userBaseMap = new Map(users.map((u) => [u.userId, u.userBase]));

    // User'ın sahip olduğu product'ları çek (benchmark için)
    const inventories = await this.prisma.inventory.findMany({
      where: { userId } as any,
      select: { productId: true },
    });
    const ownedSet = new Set(inventories.map((i) => String(i.productId)));

    const hasMoreFavorites = favorites.length > limit;
    const paginatedFavorites = hasMoreFavorites ? favorites.slice(0, limit) : favorites;

    const results: any[] = [];

    for (const fav of paginatedFavorites) {
      const post = (fav as any).post;
      if (!post) continue;

      const postUserId = String(post.userId);
      const userBase = userBaseMap.get(postUserId) || {
        id: postUserId,
        name: 'Anonymous',
        title: '',
        avatar: '',
      };

      const stats = await this.getPostStats(String(post.id));

      const contextType = this.mapContextType(post);
      const contextData = this.buildContextDataFromPost(post, ownedSet);

      // Post type'ına göre formatla
      switch (post.type) {
        case 'FREE': {
          // FREE -> "post" veya "feed" tipi
          results.push({
            id: String(post.id),
            type: 'post' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            contextType,
            contextData,
            content: post.body,
            images: [], // TODO: InventoryMedia
          });
          break;
        }

        case 'COMPARE': {
          // COMPARE -> "benchmark" tipi
          const comp = (post as any).comparison;
          if (!comp) break;

          results.push({
            id: String(post.id),
            type: 'benchmark' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            contextType: this.mapContextType(post),
            products: [
              {
                ...(await this.getProductBase(String(comp.product1Id)))!,
                isOwned: ownedSet.has(String(comp.product1Id)),
                choice: false, // TODO: Comparison score'dan çıkarılacak
              },
              {
                ...(await this.getProductBase(String(comp.product2Id)))!,
                isOwned: ownedSet.has(String(comp.product2Id)),
                choice: false,
              },
            ],
            content: post.body,
          });
          break;
        }

        case 'TIPS': {
          // TIPS -> "tipsAndTricks" tipi
          const tags = await this.prisma.postTag.findMany({ where: { postId: String(post.id) } as any });
          results.push({
            id: String(post.id),
            type: 'tipsAndTricks' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            contextType,
            contextData,
            content: post.body,
            tag: tags[0]?.tag || '',
            images: [], // TODO: InventoryMedia
          });
          break;
        }

        case 'QUESTION': {
          // QUESTION -> "question" tipi
          const question = (post as any).question;
          results.push({
            id: String(post.id),
            type: 'question' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            contextType,
            contextData,
            content: post.body,
            expectedAnswerFormat: question?.expectedAnswerFormat || 'short',
            images: [], // TODO
          });
          break;
        }

        default: {
          // Unknown type -> "post" olarak döndür
          results.push({
            id: String(post.id),
            type: 'post' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            contextType,
            contextData,
            content: post.body,
            images: [],
          });
        }
      }
      }

    const hasMoreResults = favorites.length > limit;
    const paginatedResults = hasMoreResults ? results.slice(0, limit) : results;
    // Dış cursor olarak postId döndür (favorite.id yerine)
    const nextCursor =
      hasMoreFavorites && paginatedFavorites.length > 0
        ? String(paginatedFavorites[paginatedFavorites.length - 1].postId)
        : undefined;

    return {
      items: paginatedResults,
      pagination: {
        cursor: nextCursor,
        hasMore: hasMoreResults,
        limit,
      },
    };
  }

  private buildBadgeTasks(
    badge?: {
      achievementGoals?: Array<{
        id: string;
        title: string;
        difficulty?: string | null;
        pointsRequired: number;
        userAchievements?: Array<{ progress: number }>;
      }>;
    },
  ): Array<{ id: string; type: string; title: string; current: number; total: number }> {
    if (!badge?.achievementGoals?.length) {
      return [];
    }

    return badge.achievementGoals.map((goal) => {
      const progressEntry = goal.userAchievements?.[0];
      return {
        id: String(goal.id),
        type: (goal.difficulty || 'standard').toString().toLowerCase(),
        title: goal.title,
        current: progressEntry?.progress ?? 0,
        total: goal.pointsRequired,
      };
    });
  }

  private resolveBadgeImage(badge?: { imageUrl?: string | null }): string {
    if (!badge?.imageUrl) {
      // Default badge görseli için resolveMediaUrl kullan
      return resolveMediaUrl(DEFAULT_BADGE_IMAGE_PATH) || DEFAULT_BADGE_IMAGE_PATH;
    }

    // resolveMediaUrl kullanarak prefix ekle
    return resolveMediaUrl(badge.imageUrl) || DEFAULT_BADGE_IMAGE_PATH;
  }

  private buildNftAddress(badgeId?: string | null, userBadgeId?: string): string {
    return `badge://${badgeId || userBadgeId || ''}`;
  }

  private buildContextDataFromInventory(inventory: any) {
    const product = inventory.product;
    if (!product) {
      return {
        id: String(inventory.productId),
        name: 'Unknown Product',
        subName: '',
        image: null,
        isOwned: inventory.hasOwned,
      };
    }

    const group = product.group;
    const subCategory = group?.subCategory;
    const mainCategory = subCategory?.mainCategory;

    // Image URL'ini bul ve prefix ekle
    const imagePath = product.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;
    let imageUrl: string | null = null;
    
    if (imagePath) {
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        imageUrl = imagePath;
      } else {
        imageUrl = resolveMediaUrl(imagePath);
      }
    }

    return {
      id: String(product.id),
      name: product.name,
      subName: product.brand || group?.name || subCategory?.name || mainCategory?.name || '',
      image: imageUrl,
      isOwned: !!inventory.hasOwned,
    };
  }

  private async collectProductTags(productId: string): Promise<string[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { productId } as any,
      select: { id: true },
    });
    if (!posts.length) {
      return [];
    }

    const tags = await this.prisma.contentPostTag.findMany({
      where: { postId: { in: posts.map((p) => String(p.id)) } } as any,
    });

    return tags.map((t) => t.tag);
  }

  private buildExperienceStats(seed: string): BasicStats {
    const hash = this.generateDeterministicNumber(seed);
    return {
      likes: 30 + (hash % 40),
      comments: 6 + (hash % 10),
      shares: 2 + (hash % 5),
      bookmarks: 4 + (hash % 7),
    };
  }

  private calculateExperienceRating(seed: string): number {
    const hash = this.generateDeterministicNumber(seed);
    const rating = (hash % 3) + 3; // range 3-5
    return Math.min(5, Math.max(1, rating));
  }

  private generateDeterministicNumber(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async getUserProfileFeed(
    userId: string,
    options?: {
      limit?: number;
      cursor?: string;
      types?: ProfileFeedCardType[];
    }
  ): Promise<{ items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;
    const requestedTypes = options?.types?.length
      ? Array.from(new Set(options.types))
      : PROFILE_FEED_CARD_TYPES;

    // Her kaynak için limit+1 çekiyoruz ki hasMore hesaplanabilsin
    const perSourceLimit = limit + 1;

    const fetchers = requestedTypes.map((cardType) => {
      switch (cardType) {
        case 'feed':
          return this.getUserReviews(userId, { limit: perSourceLimit });
        case 'benchmark':
          return this.getUserBenchmarks(userId, { limit: perSourceLimit });
        case 'tipsAndTricks':
          return this.getUserTips(userId, { limit: perSourceLimit });
        case 'question':
          return this.getUserReplies(userId, { limit: perSourceLimit });
        case 'experience':
          return this.getUserReviews(userId, { limit: perSourceLimit });
        case 'update':
          return this.getUserUpdates(userId, { limit: perSourceLimit });
        case 'post':
        default:
          return this.getUserPosts(userId);
      }
    });

    const chunks = await Promise.all(fetchers);
    const merged = chunks.flatMap((chunk: any) => chunk?.items || chunk || []);

    const resolveTimestamp = (item: any): number => {
      const value = item?.createdAt;
      return value ? new Date(value).getTime() : 0;
    };

    const sortKey = (item: any) => ({
      time: resolveTimestamp(item),
      id: String(item?.id ?? ''),
    });

    merged.sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (ka.time !== kb.time) return kb.time - ka.time; // desc
      return kb.id.localeCompare(ka.id); // tie-break desc
    });

    let startIndex = 0;
    if (cursor) {
      const idx = merged.findIndex((item) => String(item?.id) === cursor);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const slice = merged.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    const paginated = hasMore ? slice.slice(0, limit) : slice;
    const nextCursor = hasMore && paginated.length > 0 ? String(paginated[paginated.length - 1].id) : undefined;

    return {
      items: paginated,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Batch endpoint: Profile card + tab verilerini tek istekte döner
   * Performance optimizasyonu için: İlk ekran için gerekli tüm verileri tek seferde getirir
   */
  async getUserProfileData(
    userId: string,
    options?: {
      includeProfileCard?: boolean;
      includeTabs?: Array<'feed' | 'reviews' | 'benchmarks' | 'tips' | 'replies' | 'ladder'>;
      limit?: number;
    }
  ): Promise<{
    profileCard: any | null;
    tabs: {
      feed?: any[];
      reviews?: any[];
      benchmarks?: any[];
      tips?: any[];
      replies?: any[];
      ladder?: any[];
    };
    meta: {
      cached: boolean;
      timestamp: string;
    };
  }> {
    const {
      includeProfileCard = true,
      includeTabs = ['feed'], // Default: sadece feed tab
      limit = 20,
    } = options || {};

    // Cache check
    const cacheKey = `user:${userId}:profile:${includeTabs.join(',')}`;
    try {
      const cached = (await this.cacheService.get(cacheKey)) as any;
      if (cached && cached.profileCard !== undefined && cached.tabs !== undefined) {
        return {
          ...cached,
          meta: { ...(cached.meta || {}), cached: true, timestamp: cached.meta?.timestamp || new Date().toISOString() },
        };
      }
    } catch {
      // Cache error - continue without cache
    }

    // Parallel data fetching
    const promises: Promise<any>[] = [];

    if (includeProfileCard) {
      promises.push(this.getUserProfileCard(userId));
    }

    const tabPromises: Promise<any[] | { items: any[]; pagination: { cursor?: string; hasMore: boolean; limit: number } }>[] = [];
    if (includeTabs.includes('feed')) {
      tabPromises.push(this.getUserProfileFeed(userId, { limit }));
    }
    if (includeTabs.includes('reviews')) {
      tabPromises.push(this.getUserReviews(userId, { limit }));
    }
    if (includeTabs.includes('benchmarks')) {
      tabPromises.push(this.getUserBenchmarks(userId, { limit }));
    }
    if (includeTabs.includes('tips')) {
      tabPromises.push(this.getUserTips(userId, { limit }));
    }
    if (includeTabs.includes('replies')) {
      tabPromises.push(this.getUserReplies(userId, { limit }));
    }
    if (includeTabs.includes('ladder')) {
      tabPromises.push(this.getUserLadderBadges(userId, { limit }));
    }

    promises.push(...tabPromises);

    const results = await Promise.all(promises);

    let tabIndex = includeProfileCard ? 1 : 0;
    const response = {
      profileCard: includeProfileCard ? results[0] : null,
      tabs: {
        feed: includeTabs.includes('feed')
          ? ((results[tabIndex]?.items || results[tabIndex] || []) as any[]).slice(0, limit)
          : undefined,
        reviews: includeTabs.includes('reviews')
          ? ((results[tabIndex++]?.items || results[tabIndex - 1] || []) as any[]).slice(0, limit)
          : undefined,
        benchmarks: includeTabs.includes('benchmarks')
          ? ((results[tabIndex++]?.items || results[tabIndex - 1] || []) as any[]).slice(0, limit)
          : undefined,
        tips: includeTabs.includes('tips')
          ? ((results[tabIndex++]?.items || results[tabIndex - 1] || []) as any[]).slice(0, limit)
          : undefined,
        replies: includeTabs.includes('replies')
          ? ((results[tabIndex++]?.items || results[tabIndex - 1] || []) as any[]).slice(0, limit)
          : undefined,
        ladder: includeTabs.includes('ladder')
          ? ((results[tabIndex++]?.items || results[tabIndex - 1] || []) as any[]).slice(0, limit)
          : undefined,
      },
      meta: {
        cached: false,
        timestamp: new Date().toISOString(),
      },
    };

    // Cache for 5 minutes (profileCard için daha uzun, tab verileri için kısa)
    try {
      await this.cacheService.set(cacheKey, response, 300);
    } catch {
      // Cache error - continue
    }

    return response;
  }

  /**
   * Kullanıcı profil fotoğrafı yükleme için pre-signed URL oluşturur
   * @param userId - Kullanıcı ID'si
   * @param fileName - Yüklenecek dosya adı
   * @param fileType - Dosya tipi (MIME type)
   * @returns Pre-signed URL ve dosya bilgileri
   */
  async updateUserProfilePicture(userId: string, fileName: string, fileType: string): Promise<{
    uploadUrl: string;
    fileUrl: string;
  }> {
    // Dosya adını kullanıcı ID'si ile prefix'leyerek benzersiz hale getir
    const uniqueFileName = `profile-pictures/${userId}/${fileName}`;
    
    // Pre-signed URL oluştur
    const uploadUrl = await this.s3Service.generatePresignedUploadUrl(uniqueFileName, fileType);
    
    // Dosya yüklendikten sonra erişilecek nihai URL
    // Format: ${S3_ENDPOINT}/${S3_BUCKET_NAME}/${fileName}
    const fileUrl = this.s3Service.getFileUrl(uniqueFileName);
    
    return {
      uploadUrl,
      fileUrl,
    };
  }

  /**
   * Kullanıcı profilini tamamlar (Set Up Profile)
   * @param userId - Kullanıcı ID'si
   * @param data - Profil verileri
   * @returns Güncellenmiş kullanıcı profili
   */
  async setupProfile(
    userId: string,
    data: {
      fullName: string;
      userName: string;
      avatar?: string;
      bannerUrl?: string;
      selectedCategories?: Array<{
        categoryId: string;
        subCategoryIds: string[];
      }>;
    }
  ): Promise<User> {
    // Kullanıcının var olup olmadığını kontrol et
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Email doğrulaması kontrolü
    if (!user.emailVerified) {
      throw new Error('Email doğrulanmamış. Lütfen önce email adresinizi doğrulayın.');
    }

    // Username benzersizlik kontrolü
    const existingProfile = await this.profileRepo.findByUserName(data.userName);
    if (existingProfile && existingProfile.userId !== userId) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor');
    }

    // Transaction içinde tüm işlemleri gerçekleştir
    return await this.prisma.$transaction(async (tx) => {
      // Profile'ı güncelle veya oluştur
      const existingProfile = await tx.profile.findUnique({ where: { userId } });
      
      if (existingProfile) {
        await tx.profile.update({
          where: { userId },
          data: {
            displayName: data.fullName,
            userName: data.userName,
            ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
          },
        });
      } else {
        await tx.profile.create({
          data: {
            userId,
            displayName: data.fullName,
            userName: data.userName,
            ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
          },
        });
      }

      // Avatar varsa kaydet
      if (data.avatar) {
        // Önceki aktif avatar'ı pasif yap
        await tx.userAvatar.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });

        // Yeni avatar'ı aktif olarak kaydet
        await tx.userAvatar.create({
          data: {
            userId,
            imageUrl: data.avatar,
            isActive: true,
          },
        });
      }

      // Kategori tercihlerini kaydet
      if (data.selectedCategories && data.selectedCategories.length > 0) {
        const categoriesJson = JSON.stringify(data.selectedCategories);
        
        const existingPreferences = await tx.userFeedPreferences.findUnique({
          where: { userId },
        });

        if (existingPreferences) {
          await tx.userFeedPreferences.update({
            where: { userId },
            data: {
              preferredCategories: categoriesJson,
            },
          });
        } else {
          await tx.userFeedPreferences.create({
            data: {
              userId,
              preferredCategories: categoriesJson,
            },
          });
        }
      }

      // Kullanıcı durumunu ACTIVE yap
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
        },
      });

      // Cache'i temizle
      const cacheKey = `user:${userId}:profile`;
      await this.cacheService.del(cacheKey);

      // Güncellenmiş kullanıcıyı döndür
      const updatedUser = await this.userRepo.findById(userId);
      if (!updatedUser) {
        throw new Error('Kullanıcı güncellenemedi');
      }

      logger.info({
        message: 'User profile setup completed',
        userId,
        userName: data.userName,
      });

      return updatedUser;
    });
  }

  // ===== SETTINGS METHODS =====

  /**
   * Change Password - Kullanıcının şifresini değiştirir
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user || !user.passwordHash) {
        return {
          success: false,
          message: 'User not found or password not set',
        };
      }

      // Mevcut şifreyi kontrol et
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Current password is incorrect',
        };
      }

      // Yeni şifre validasyonu
      if (!newPassword || newPassword.length < 6) {
        return {
          success: false,
          message: 'New password must be at least 6 characters',
        };
      }

      // Yeni şifreyi hash'le ve güncelle
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await this.userRepo.update(userId, { passwordHash: newPasswordHash });

      logger.info({
        message: 'Password changed successfully',
        userId,
      });

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error changing password',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to change password',
      };
    }
  }

  /**
   * Get Notification Settings - Kullanıcının bildirim ayarlarını getirir
   */
  async getNotificationSettings(userId: string): Promise<
    Array<{
      notificationCode: NotificationCode;
      value: boolean;
    }>
  > {
    let settings = await this.settingsRepo.findByUserId(userId);
    if (!settings) {
      // Default settings oluştur
      settings = await this.settingsRepo.create(userId);
    }

    return [
      {
        notificationCode: NotificationCode.EMAIL,
        value: settings.getNotificationValue(NotificationCode.EMAIL),
      },
      {
        notificationCode: NotificationCode.PUSH,
        value: settings.getNotificationValue(NotificationCode.PUSH),
      },
      {
        notificationCode: NotificationCode.IN_APP,
        value: settings.getNotificationValue(NotificationCode.IN_APP),
      },
    ];
  }

  /**
   * Update Notification Settings - Kullanıcının bildirim ayarlarını günceller
   */
  async updateNotificationSettings(
    userId: string,
    settings: Array<{
      notificationCode: NotificationCode;
      value: boolean;
    }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      let userSettings = await this.settingsRepo.findByUserId(userId);
      if (!userSettings) {
        userSettings = await this.settingsRepo.create(userId);
      }

      const updateData: {
        notificationEmailEnabled?: boolean;
        notificationPushEnabled?: boolean;
        notificationInAppEnabled?: boolean;
      } = {};

      for (const setting of settings) {
        switch (setting.notificationCode) {
          case NotificationCode.EMAIL:
            updateData.notificationEmailEnabled = setting.value;
            break;
          case NotificationCode.PUSH:
            updateData.notificationPushEnabled = setting.value;
            break;
          case NotificationCode.IN_APP:
            updateData.notificationInAppEnabled = setting.value;
            break;
        }
      }

      await this.settingsRepo.updateByUserId(userId, updateData);

      logger.info({
        message: 'Notification settings updated',
        userId,
      });

      return {
        success: true,
        message: 'Notification settings updated successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error updating notification settings',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to update notification settings',
      };
    }
  }

  /**
   * Get Privacy Settings - Kullanıcının gizlilik ayarlarını getirir
   */
  async getPrivacySettings(userId: string): Promise<
    Array<{
      privacyCode: PrivacyCode;
      selectedValue: string;
    }>
  > {
    const settings = await this.privacySettingRepo.findByUserId(userId);

    // Default değerler
    const defaultValues: Record<PrivacyCode, string> = {
      [PrivacyCode.NFT_BADGE_COLLECTIONS]: 'trust-only',
      [PrivacyCode.TRUST_TRUSTER_LIST]: 'everyone',
      [PrivacyCode.ONE_ON_ONE_SUPPORT]: 'everyone',
    };

    const result: Array<{
      privacyCode: PrivacyCode;
      selectedValue: string;
    }> = [];

    for (const privacyCode of Object.values(PrivacyCode) as PrivacyCode[]) {
      const setting = settings.find((s: any) => s.privacyCode === privacyCode);
      result.push({
        privacyCode,
        selectedValue: setting?.selectedValue || defaultValues[privacyCode],
      });
    }

    return result;
  }

  /**
   * Update Privacy Settings - Kullanıcının gizlilik ayarlarını günceller
   */
  async updatePrivacySettings(
    userId: string,
    settings: Array<{
      privacyCode: PrivacyCode;
      selectedValue: string;
    }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      for (const setting of settings) {
        await this.privacySettingRepo.upsert(
          userId,
          setting.privacyCode,
          setting.selectedValue
        );
      }

      logger.info({
        message: 'Privacy settings updated',
        userId,
      });

      return {
        success: true,
        message: 'Privacy settings updated successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error updating privacy settings',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to update privacy settings',
      };
    }
  }

  /**
   * Get Support Session Price - Destek oturumu fiyatını getirir
   */
  async getSupportSessionPrice(userId: string): Promise<number | null> {
    const settings = await this.settingsRepo.findByUserId(userId);
    return settings?.getSupportSessionPrice() || null;
  }

  /**
   * Update Support Session Price - Destek oturumu fiyatını günceller
   */
  async updateSupportSessionPrice(
    userId: string,
    price: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Minimum 50 TIPS kontrolü
      if (price < 50) {
        return {
          success: false,
          message: 'Minimum 50 TIPS can be set',
        };
      }

      let settings = await this.settingsRepo.findByUserId(userId);
      if (!settings) {
        settings = await this.settingsRepo.create(userId);
      }

      // 10 günde bir değiştirilebilir kontrolü
      if (!settings.canUpdateSupportSessionPrice()) {
        return {
          success: false,
          message: 'The amount can be changed once every 10 days',
        };
      }

      await this.settingsRepo.updateByUserId(userId, {
        supportSessionPrice: price,
        supportSessionPriceUpdatedAt: new Date(),
      });

      logger.info({
        message: 'Support session price updated',
        userId,
        price,
      });

      return {
        success: true,
        message: 'Support session price updated successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error updating support session price',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to update support session price',
      };
    }
  }

  /**
   * Get Connected Devices - Bağlı cihazları getirir
   */
  async getConnectedDevices(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      location: string | null;
      date: string;
      isActive: boolean;
    }>
  > {
    const devices = await this.deviceRepo.findByUserId(userId);
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      location: device.location,
      date: device.getDisplayDate().toISOString(),
      isActive: device.isActive,
    }));
  }

  /**
   * Remove Device - Bağlı cihazı listeden kaldırır
   */
  async removeDevice(
    userId: string,
    deviceId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const device = await this.deviceRepo.findById(deviceId);
      if (!device || device.userId !== userId) {
        return {
          success: false,
          message: 'Device not found',
        };
      }

      await this.deviceRepo.delete(deviceId);

      logger.info({
        message: 'Device removed',
        userId,
        deviceId,
      });

      return {
        success: true,
        message: 'Device removed successfully',
      };
    } catch (error) {
      logger.error({
        message: 'Error removing device',
        userId,
        deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to remove device',
      };
    }
  }

  /**
   * Remove All Devices - Tüm cihazları listeden kaldırır
   */
  async removeAllDevices(userId: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const count = await this.deviceRepo.deleteByUserId(userId);

      logger.info({
        message: 'All devices removed',
        userId,
        count,
      });

      return {
        success: true,
        message: 'All devices removed successfully',
        count,
      };
    } catch (error) {
      logger.error({
        message: 'Error removing all devices',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: 'Failed to remove all devices',
        count: 0,
      };
    }
  }
} 