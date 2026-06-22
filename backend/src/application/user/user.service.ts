import { User } from '../../domain/user/user.entity';
import { ContextType } from '../../domain/content/context-type.enum';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserSettingsPrismaRepository } from '../../infrastructure/repositories/user-settings-prisma.repository';
import { UserDevicePrismaRepository } from '../../infrastructure/repositories/user-device-prisma.repository';
import { UserPrivacySettingPrismaRepository } from '../../infrastructure/repositories/user-privacy-setting-prisma.repository';
import { TrustRelationPrismaRepository } from '../../infrastructure/repositories/trust-relation-prisma.repository';
import { NotificationCode } from '../../domain/user/notification-code.enum';
import { PrivacyCode } from '../../domain/user/privacy-code.enum';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import logger from '../../infrastructure/logger/logger';
import { DEFAULT_PROFILE_BANNER_URL } from '../../domain/user/profile.constants';
import { ExperienceContent } from '../../interfaces/feed/feed.dto';
import {
  asProfileUpdate,
  asProfileUpdateMany,
  asProfileWhere,
  getPrismaModel,
  getPostCounts
} from '../../infrastructure/repositories/prisma-types.helper';
import { BadgeResponseMapper } from '../../infrastructure/utils/badge-response-mapper';
import { NotFoundError, ValidationError } from '../../infrastructure/errors/custom-errors';
import { ActionLogService } from '../gamification/action-log.service';
import { AchievementProgressService } from '../gamification/achievement-progress.service';
import { MainAction } from '../../domain/gamification/main-action.enum';
import { getErrorMessage } from '../../infrastructure/errors/error-helper';
import type { UserReportCategory } from '../../domain/user/user-report-category.enum';
import { NOT_SYSTEM_USER } from '../../infrastructure/config/system-users';

type CosmeticSummary = {
  id: string;
  title: string;
  image: string | null;
} | null;

type ProfileBadgeSummary = {
  id: string;
  title: string;
  image: string | null;
  type: 'achievement' | 'bridge';
  earnedAt: string | null;
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
  owner: string; // total earned count as string
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
  category: 'event' | 'collection';
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

/** Shared context data shape returned from buildContextDataFromPost */
type ContextData = {
  id: string;
  name: string;
  subName: string;
  image: string | null;
  isOwned?: boolean;
} | null;

/** Minimal post-like shape used by mapContextType & buildContextDataFromPost */
type PostLike = {
  id: string;
  productId?: string | null;
  productGroupId?: string | null;
  subCategoryId?: string | null;
  categoryId?: string | null;
  body?: string | null;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
    group?: {
      id: string;
      name: string;
      imageUrl?: string | null;
      subCategory?: {
        id: string;
        name: string;
        imageUrl?: string | null;
        mainCategory?: { id: string; name: string; imageUrl?: string | null } | null;
      } | null;
    } | null;
  } | null;
  productGroup?: {
    id: string;
    name: string;
    imageUrl?: string | null;
    subCategory?: {
      id: string;
      name: string;
      imageUrl?: string | null;
      mainCategory?: { id: string; name: string; imageUrl?: string | null } | null;
    } | null;
  } | null;
  subCategory?: {
    id: string;
    name: string;
    imageUrl?: string | null;
    mainCategory?: { id: string; name: string; imageUrl?: string | null } | null;
  } | null;
  mainCategory?: { id: string; name: string; imageUrl?: string | null } | null;
};

/** Inventory shape used by buildContextDataFromInventory */
type InventoryLike = {
  id: string;
  productId: string | null;
  hasOwned?: boolean;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
    brand?: string | null;
    group?: {
      id: string;
      name: string;
      imageUrl?: string | null;
      subCategory?: {
        id: string;
        name: string;
        imageUrl?: string | null;
        mainCategory?: { id: string; name: string; imageUrl?: string | null } | null;
      } | null;
    } | null;
  } | null;
  experienceSummary?: string | null;
  media?: Array<{ mediaUrl: string | null }>;
};

/** Generic feed item shape returned by getUserPosts, getUserReviews, etc. */
type FeedItem = {
  id: string;
  type: string;
  user: { id: string; name: string; title: string; avatar: string };
  stats: BasicStats;
  createdAt: string;
  contextType: ContextType;
  [key: string]: unknown;
};

/** Paginated result shape */
type PaginatedResult<T> = {
  items: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
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
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly actionLogService: ActionLogService;
  private readonly achievementProgressService: AchievementProgressService;

  constructor(private readonly userRepo = new UserPrismaRepository()) {
    this.s3Service = new S3Service();
    this.cacheService = CacheService.getInstance();
    this.profileRepo = new ProfilePrismaRepository();
    this.settingsRepo = new UserSettingsPrismaRepository();
    this.deviceRepo = new UserDevicePrismaRepository();
    this.privacySettingRepo = new UserPrivacySettingPrismaRepository();
    this.trustRelationRepo = new TrustRelationPrismaRepository();
    this.prisma = getPrisma();
    this.actionLogService = new ActionLogService();
    this.achievementProgressService = new AchievementProgressService();
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
      avatar: resolveMediaUrl(activeAvatar?.imageUrl ?? null, true),
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
    const cosmeticBadgeId = profileRecord && 'cosmeticBadgeId' in profileRecord 
      ? (profileRecord as { cosmeticBadgeId?: string | null }).cosmeticBadgeId ?? null 
      : null;
    const [cosmeticBadge, userBadges] = await Promise.all([
      cosmeticBadgeId
        ? this.prisma.badge.findUnique({
            where: { id: cosmeticBadgeId },
            select: { id: true, name: true, imageUrl: true },
          })
        : Promise.resolve(null),
      this.prisma.userBadge.findMany({
        where: {
          userId,
          isVisible: true,
          displayOrder: { not: null, lte: 3 }, // 0-3 = max 4 badges
        },
        include: { badge: true },
        orderBy: { displayOrder: 'asc' },
        take: 4,
      }),
    ]);

    const cosmeticDetail: CosmeticSummary = cosmeticBadge
      ? {
          id: cosmeticBadge.id,
          title: cosmeticBadge.name,
          image: resolveMediaUrl(cosmeticBadge.imageUrl ?? null),
        }
      : null;

    // Get total earned counts for badges
    const badgeIds = userBadges.map((ub) => ub.badgeId);
    const earnedCounts =
      badgeIds.length > 0
        ? await this.prisma.userBadge.groupBy({
            by: ['badgeId'],
            where: { badgeId: { in: badgeIds }, claimed: true },
            _count: { userId: true },
          })
        : [];

    const earnedCountMap = Object.fromEntries(
      earnedCounts.map((ec) => [ec.badgeId, ec._count.userId]),
    );

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
        type: BadgeResponseMapper.mapBadgeCategory(ub.badge.type),
        earnedAt: ub.createdAt.toISOString(),
        rarity: BadgeResponseMapper.mapRarity(ub.badge.rarity),
        owner: String(earnedCountMap[ub.badgeId] ?? 0),
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
    cosmeticId?: string | null;
    badges?: Array<{ id: string }>;
  }): Promise<void> {
    const { name, biography, cosmeticId, badges } = payload;

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

      const profileData: {
        displayName?: string;
        bio?: string | null;
        cosmeticBadgeId?: string | null;
      } = {};
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
      if (typeof validatedCosmeticId !== 'undefined') {
        profileData.cosmeticBadgeId = validatedCosmeticId;
      }

      const existingProfile = await tx.profile.findUnique({ where: { userId } });
      if (Object.keys(profileData).length > 0) {
        if (existingProfile) {
          await tx.profile.update({
            where: { userId },
            data: asProfileUpdate(profileData),
          });
        } else {
          await tx.profile.create({
            data: {
              userId,
              displayName: profileData.displayName ?? name ?? 'Anonymous User',
              userName: null,
              bio: typeof biography !== 'undefined' ? biography : null,
              bannerUrl: DEFAULT_PROFILE_BANNER_URL,
              cosmeticBadgeId: typeof validatedCosmeticId !== 'undefined' ? validatedCosmeticId : undefined,
            } as Parameters<typeof tx.profile.create>[0]['data'],
          });
        }
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
            },
          });
        }
      }
    });

    await this.cacheService.del(`user:${userId}:profile`);

    // Gamification: BIO_ADD tracking (fire-and-forget)
    if (typeof biography !== 'undefined' && biography) {
      this.actionLogService
        .logAction({
          userId,
          mainAction: MainAction.SYSTEM,
          actionTypeCode: 'BIO_ADD',
          entityType: 'profile',
          entityId: userId,
          metadata: { bioLength: biography.length },
        })
        .catch((err) => {
          logger.warn('Failed to log BIO_ADD action', { userId, error: getErrorMessage(err) });
        });

      this.achievementProgressService
        .incrementProgressByCode(userId, MainAction.SYSTEM, 'BIO_ADD', 1)
        .catch((err) => {
          logger.warn('Failed to increment BIO_ADD progress', { userId, error: getErrorMessage(err) });
        });
    }
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

    const whereClause = {
        userId: { in: trustedIds },
        ...(query
          ? {
              OR: [
              { displayName: { contains: query, mode: 'insensitive' as const } },
              { userName: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
    };

    const profiles = await this.prisma.profile.findMany({
      where: asProfileWhere(whereClause),
      select: {
        userId: true,
        displayName: true,
        userName: true,
      },
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

    return profiles.map(p => {
      const avatarUrl = resolveMediaUrl(avatarMap.get(String(p.userId)) ?? null, true);
      return {
        id: String(p.userId),
        userName: p.userName ?? null,
        titles: (titleMap.get(String(p.userId)) || []).slice(0, 3),
        avatar: avatarUrl || '',
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
        data: asProfileUpdateMany({
          trustCount: {
            increment: -1
          }
        })
      });

      // Decrement trusted user's trusterCount
      await this.prisma.profile.updateMany({
        where: { userId: targetUserId },
        data: asProfileUpdateMany({
          trusterCount: {
            increment: -1
          }
        })
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

    // Gamification: TRUST tracking (fire-and-forget)
    this.actionLogService
      .logAction({
        userId,
        mainAction: MainAction.SYSTEM,
        actionTypeCode: 'TRUST',
        entityType: 'user',
        entityId: targetUserId,
      })
      .catch((err) => {
        logger.warn('Failed to log TRUST action', { userId, targetUserId, error: getErrorMessage(err) });
      });

    this.achievementProgressService
      .incrementProgressByCode(userId, MainAction.SYSTEM, 'TRUST', 1)
      .catch((err) => {
        logger.warn('Failed to increment TRUST progress', { userId, targetUserId, error: getErrorMessage(err) });
      });

    // Send notification to the trusted user (targetUserId)
    try {
      const { NotificationService } = await import('../notification/notification.service');
      const notificationService = new NotificationService();
      
      // Get truster user info for notification
      const truster = await this.userRepo.findById(userId);
      if (truster) {
        await notificationService.sendNotification(
          targetUserId,
          NotificationType.NEW_TRUSTER,
          {
            trusterName: truster.name || truster.email,
            trusterId: truster.id,
          }
        );
        logger.info({ message: 'Trust notification sent', userId, targetUserId });
      }
    } catch (error) {
      logger.error({ message: 'Failed to send trust notification', userId, targetUserId, error });
      // Don't throw - notification failure shouldn't break trust operation
    }
    
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
        data: asProfileUpdateMany({
          trustCount: trusterTrustCount,
          trusterCount: trusterTrusterCount
        })
      }),
      // Update trusted user's profile
      this.prisma.profile.updateMany({
        where: { userId: trustedUserId },
        data: asProfileUpdateMany({
          trustCount: trustedTrustCount,
          trusterCount: trustedTrusterCount
        })
      })
    ]);
  }

  async listTrusters(
    userId: string,
    query?: string,
    sort?: 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'trusted_first'
  ): Promise<Array<{
    id: string;
    userName: string | null;
    titles: string[];
    avatar: string | null;
    name: string | null;
    isTrusted: boolean;
  }>> {
    const trusterRelations = await this.prisma.trustRelation.findMany({
      where: { trustedUserId: userId },
      select: { trusterId: true, createdAt: true },
      orderBy: sort === 'date_asc' ? { createdAt: 'asc' } : sort === 'date_desc' ? { createdAt: 'desc' } : undefined,
    });
    const trusterIds = trusterRelations.map(r => r.trusterId);
    if (trusterIds.length === 0) return [];

    // Create a map of trusterId -> createdAt for sorting
    const trustDateMap = new Map(trusterRelations.map(r => [r.trusterId, r.createdAt]));

    const whereClause = {
        userId: { in: trusterIds },
        ...(query
          ? {
              OR: [
              { displayName: { contains: query, mode: 'insensitive' as const } },
              { userName: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
    };

    // Build orderBy based on sort parameter
    let orderBy: Record<string, string> = {};
    if (sort === 'name_asc') {
      orderBy = { displayName: 'asc' };
    } else if (sort === 'name_desc') {
      orderBy = { displayName: 'desc' };
    }
    // date_asc and date_desc are handled at trustRelation level
    // trusted_first will be handled after fetching

    const profiles = await this.prisma.profile.findMany({
      where: asProfileWhere(whereClause),
      select: {
        userId: true,
        displayName: true,
        userName: true,
      },
      ...(Object.keys(orderBy).length > 0 && { orderBy }),
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

    let result = profiles.map(p => {
      const avatarUrl = resolveMediaUrl(avatarMap.get(String(p.userId)) ?? null, true);
      return {
        id: String(p.userId),
        userName: p.userName ?? null,
        titles: (titleMap.get(String(p.userId)) || []).slice(0, 3),
        avatar: avatarUrl || '',
        name: p.displayName,
        isTrusted: myTrustedSet.has(String(p.userId)),
        trustDate: trustDateMap.get(String(p.userId)),
      };
    });

    // Apply additional sorting
    if (sort === 'date_asc') {
      result = result.sort((a, b) => {
        const dateA = a.trustDate?.getTime() || 0;
        const dateB = b.trustDate?.getTime() || 0;
        return dateA - dateB;
      });
    } else if (sort === 'date_desc') {
      result = result.sort((a, b) => {
        const dateA = a.trustDate?.getTime() || 0;
        const dateB = b.trustDate?.getTime() || 0;
        return dateB - dateA;
      });
    } else if (sort === 'trusted_first') {
      result = result.sort((a, b) => {
        if (a.isTrusted && !b.isTrusted) return -1;
        if (!a.isTrusted && b.isTrusted) return 1;
        return 0;
      });
    }

    // Remove trustDate from result
    return result.map(({ trustDate, ...rest }) => rest);
  }

  async blockUser(userId: string, targetUserId: string): Promise<void> {
    // idempotent create - Prisma model name is UserBlock
    const userBlock = getPrismaModel<{
      upsert: (args: {
        where: { blockerId_blockedUserId: { blockerId: string; blockedUserId: string } };
        update: Record<string, never>;
        create: { blockerId: string; blockedUserId: string };
      }) => Promise<unknown>;
    }>(this.prisma, 'userBlock');
    
    await userBlock.upsert({
      where: { blockerId_blockedUserId: { blockerId: userId, blockedUserId: targetUserId } },
      update: {},
      create: { blockerId: userId, blockedUserId: targetUserId },
    });
  }

  async unblockUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const userBlock = getPrismaModel<{
        delete: (args: {
          where: { blockerId_blockedUserId: { blockerId: string; blockedUserId: string } };
        }) => Promise<unknown>;
      }>(this.prisma, 'userBlock');
      
      await userBlock.delete({
        where: { blockerId_blockedUserId: { blockerId: userId, blockedUserId: targetUserId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async reportUser(
    reporterId: string,
    reportedUserId: string,
    category: string,
    description?: string | null
  ): Promise<void> {
    if (reporterId === reportedUserId) {
      throw new Error('Kendinizi raporlayamazsınız');
    }

    // Kullanıcının var olup olmadığını kontrol et
    const reportedUser = await this.prisma.user.findUnique({
      where: { id: reportedUserId },
    });
    if (!reportedUser) {
      throw new Error('Raporlanan kullanıcı bulunamadı');
    }

    const { UserReportPrismaRepository } = await import('../../infrastructure/repositories/user-report-prisma.repository');
    const { UserReportCategory } = await import('../../domain/user/user-report-category.enum');
    const userReportRepo = new UserReportPrismaRepository();

    // Aynı kullanıcı aynı kullanıcıyı birden fazla kez raporlayamaz
    const existingReport = await userReportRepo.findByReporterIdAndReportedUserId(reporterId, reportedUserId);
    if (existingReport) {
      throw new Error('Bu kullanıcı zaten raporlanmış. Her kullanıcı bir kullanıcı için sadece bir kez rapor gönderebilir.');
    }

    const normalizedCategory = String(category || '').toUpperCase();
    const validCategories = Object.values(UserReportCategory) as string[];
    if (!validCategories.includes(normalizedCategory)) {
      throw new Error('Geçersiz rapor kategorisi');
    }

    const trimmedDescription = description?.trim();
    if (trimmedDescription && trimmedDescription.length > 500) {
      throw new Error('Açıklama çok uzun (maksimum 500 karakter)');
    }

    await userReportRepo.create({
      reportedUserId,
      reporterId,
      category: normalizedCategory as UserReportCategory,
      description: trimmedDescription || null,
    });

    logger.info(`User ${reportedUserId} reported by ${reporterId} with category ${normalizedCategory}`);
  }

  async muteUser(userId: string, targetUserId: string): Promise<void> {
    // idempotent create - Prisma model name is UserMute
    const userMute = getPrismaModel<{
      upsert: (args: {
        where: { muterId_mutedUserId: { muterId: string; mutedUserId: string } };
        update: Record<string, never>;
        create: { muterId: string; mutedUserId: string };
      }) => Promise<unknown>;
    }>(this.prisma, 'userMute');
    
    await userMute.upsert({
      where: { muterId_mutedUserId: { muterId: userId, mutedUserId: targetUserId } },
      update: {},
      create: { muterId: userId, mutedUserId: targetUserId },
    });
  }

  async unmuteUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const userMute = getPrismaModel<{
        delete: (args: {
          where: { muterId_mutedUserId: { muterId: string; mutedUserId: string } };
        }) => Promise<unknown>;
      }>(this.prisma, 'userMute');
      
      await userMute.delete({
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

    const where: Prisma.UserBadgeWhereInput = {
      userId,
      badge: {
        achievementGoals: { some: {} },
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { description: { contains: query, mode: 'insensitive' as const } },
          ],
        } : {}),
      },
      ...(cursor ? { badgeId: { lt: cursor } } : {}),
    };

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
              select: { userBadges: true, eventBadges: true },
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
      const badge = ub.badge;
      type AchievementGoalType = {
        id: string;
        title: string;
        requirement: string;
      };
      const goals: AchievementGoalType[] = (badge?.achievementGoals || []) as AchievementGoalType[];
      const tasks: CollectionTask[] = goals.map((goal) => ({
          id: String(goal.id),
          title: goal.title,
        type: inferTaskType(goal.title, goal.requirement),
      }));

      const isEvent = (badge?._count?.eventBadges ?? 0) > 0;

      return {
        id: String(badge?.id || ''),
        title: badge?.name || '',
        rarity: COLLECTION_RARITY_MAP[badge?.rarity || 'COMMON'] || 'Usual',
        image: this.resolveBadgeImage(badge),
        isClaimed: !!ub.claimed,
        nftAddress: (badge as { nftAddress?: string | null })?.nftAddress ?? null,
        earnedDate: ub.claimedAt ? ub.claimedAt.toISOString() : null,
        totalEarned: badge?._count?.userBadges ?? 0,
        category: isEvent ? 'event' : 'collection',
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

    const mapStatus = (current: number, total: number): 'not-started' | 'in_progress' | 'completed' => {
      if (current <= 0) return 'not-started';
      if (current >= total) return 'completed';
      return 'in_progress';
    };

    const statusFilter = options?.status;
    const isValidUuid = (value: unknown): value is string =>
      typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value);
    const initialCursor = isValidUuid(options?.cursor) ? options!.cursor : undefined;

    const mapBadge = (badge: {
      id: string;
      name: string;
      imageUrl?: string | null;
      description?: string | null;
      achievementGoals?: Array<{
        pointsRequired: number;
        userAchievements?: Array<{ progress: number }>;
      }>;
    }) => {
      const goals = badge.achievementGoals || [];
      const total = goals.reduce((sum: number, g: { pointsRequired: number }) => sum + (g.pointsRequired || 0), 0);
      const current = goals.reduce((sum: number, g: { userAchievements?: Array<{ progress: number }> }) => sum + (g.userAchievements?.[0]?.progress || 0), 0);
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
    };

    // DB-level cursor pagination (deterministic order). Status filtresi için gerekirse birden çok batch çekilir.
    const items: Array<{
      id: string;
      title: string;
      image: string;
      description: string;
      current: number;
      total: number;
      status: 'not-started' | 'in_progress' | 'completed';
    }> = [];

    const take = limit; // client limit
    const pageSize = limit; // internal batch size (limit<=50)
    let cursor = initialCursor;
    let moreRowsAvailable = true;
    let hasMoreForResponse = false;
    let iterations = 0;

    while (items.length < take && moreRowsAvailable && iterations < 30) {
      iterations += 1;

      const batch = await this.prisma.badge.findMany({
        where: { achievementGoals: { some: {} } },
        include: {
          achievementGoals: {
            include: {
              userAchievements: {
                where: { userId },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: pageSize + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      moreRowsAvailable = batch.length > pageSize;
      const page = moreRowsAvailable ? batch.slice(0, pageSize) : batch;

      if (page.length === 0) {
        break;
      }

      // Next query cursor: last row of the page (not filtered)
      cursor = String(page[page.length - 1].id);

      const mapped = page.map(mapBadge);
      const filtered = statusFilter ? mapped.filter((b) => b.status === statusFilter) : mapped;

      if (filtered.length === 0) {
        continue;
      }

      const remaining = take - items.length;
      if (filtered.length > remaining) {
        items.push(...filtered.slice(0, remaining));
        hasMoreForResponse = true; // Aynı batch'te bile daha fazla eşleşen var
        break;
      }

      items.push(...filtered);
    }

    // Eğer limit'e ulaştıysak ve daha fazla row varsa, hasMore=true sayabiliriz
    if (!hasMoreForResponse) {
      hasMoreForResponse = items.length >= take && moreRowsAvailable;
    }

    const nextCursor = items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items: items,
      pagination: {
        cursor: nextCursor,
        hasMore: hasMoreForResponse,
        limit,
      },
    };
  }

  async listBridgeBadges(
    userId: string,
    query?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    brand: { items: CollectionResponse[] };
    achievement: { items: CollectionResponse[] };
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const whereClause: {
      userId: string;
      badge?: {
        OR: Array<{
          name?: { contains: string; mode: 'insensitive' };
          description?: { contains: string; mode: 'insensitive' };
        }>;
      };
      badgeId?: { lt: string };
    } = {
      userId,
      ...(query
        ? {
            badge: {
              OR: [
                { name: { contains: query, mode: 'insensitive' as const } },
                { description: { contains: query, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    if (cursor) {
      whereClause.badgeId = { lt: cursor };
    }
    
    // Type assertion for Prisma where clause
    const prismaWhere = whereClause as unknown as Prisma.BridgeRewardWhereInput;

    const rewards = await this.prisma.bridgeReward.findMany({
      where: prismaWhere,
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
    });

    const hasMore = rewards.length > limit;
    const paginatedRewards = hasMore ? rewards.slice(0, limit) : rewards;

    type RewardWithBadge = {
      id: string;
      nftAddress?: string | null;
      awardedAt: Date;
      badge?: {
        id: string;
        name: string;
        rarity: string;
        type?: string;
        imageUrl?: string | null;
        achievementGoals?: Array<{
          id: string;
          title: string;
          requirement: string;
        }>;
        _count?: {
          bridgeRewards: number;
        };
      };
    };

    const BRAND_TYPE = 'BRAND';

    const itemsWithType = (paginatedRewards as RewardWithBadge[]).map((rw) => {
      const badge = rw.badge;
      type AchievementGoalType = {
        id: string;
        title: string;
        requirement: string;
      };
      const goals: AchievementGoalType[] = (badge?.achievementGoals || []) as AchievementGoalType[];
      const tasks: CollectionTask[] = goals.map((goal) => ({
        id: String(goal.id),
        title: goal.title,
        type: inferTaskType(goal.title, goal.requirement),
      }));

      const badgeType = badge?.type ?? '';
      const item: CollectionResponse = {
        id: String(badge?.id || ''),
        title: badge?.name || '',
        rarity: COLLECTION_RARITY_MAP[badge?.rarity || 'COMMON'] || 'Usual',
        image: this.resolveBadgeImage(badge),
        isClaimed: true,
        nftAddress: rw.nftAddress ?? null,
        earnedDate: rw.awardedAt ? rw.awardedAt.toISOString() : null,
        totalEarned: badge?._count?.bridgeRewards ?? 0,
        category: badgeType === 'EVENT' ? 'event' : 'collection',
        tasks,
      };
      return { item, badgeType };
    });

    const brandItems = itemsWithType.filter((x) => x.badgeType === BRAND_TYPE).map((x) => x.item);
    const achievementItems = itemsWithType.filter((x) => x.badgeType !== BRAND_TYPE).map((x) => x.item);

    const allItems = itemsWithType.map((x) => x.item);
    const nextCursor = hasMore && allItems.length > 0 ? allItems[allItems.length - 1].id : undefined;

    return {
      brand: { items: brandItems },
      achievement: { items: achievementItems },
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
      },
    });
    return { success: true };
  }

  async claimBridgeBadge(userId: string, badgeId: string): Promise<{ success: boolean }> {
    // Create a RewardClaim record to represent claiming action
    await this.prisma.rewardClaim.create({
      data: {
        userId,
        sourceId: badgeId,
        rewardType: 'BADGE',
        sourceType: 'BADGE_EARNED',
        amount: 0,
        status: 'CLAIMED',
        metadata: { badgeId },
      },
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
      } as Parameters<typeof this.prisma.contentPost.findUnique>[0]['select'],
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
      avatar: resolveMediaUrl(avatar?.imageUrl ?? null, true) || '',
    };
  }

  private async getProductBase(productId: string | null) {
    if (!productId) return null;
    const product = await this.prisma.product.findUnique({ 
      where: { id: productId }, 
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
        brand: true,
      }
    });
    if (!product) return null;
    
    const group = product.group;
    const subCategory = group?.subCategory;
    const mainCategory = subCategory?.mainCategory;
    
    // Image URL'ini bul ve prefix ekle (fallback chain: product -> group -> subCategory -> mainCategory)
    const imagePath = product.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;
    
    return {
      id: String(product.id),
      name: product.name,
      subName: product.brand?.name || group?.name || subCategory?.name || mainCategory?.name || '',
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

  private mapContextType(post: PostLike): ContextType {
    if (post?.productId) {
      return this.normalizeContextType(ContextType.PRODUCT);
    }
    if (post?.productGroupId) {
      return this.normalizeContextType(ContextType.PRODUCT_GROUP);
    }
    return this.normalizeContextType(ContextType.SUB_CATEGORY);
  }

  private async buildContextDataFromPost(post: PostLike, ownedProductIds?: Set<string> | null): Promise<ContextData> {
    const contextType = this.mapContextType(post);

    // PRODUCT context
    if (contextType === ContextType.PRODUCT) {
      if (post.product) {
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

      // ✅ Relation yoksa ID'den fetch et
      if (post.productId) {
        const product = await this.prisma.product.findUnique({
          where: { id: post.productId },
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
        });

        if (product) {
          const group = product.group;
          const subCategory = group?.subCategory;
          const mainCategory = subCategory?.mainCategory;
          const imagePath = product.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;
          return {
            id: String(product.id),
            name: product.name,
            subName: group?.name || subCategory?.name || mainCategory?.name || '',
            image: resolveMediaUrl(imagePath),
            isOwned: ownedProductIds ? ownedProductIds.has(String(product.id)) : undefined,
          };
        }
      }
    }

    // PRODUCT_GROUP context
    if (contextType === ContextType.PRODUCT_GROUP) {
      if (post.productGroup) {
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

      // ✅ Relation yoksa ID'den fetch et
      if (post.productGroupId) {
        const group = await this.prisma.productGroup.findUnique({
          where: { id: post.productGroupId },
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        });

        if (group) {
          const subCategory = group.subCategory;
          const mainCategory = subCategory?.mainCategory;
          const imagePath = group.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;
          return {
            id: String(group.id),
            name: group.name,
            subName: subCategory?.name || mainCategory?.name || '',
            image: resolveMediaUrl(imagePath),
          };
        }
      }
    }

    // SUB_CATEGORY context
    if (contextType === ContextType.SUB_CATEGORY) {
      if (post.subCategory) {
        const subCategory = post.subCategory;
        const imagePath = subCategory.imageUrl || subCategory.mainCategory?.imageUrl || null;
        return {
          id: String(subCategory.id),
          name: subCategory.name,
          subName: subCategory.mainCategory?.name || '',
          image: resolveMediaUrl(imagePath),
        };
      }

      // ✅ YENİ: categoryId'den fetch et (categories tablosu - pcat_ prefix'li)
      if (post.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: post.categoryId },
        });

        if (category) {
          return {
            id: String(category.id),
            name: category.name,
            subName: '',
            image: resolveMediaUrl(category.thumbnail),
          };
        }
      }

      // Eski UUID sistemini de destekle (sub_categories tablosu)
      if (post.subCategoryId) {
        const subCategory = await this.prisma.subCategory.findUnique({
          where: { id: post.subCategoryId },
          include: {
            mainCategory: true,
          },
        });

        if (subCategory) {
          const imagePath = subCategory.imageUrl || subCategory.mainCategory?.imageUrl || null;
          return {
            id: String(subCategory.id),
            name: subCategory.name,
            subName: subCategory.mainCategory?.name || '',
            image: resolveMediaUrl(imagePath),
          };
        }
      }
    }

    // PRODUCT_GROUP context için categoryId kontrolü ekle
    if (contextType === ContextType.PRODUCT_GROUP && post.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: post.categoryId },
      });

      if (category) {
        return {
          id: String(category.id),
          name: category.name,
          subName: '',
          image: resolveMediaUrl(category.thumbnail),
        };
      }
    }

    // Fallback: mainCategory
    if (post.mainCategory) {
      return {
        id: String(post.mainCategory.id),
        name: post.mainCategory.name,
        subName: '',
        image: resolveMediaUrl(post.mainCategory.imageUrl || null),
      };
    }

    // Son fallback: null döndür
    logger.warn({
      message: 'Unable to build contextData from post (user.service)',
      postId: post.id,
      contextType,
      productId: post.productId,
      productGroupId: post.productGroupId,
      subCategoryId: post.subCategoryId,
      categoryId: post.categoryId,
    });

    return null;
  }

  async getUserPosts(userId: string, options?: { limit?: number }): Promise<FeedItem[]> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
    
    // ✅ Tüm post tiplerini getir (EXPERIENCE + UPDATE Experience tabında listelenir)
    const posts = await this.prisma.contentPost.findMany({
      where: { userId },
      take: limit + 1, // hasMore kontrolü için +1
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
        contentPostTags: true,
        comparison: {
          include: {
            product1: true,
            product2: true,
            scores: true,
          },
        },
        tip: true,
        updateContent: {
          include: {
            experiencePost: {
              include: {
                product: {
                  include: {
                    group: {
                      include: {
                        subCategory: { include: { mainCategory: true } },
                      },
                    },
                  },
                },
                contentPostTags: true,
              },
            },
          },
        },
      },
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
    
    // Limit uygula (hasMore kontrolü için +1 aldık)
    const paginatedPosts = posts.slice(0, limit);
    
    // getPostStats yerine post'un kendi alanlarını kullan (N+1 query'yi önle)
    // Experience/Update: feed ile aynı yapı (type: experience, product, experienceContent, tags, status)
    const results = await Promise.all(
      paginatedPosts.map(async (post) => {
        const stats = {
          likes: post.likesCount || 0,
          comments: post.commentsCount || 0,
          shares: post.sharesCount || 0,
          bookmarks: post.favoritesCount || 0,
        };
        const contextType = this.mapContextType(post);
        const contextData = await this.buildContextDataFromPost(post, ownedProductIds);
        const images = postMediaMap.get(post.id) || [];
        const postType = post.type as string;

      if (postType === 'UPDATE' && post.updateContent?.experiencePost) {
        const expPost = post.updateContent.experiencePost;
        const expProduct = expPost.product
          ? {
              id: expPost.product.id,
              name: expPost.product.name,
              subName: expPost.product.group?.name ?? '',
              image: resolveMediaUrl(expPost.product.imageUrl) ?? null,
              isOwned: ownedProductIds.has(String(expPost.productId)),
            }
          : { id: expPost.productId || '', name: '', subName: '', image: null, isOwned: false };
        const expContent = this.parseExperienceContentFromBody(expPost.body);
        const expContentString =
          expContent.length > 0
            ? expContent
                .map((item) => `${item.title}: ${item.content}${item.rating ? ` (${item.rating}/5)` : ''}`)
                .join('\n\n')
            : expPost.body || '';
        const updateContentText = post.updateContent.content || post.body || '';
        // Update gönderisinin KENDİ AI-segmentli içeriği (body'de gerçek marker varsa)
        const updateHasSegments = /\[(price_and_shopping|product_and_usage)/i.test(post.body || '');
        const updateOwnContent = updateHasSegments
          ? this.parseExperienceContentFromBody(post.body)
          : undefined;
        return {
          id: String(post.id),
          type: 'update' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          relatedPost: {
            id: String(expPost.id),
            product: expProduct,
            content: expContentString,
            experienceContent: expContent,
            tags: expPost.contentPostTags?.map((t: { tag: string }) => t.tag) || [],
            images: [],
            status: expPost.productStatus ?? undefined,
            statusLabel: expPost.productStatus === 'own' ? 'I owned' : expPost.productStatus === 'tried' ? 'I tried' : undefined,
          },
          content: updateContentText,
          experienceContent: updateOwnContent,
          images,
        };
      }

      if (postType === 'EXPERIENCE' || postType === 'UPDATE') {
        const product = contextData
          ? { ...contextData, isOwned: contextData.isOwned ?? ownedProductIds.has(String(post.productId)) }
          : { id: post.productId || '', name: '', subName: '', image: null, isOwned: false };
        const experienceContent = this.parseExperienceContentFromBody(post.body);
        const contentString =
          experienceContent.length > 0
            ? experienceContent
                .map((item) => `${item.title}: ${item.content}${item.rating ? ` (${item.rating}/5)` : ''}`)
                .join('\n\n')
            : post.body || '';
        return {
          id: String(post.id),
          type: postType === 'UPDATE' ? ('update' as const) : ('experience' as const),
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          product,
          content: contentString,
          experienceContent,
          tags: post.contentPostTags?.map((t: { tag: string }) => t.tag) || [],
          images,
          status: post.productStatus === 'own' || post.productStatus === 'tried' ? post.productStatus : undefined,
          statusLabel: post.productStatus === 'own' ? 'I owned' : post.productStatus === 'tried' ? 'I tried' : undefined,
        };
      }

      // COMPARE (benchmark) tipindeki postlar
      if (postType === 'COMPARE') {
        const comp = post.comparison;
        if (comp) {
          const choiceProductId = this.selectComparisonWinner(comp);
          return {
            id: String(post.id),
            type: 'benchmark' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            contextType,
            products: [
              {
                ...(await this.getProductBase(String(comp.product1Id)))!,
                isOwned: ownedProductIds.has(String(comp.product1Id)),
                choice: choiceProductId ? choiceProductId === String(comp.product1Id) : true,
              },
              {
                ...(await this.getProductBase(String(comp.product2Id)))!,
                isOwned: ownedProductIds.has(String(comp.product2Id)),
                choice: choiceProductId ? choiceProductId === String(comp.product2Id) : false,
              },
            ],
            content: post.body,
          };
        }
      }

      // TIPS tipindeki postlar
      if (postType === 'TIPS') {
        const tip = post.tip;
        const benefit = tip?.tipCategory;
        const benefitMap: Record<string, { title: string; icon: string }> = {
          time_saving: { title: 'Zaman Kazandırır', icon: 'clock' },
          energy_efficiency: { title: 'Enerji Tasarrufu', icon: 'bolt' },
          durability: { title: 'Daha Dayanıklı', icon: 'shield' },
          better_result: { title: 'Daha İyi Sonuç', icon: 'star' },
        };
        return {
          id: String(post.id),
          type: 'tipsAndTricks' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          contextData,
          benefit: benefit && benefitMap[benefit] ? benefitMap[benefit] : { title: 'Fayda', icon: 'lightbulb' },
          content: post.body,
          images,
        };
      }

      // QUESTION tipindeki postlar
      if (postType === 'QUESTION') {
        return {
          id: String(post.id),
          type: 'question' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          contextData,
          content: post.body,
          images,
        };
      }

      // FREE ve diğer post tipleri
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

  /** Experience post body'den experienceContent array (feed ile aynı yapı) */
  private parseExperienceContentFromBody(body: string): Array<{ title: string; content: string; rating: number }> {
    if (!body) {
      return [{ title: 'Product and Usage Experience', content: '', rating: 0 }];
    }
    const content: Array<{ title: string; content: string; rating: number }> = [];
    const priceMatch = body.match(/\[(?:price_and_shopping|Price and Shopping)[^\]]*\]\s*(.*?)\s*\(Rating:\s*(\d+)\/5\)/is);
    const usageMatch = body.match(/\[(?:product_and_usage|Product and Usage)[^\]]*\]\s*(.*?)\s*\(Rating:\s*(\d+)\/5\)/is);
    if (priceMatch) content.push({ title: 'Price and Shopping Experience', content: priceMatch[1].trim(), rating: Math.min(5, Math.max(1, parseInt(priceMatch[2], 10))) });
    if (usageMatch) content.push({ title: 'Product and Usage Experience', content: usageMatch[1].trim(), rating: Math.min(5, Math.max(1, parseInt(usageMatch[2], 10))) });
    if (content.length === 0) {
      const ratingMatch = body.match(/Rating:\s*(\d+)/i);
      const r = ratingMatch ? Math.min(5, Math.max(1, parseInt(ratingMatch[1], 10))) : 0;
      content.push({ title: 'Price and Shopping Experience', content: body, rating: r });
      content.push({ title: 'Product and Usage Experience', content: body, rating: r });
    }
    return content;
  }

  async getUserUpdates(
    userId: string,
    options?: { limit?: number }
  ): Promise<PaginatedResult<FeedItem>> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 100;

    const posts = await this.prisma.contentPost.findMany({
      where: { userId, type: ContentPostType.UPDATE },
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
      },
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
        const contextData = await this.buildContextDataFromPost(post, ownedProductIds);
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
  ): Promise<PaginatedResult<FeedItem>> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const userBase = await this.getUserBase(userId);
    const results: FeedItem[] = [];

    // 1. Inventory'den experience'ları çek (eski sistem)
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
        media: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    for (const inv of inventories) {
      // ProductExperience artık kullanılmıyor, boş array kullan
      const invRecord = inv as unknown as InventoryLike;
      const experiences = this.buildExperienceSections(
        [],
        invRecord.experienceSummary ?? null,
      );

      const tags = await this.collectProductTags(String(inv.productId));
      const images = (invRecord.media || [])
        .map((m: { mediaUrl: string | null }) => {
          const mediaPath = m.mediaUrl;
          if (mediaPath) {
            return resolveMediaUrl(mediaPath);
          }
          return null;
        })
        .filter((url: string | null) => url !== null);

      const contextData = this.buildContextDataFromInventory(invRecord);

      results.push({
        id: String(inv.id),
        type: 'experience' as const,
        user: userBase,
        // Legacy inventory-based experience'lar için mock istatistikler gösterme.
        // Gerçek like/comment/share/bookmark verisi olmadığı için hepsini 0 döndürüyoruz.
        stats: {
          likes: 0,
          comments: 0,
          shares: 0,
          bookmarks: 0,
        },
        createdAt: inv.createdAt.toISOString(),
        contextType: ContextType.PRODUCT,
        contextData,
        content: experiences,
        tags,
        images,
      });
    }

    // 2. ContentPost tablosundan EXPERIENCE tipindeki gönderileri çek
    const experiencePosts = await this.prisma.contentPost.findMany({
      where: {
        userId,
        type: ContentPostType.EXPERIENCE,
      },
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
        contentPostTags: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    // 3. ContentPost tablosundan UPDATE tipindeki gönderileri çek (experience’a yapılan güncellemeler)
    const updatePosts = await this.prisma.contentPost.findMany({
      where: {
        userId,
        type: ContentPostType.UPDATE,
      },
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
        updateContent: {
          include: {
            experiencePost: {
              include: {
                product: {
                  include: {
                    group: true,
                  },
                },
                contentPostTags: true,
              },
            },
          },
        },
        contentPostTags: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    // Batch fetch images from PostMedia (experience + update post id’leri)
    const postIds = [...experiencePosts.map((p) => p.id), ...updatePosts.map((p) => p.id)];
    const postMediaMap = new Map<string, string[]>();
    if (postIds.length > 0) {
      const allPostMedia = await this.prisma.postMedia.findMany({
        where: {
          postId: { in: postIds },
        },
        orderBy: { orderIndex: 'asc' },
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

    for (const post of experiencePosts) {
      // Experience content'i parse et
      const experienceContent = this.parseExperienceContentFromPost(post.body);
      
      // Images
      const images = postMediaMap.get(post.id) || [];

      // Tags
      const tags = (post.contentPostTags || [])
        .map((cpt: { tag: string }) => cpt.tag)
        .filter((tag: string | null | undefined) => tag);

      // Context data
      const contextData = post.product ? {
        product: {
          id: post.product.id,
          name: post.product.name,
          image: resolveMediaUrl(post.product.imageUrl),
          group: post.product.group ? {
            id: post.product.group.id,
            name: post.product.group.name,
          } : null,
          subCategory: post.product.group?.subCategory ? {
            id: post.product.group.subCategory.id,
            name: post.product.group.subCategory.name,
            mainCategory: post.product.group.subCategory.mainCategory ? {
              id: post.product.group.subCategory.mainCategory.id,
              name: post.product.group.subCategory.mainCategory.name,
            } : null,
          } : null,
        },
      } : null;

      // Stats
      const stats = {
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        shares: post.sharesCount || 0,
        bookmarks: post.favoritesCount || 0,
      };

      results.push({
        id: post.id,
        type: 'experience' as const,
        user: userBase,
        stats,
        createdAt: post.createdAt.toISOString(),
        contextType: ContextType.PRODUCT,
        contextData,
        content: experienceContent,
        tags,
        images,
      });
    }

    // 4. UPDATE postlarını ekle: feed/catalog ile aynı yapı (relatedPost = bağlı experience özeti)
    for (const post of updatePosts) {
      const images = postMediaMap.get(post.id) || [];
      const tags = (post.contentPostTags || [])
        .map((cpt: { tag: string }) => cpt.tag)
        .filter((tag: string | null | undefined) => tag);
      const updateText = post.updateContent?.content ?? post.body ?? '';
      // Update gönderisinin KENDİ AI-segmentli içeriği (body'de gerçek marker varsa)
      const updateHasSegments = /\[(price_and_shopping|product_and_usage)/i.test(post.body || '');
      const updateOwnContent = updateHasSegments
        ? this.parseExperienceContentFromPost(post.body)
        : undefined;
      const contextData = post.product
        ? {
            product: {
              id: post.product.id,
              name: post.product.name,
              image: resolveMediaUrl(post.product.imageUrl),
              group: post.product.group
                ? {
                    id: post.product.group.id,
                    name: post.product.group.name,
                  }
                : null,
              subCategory: post.product.group?.subCategory
                ? {
                    id: post.product.group.subCategory.id,
                    name: post.product.group.subCategory.name,
                    mainCategory: post.product.group.subCategory.mainCategory
                      ? {
                          id: post.product.group.subCategory.mainCategory.id,
                          name: post.product.group.subCategory.mainCategory.name,
                        }
                      : null,
                  }
                : null,
            },
          }
        : null;
      const stats = {
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        shares: post.sharesCount || 0,
        bookmarks: post.favoritesCount || 0,
      };

      // relatedPost = bağlı experience post özeti (UpdatePost yapısı, feed/catalog ile uyumlu)
      const expPost = post.updateContent?.experiencePost;
      let relatedPost: {
        id: string;
        product: { id: string; name: string; subName: string; image: string | null };
        content: string;
        experienceContent?: ExperienceContent[];
        tags: string[];
        images: string[];
      } | undefined;
      if (expPost) {
        const expProduct = expPost.product
          ? {
              id: expPost.product.id,
              name: expPost.product.name,
              subName: expPost.product.group?.name ?? '',
              image: resolveMediaUrl(expPost.product.imageUrl) ?? null,
            }
          : { id: expPost.productId || '', name: '', subName: '', image: null as string | null };
        const expContent = this.parseExperienceContentFromPost(expPost.body);
        const expContentString =
          expContent.length > 0
            ? expContent
                .map((item) => `${item.title}: ${item.content}${item.rating ? ` (${item.rating}/5)` : ''}`)
                .join('\n\n')
            : expPost.body || '';
        relatedPost = {
          id: expPost.id,
          product: expProduct,
          content: expContentString,
          experienceContent: expContent,
          tags: (expPost.contentPostTags || []).map((cpt: { tag: string }) => cpt.tag).filter(Boolean),
          images: [], // experience post görselleri ayrı sorgulanabilir; reviews’ta opsiyonel
        };
      }

      results.push({
        id: post.id,
        type: 'update' as const,
        user: userBase,
        stats,
        createdAt: post.createdAt.toISOString(),
        contextType: ContextType.PRODUCT,
        contextData,
        content: updateText,
        experienceContent: updateOwnContent,
        relatedPost,
        tags,
        images,
      });
    }

    // Tüm sonuçları tarihe göre sırala
    results.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return String(a.id).localeCompare(String(b.id));
    });

    // Cursor ve pagination
    let filteredResults = results;
    if (cursor) {
      const cursorIndex = results.findIndex((r) => r.id === cursor);
      if (cursorIndex >= 0) {
        filteredResults = results.slice(cursorIndex + 1);
      }
    }

    const hasMore = filteredResults.length > limit;
    const paginatedResults = hasMore ? filteredResults.slice(0, limit) : filteredResults;
    const nextCursor = hasMore && paginatedResults.length > 0 
      ? paginatedResults[paginatedResults.length - 1].id 
      : undefined;

    return {
      items: paginatedResults,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  private parseExperienceContentFromPost(body: string): ExperienceContent[] {
    const content: ExperienceContent[] = [];
    
    if (!body) {
      return [
        {
          title: 'Product and Usage Experience',
          content: '',
          rating: 0,
        },
      ];
    }

    // Parse experience content from body
    // Format: [type] content (Rating: X/5)
    const priceRegex = /\[price_and_shopping\]\s*(.+?)\s*\(Rating:\s*(\d+)\/5\)/is;
    const usageRegex = /\[product_and_usage\]\s*(.+?)\s*\(Rating:\s*(\d+)\/5\)/is;

    const priceMatch = body.match(priceRegex);
    const usageMatch = body.match(usageRegex);

    if (priceMatch) {
      content.push({
        title: 'Price and Shopping Experience',
        content: priceMatch[1].trim(),
        rating: parseInt(priceMatch[2], 10),
      });
    }

    if (usageMatch) {
      content.push({
        title: 'Product and Usage Experience',
        content: usageMatch[1].trim(),
        rating: parseInt(usageMatch[2], 10),
      });
    }

    // Eğer hiçbir match yoksa, body'yi genel content olarak kullan
    if (content.length === 0) {
      content.push({
        title: 'Product and Usage Experience',
        content: body.trim(),
        rating: 0,
      });
    }

    return content;
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
  ): Promise<PaginatedResult<FeedItem>> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const whereClause: {
      userId: string;
      type: 'COMPARE';
      id?: { lt: string };
    } = { userId, type: 'COMPARE' };
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
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const userBase = await this.getUserBase(userId);
    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedSet = new Set(inventories.map((i) => String(i.productId)));

    type PostWithComparison = typeof posts[0] & { comparison: unknown };
    const filteredPosts = posts.filter((p): p is PostWithComparison => 'comparison' in p && p.comparison !== null);
    const hasMore = filteredPosts.length > limit;
    const paginatedPosts = hasMore ? filteredPosts.slice(0, limit) : filteredPosts;

    const results = await Promise.all(
      paginatedPosts.map(async (post) => {
        const comp = (post as PostWithComparison).comparison;
        if (!comp || typeof comp !== 'object') {
          throw new Error('Comparison not found');
        }
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
  ): Promise<PaginatedResult<FeedItem>> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const whereClause: Prisma.ContentPostWhereInput = {
      userId,
      type: ContentPostType.TIPS,
      ...(cursor ? { id: { lt: cursor } } : {}),
    };

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
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const userBase = await this.getUserBase(userId);
    const ownedProducts = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedProductIds = new Set(ownedProducts.map((inv) => String(inv.productId)));

    // Batch fetch images from PostMedia
    const postIds = posts.map((p) => p.id);
    const postMediaMap = new Map<string, string[]>();

    if (postIds.length > 0) {
      const allPostMedia = await this.prisma.postMedia.findMany({
        where: {
          postId: { in: postIds },
        },
        orderBy: { orderIndex: 'asc' },
        select: { postId: true, mediaUrl: true },
      });

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

    // Benefit category mapping
    const benefitMap: Record<string, { title: string; icon: string }> = {
      time_saving: { title: 'Zaman Kazandırır', icon: 'clock' },
      energy_efficiency: { title: 'Enerji Tasarrufu', icon: 'bolt' },
      durability: { title: 'Daha Dayanıklı', icon: 'shield' },
      better_result: { title: 'Daha İyi Sonuç', icon: 'star' },
    };

    const results = await Promise.all(
      posts.map(async (post) => {
        const stats = await this.getPostStats(String(post.id));
        const contextType = this.mapContextType(post);
        const contextData = await this.buildContextDataFromPost(post, ownedProductIds);
        const images = postMediaMap.get(post.id) || [];
        const tip = post.tip;
        const benefitCategory = tip?.tipCategory;
        
        return {
          id: String(post.id),
          type: 'tipsAndTricks' as const,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType,
          contextData,
          benefit: benefitCategory && benefitMap[benefitCategory] 
            ? benefitMap[benefitCategory] 
            : { title: 'Fayda', icon: 'lightbulb' },
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

  async getUserReplies(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<PaginatedResult<FeedItem>> {
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
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const userBase = await this.getUserBase(userId);
    const ownedProducts = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedProductIds = new Set(ownedProducts.map((inv) => String(inv.productId)));

    const results = await Promise.all(
      comments.map(async (comment) => {
        const stats = await this.getPostStats(String(comment.postId));
        const commentPost = comment.post;
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
  ): Promise<PaginatedResult<Record<string, unknown>>> {
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
      const badge = ub.badge;
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
  ): Promise<PaginatedResult<FeedItem>> {
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
            comparison: { include: { product1: true, product2: true } },
            tip: true,
            question: true,
            contentPostTags: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(favoriteCursorId && {
        cursor: { id: favoriteCursorId },
        skip: 1,
      }),
    });

    // Post'lardaki unique userId'leri topla
    const postUserIds = [...new Set(favorites.map((f) => String(f.post?.userId)).filter(Boolean))];

    // User bilgilerini toplu çek
    const users = await Promise.all(
      postUserIds.map(async (uid) => {
        const [profile, avatar, title] = await Promise.all([
          this.profileRepo.findByUserId(uid),
          this.prisma.userAvatar.findFirst({ where: { userId: uid, isActive: true } }),
          this.prisma.userTitle.findFirst({ where: { userId: uid }, orderBy: { earnedAt: 'desc' } }),
        ]);
        return {
          userId: uid,
          userBase: {
            id: uid,
            name: profile?.displayName || 'Anonymous',
            title: title?.title || '',
            avatar: resolveMediaUrl(avatar?.imageUrl ?? null, true) || '',
          },
        };
      })
    );

    const userBaseMap = new Map(users.map((u) => [u.userId, u.userBase]));

    // User'ın sahip olduğu product'ları çek (benchmark için)
    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedSet = new Set(inventories.map((i) => String(i.productId)));

    const hasMoreFavorites = favorites.length > limit;
    const paginatedFavorites = hasMoreFavorites ? favorites.slice(0, limit) : favorites;

    const results: FeedItem[] = [];

    for (const fav of paginatedFavorites) {
      const post = fav.post;
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
      const contextData = await this.buildContextDataFromPost(post, ownedSet);

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
          type PostWithComparison = typeof post & { comparison?: unknown };
          const comp = (post as PostWithComparison).comparison;
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
          const tags = await this.prisma.postTag.findMany({ where: { postId: String(post.id) } });
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
          const question = post.question;
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

        case 'EXPERIENCE':
        case 'UPDATE': {
          // Experience/Update: feed ve profil ile aynı yapı
          const product = contextData
            ? { ...contextData, isOwned: contextData.isOwned ?? ownedSet.has(String(post.productId)) }
            : { id: post.productId || '', name: '', subName: '', image: null, isOwned: false };
          const experienceContent = this.parseExperienceContentFromBody(post.body);
          const contentString =
            experienceContent.length > 0
              ? experienceContent
                  .map((item) => `${item.title}: ${item.content}${item.rating ? ` (${item.rating}/5)` : ''}`)
                  .join('\n\n')
              : post.body || '';
          const postTags = post.contentPostTags?.map((t: { tag: string }) => t.tag) || [];
          const status = post.productStatus === 'own' || post.productStatus === 'tried' ? post.productStatus : null;
          const statusLabel = post.productStatus === 'own' ? 'I owned' : post.productStatus === 'tried' ? 'I tried' : null;
          results.push({
            id: String(post.id),
            type: 'experience' as const,
            user: userBase,
            stats,
            createdAt: post.createdAt.toISOString(),
            contextType,
            product,
            content: contentString,
            experienceContent,
            tags: postTags,
            images: [],
            status: status ?? undefined,
            statusLabel: statusLabel ?? undefined,
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

  private buildContextDataFromInventory(inventory: InventoryLike) {
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
    const imageUrl = resolveMediaUrl(imagePath);

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
      where: { productId },
      select: { id: true },
    });
    if (!posts.length) {
      return [];
    }

    const tags = await this.prisma.contentPostTag.findMany({
      where: { postId: { in: posts.map((p) => String(p.id)) } },
    });

    return tags.map((t) => t.tag);
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
  ): Promise<PaginatedResult<FeedItem>> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;
    const requestedTypes = options?.types?.length
      ? Array.from(new Set(options.types))
      : PROFILE_FEED_CARD_TYPES;

    // Her kaynak için limit+1 çekiyoruz ki hasMore hesaplanabilsin
    const perSourceLimit = limit + 1;

    // Timeout koruması ile fetcher'ları oluştur
    const createFetcherWithTimeout = (fetcher: Promise<PaginatedResult<FeedItem> | FeedItem[]>, timeoutMs: number = 8000) => {
      return Promise.race([
        fetcher,
        new Promise<{ items: FeedItem[] }>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
        )
      ]).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Feed fetcher timeout or error: ${message}`);
        return { items: [] as FeedItem[] }; // Timeout durumunda boş array döndür
      });
    };

    const fetchers = requestedTypes.map((cardType) => {
      let fetcher: Promise<PaginatedResult<FeedItem> | FeedItem[]>;
      switch (cardType) {
        case 'feed':
          fetcher = this.getUserReviews(userId, { limit: perSourceLimit });
          break;
        case 'benchmark':
          fetcher = this.getUserBenchmarks(userId, { limit: perSourceLimit });
          break;
        case 'tipsAndTricks':
          fetcher = this.getUserTips(userId, { limit: perSourceLimit });
          break;
        case 'question':
          fetcher = this.getUserReplies(userId, { limit: perSourceLimit });
          break;
        case 'experience':
          fetcher = this.getUserReviews(userId, { limit: perSourceLimit });
          break;
        case 'update':
          fetcher = this.getUserUpdates(userId, { limit: perSourceLimit });
          break;
        case 'post':
        default:
          fetcher = this.getUserPosts(userId, { limit: perSourceLimit });
          break;
      }
      return createFetcherWithTimeout(fetcher, 8000);
    });

    const chunks = await Promise.all(fetchers);
    const merged = chunks.flatMap((chunk) => {
      if (chunk && 'items' in chunk && Array.isArray(chunk.items)) {
        return chunk.items as FeedItem[];
      }
      if (Array.isArray(chunk)) {
        return chunk as FeedItem[];
      }
      return [] as FeedItem[];
    });

    const resolveTimestamp = (item: FeedItem): number => {
      const value = item?.createdAt;
      return value ? new Date(value as string).getTime() : 0;
    };

    const sortKey = (item: FeedItem) => ({
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
      includeTabs?: Array<'feed' | 'reviews' | 'benchmarks' | 'tips' | 'replies'>;
      limit?: number;
    }
  ): Promise<{
    profileCard: Awaited<ReturnType<UserService['getUserProfileCard']>> | null;
    tabs: {
      feed?: FeedItem[];
      reviews?: FeedItem[];
      benchmarks?: FeedItem[];
      tips?: FeedItem[];
      replies?: FeedItem[];
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
      const cached = await this.cacheService.get<{
        profileCard: Awaited<ReturnType<UserService['getUserProfileCard']>> | null;
        tabs: { feed?: FeedItem[]; reviews?: FeedItem[]; benchmarks?: FeedItem[]; tips?: FeedItem[]; replies?: FeedItem[] };
        meta: { cached: boolean; timestamp: string };
      }>(cacheKey);
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
    const promises: Promise<unknown>[] = [];

    if (includeProfileCard) {
      promises.push(this.getUserProfileCard(userId));
    }

    type TabResult = FeedItem[] | PaginatedResult<FeedItem>;
    const tabPromises: Promise<TabResult>[] = [];
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

    promises.push(...tabPromises);

    const results = await Promise.all(promises);

    const extractItems = (result: unknown): FeedItem[] => {
      if (result && typeof result === 'object' && 'items' in result && Array.isArray((result as { items: unknown }).items)) {
        return (result as { items: FeedItem[] }).items;
      }
      if (Array.isArray(result)) {
        return result as FeedItem[];
      }
      return [];
    };

    let tabIndex = includeProfileCard ? 1 : 0;
    const response = {
      profileCard: includeProfileCard
        ? (results[0] as Awaited<ReturnType<UserService['getUserProfileCard']>>)
        : null,
      tabs: {
        feed: includeTabs.includes('feed')
          ? extractItems(results[tabIndex++]).slice(0, limit)
          : undefined,
        reviews: includeTabs.includes('reviews')
          ? extractItems(results[tabIndex++]).slice(0, limit)
          : undefined,
        benchmarks: includeTabs.includes('benchmarks')
          ? extractItems(results[tabIndex++]).slice(0, limit)
          : undefined,
        tips: includeTabs.includes('tips')
          ? extractItems(results[tabIndex++]).slice(0, limit)
          : undefined,
        replies: includeTabs.includes('replies')
          ? extractItems(results[tabIndex++]).slice(0, limit)
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

      // Gamification: PROFILE_COMPLETE tracking (fire-and-forget)
      this.actionLogService
        .logAction({
          userId,
          mainAction: MainAction.SYSTEM,
          actionTypeCode: 'PROFILE_COMPLETE',
          entityType: 'profile',
          entityId: userId,
          metadata: { userName: data.userName, categoriesSelected: data.selectedCategories?.length ?? 0 },
        })
        .catch((err) => {
          logger.warn('Failed to log PROFILE_COMPLETE action', { userId, error: getErrorMessage(err) });
        });

      this.achievementProgressService
        .incrementProgressByCode(userId, MainAction.SYSTEM, 'PROFILE_COMPLETE', 1)
        .catch((err) => {
          logger.warn('Failed to increment PROFILE_COMPLETE progress', { userId, error: getErrorMessage(err) });
        });

      return updatedUser;
    });
  }

  /**
   * Username validasyonu ve müsaitlik kontrolü
   * @param userName - Kontrol edilecek username
   * @param currentUserId - Mevcut kullanıcı ID'si (opsiyonel, kendi username'ini kontrol ederken kullanılır)
   * @returns Username'in geçerliliği ve müsaitlik durumu
   */
  async checkUsernameAvailability(
    userName: string,
    currentUserId?: string
  ): Promise<{
    isValid: boolean;
    isAvailable: boolean;
    message?: string;
  }> {
    // Username format validasyonu
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    const minLength = 3;
    const maxLength = 30;

    // Boş kontrolü
    if (!userName || userName.trim().length === 0) {
      return {
        isValid: false,
        isAvailable: false,
        message: 'Kullanıcı adı boş olamaz',
      };
    }

    // Uzunluk kontrolü
    if (userName.length < minLength) {
      return {
        isValid: false,
        isAvailable: false,
        message: `Username must be at least ${minLength} characters long`,
      };
    }

    if (userName.length > maxLength) {
      return {
        isValid: false,
        isAvailable: false,
        message: `Username can be at most ${maxLength} characters long`,
      };
    }

    // Format kontrolü
    if (!usernameRegex.test(userName)) {
      return {
        isValid: false,
        isAvailable: false,
        message: 'Username can only contain letters, numbers and underscore (_)',
      };
    }

    // Müsaitlik kontrolü
    const existingProfile = await this.profileRepo.findByUserName(userName);
    
    // Eğer kullanıcı kendi username'ini kontrol ediyorsa, müsait sayılır
    if (existingProfile && currentUserId && existingProfile.userId === currentUserId) {
      return {
        isValid: true,
        isAvailable: true,
      };
    }

    // Başka bir kullanıcı tarafından kullanılıyorsa
    if (existingProfile) {
      return {
        isValid: true,
        isAvailable: false,
        message: 'This username is already in use',
      };
    }

    return {
      isValid: true,
      isAvailable: true,
    };
  }

  /**
   * Username önerileri oluşturur (Instagram benzeri)
   * @param baseUsername - Temel username
   * @param limit - Öneri sayısı (varsayılan: 5)
   * @returns Önerilen username'ler listesi
   */
  async suggestUsernames(
    baseUsername: string,
    limit: number = 5
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const cleanBase = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (cleanBase.length === 0) {
      return suggestions;
    }

    // Öneri stratejileri
    const strategies = [
      // 1. Base + sayılar (1-999)
      (base: string) => {
        const results: string[] = [];
        for (let i = 1; i <= 999 && results.length < limit; i++) {
          const candidate = `${base}${i}`;
          if (candidate.length <= 30) {
            results.push(candidate);
          }
        }
        return results;
      },
      // 2. Base + underscore + sayılar
      (base: string) => {
        const results: string[] = [];
        for (let i = 1; i <= 99 && results.length < limit; i++) {
          const candidate = `${base}_${i}`;
          if (candidate.length <= 30) {
            results.push(candidate);
          }
        }
        return results;
      },
      // 3. Base + random sayılar (2-3 haneli)
      (base: string) => {
        const results: string[] = [];
        const usedNumbers = new Set<number>();
        while (results.length < limit) {
          const num = Math.floor(Math.random() * 900) + 100; // 100-999
          if (!usedNumbers.has(num)) {
            usedNumbers.add(num);
            const candidate = `${base}${num}`;
            if (candidate.length <= 30) {
              results.push(candidate);
            }
          }
          if (usedNumbers.size > 100) break; // Infinite loop önleme
        }
        return results;
      },
      // 4. Base'in sonuna "real", "official" gibi ekler
      (base: string) => {
        const suffixes = ['real', 'official', 'official_', 'the'];
        const results: string[] = [];
        for (const suffix of suffixes) {
          const candidate = `${base}${suffix}`;
          if (candidate.length <= 30 && results.length < limit) {
            results.push(candidate);
          }
        }
        return results;
      },
      // 5. Base'in başına sayı ekle
      (base: string) => {
        const results: string[] = [];
        for (let i = 1; i <= 9 && results.length < limit; i++) {
          const candidate = `${i}${base}`;
          if (candidate.length <= 30) {
            results.push(candidate);
          }
        }
        return results;
      },
    ];

    // Her stratejiyi dene ve müsait olanları topla
    for (const strategy of strategies) {
      const candidates = strategy(cleanBase);
      for (const candidate of candidates) {
        if (suggestions.length >= limit) break;
        
        // Format kontrolü
        if (!/^[a-zA-Z0-9_]+$/.test(candidate) || candidate.length < 3 || candidate.length > 30) {
          continue;
        }

        // Müsaitlik kontrolü
        const existingProfile = await this.profileRepo.findByUserName(candidate);
        if (!existingProfile) {
          suggestions.push(candidate);
        }
      }
      if (suggestions.length >= limit) break;
    }

    // Eğer yeterli öneri yoksa, random sayılarla doldur
    if (suggestions.length < limit) {
      const usedNumbers = new Set<number>();
      while (suggestions.length < limit) {
        const num = Math.floor(Math.random() * 10000); // 0-9999
        if (!usedNumbers.has(num)) {
          usedNumbers.add(num);
          const candidate = `${cleanBase}${num}`;
          if (candidate.length <= 30) {
            const existingProfile = await this.profileRepo.findByUserName(candidate);
            if (!existingProfile) {
              suggestions.push(candidate);
            }
          }
        }
        if (usedNumbers.size > 1000) break; // Infinite loop önleme
      }
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Kullanıcı kayıt için kategori ve sub-kategori listesini getir
   * Her kategori için dinamik olarak en fazla 10 sub-kategori döner
   * @returns Kategori listesi ve her kategorinin en fazla 10 sub-kategorisi
   */
  async getUserCategories(): Promise<Array<{
    categoryId: string;
    name: string;
    subCategories: Array<{
      subCategoryId: string;
      name: string;
    }>;
  }>> {
    // Ana kategorileri getir (level = 0)
    const mainCategories = await this.prisma.category.findMany({
      where: {
        level: 0,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Her kategori için en fazla 10 sub-kategoriyi getir
    const result = await Promise.all(
      mainCategories.map(async (category) => {
        // Sub-kategorileri getir (level = 1, parentId = category.id)
        // Alfabetik sıralama ile ilk 10'u al
        const subCategories = await this.prisma.category.findMany({
          where: {
            parentId: category.id,
            level: 1,
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: 'asc',
          },
          take: 10, // En fazla 10 sub-kategori
        });

        return {
          categoryId: category.id,
          name: category.name,
          subCategories: subCategories.map((sub) => ({
            subCategoryId: sub.id,
            name: sub.name,
          })),
        };
      })
    );

    return result;
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
      // Sadece passwordHash'i çek (profile ve wallets include etme - performans için)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true },
      });

      if (!user || !user.passwordHash) {
        return {
          success: false,
          message: 'User not found or password not set',
        };
      }

      // Mevcut şifreyi kontrol et
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      
      // Debug log (production'da kaldırılabilir)
      logger.debug({
        message: 'Password comparison result',
        userId,
        passwordHashExists: !!user.passwordHash,
        passwordHashLength: user.passwordHash?.length,
        isValidPassword,
      });
      
      if (!isValidPassword) {
        logger.warn({
          message: 'Password change failed - incorrect current password',
          userId,
        });
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
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

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
   * Hem kanal ayarlarını (EMAIL, PUSH, IN_APP) hem de kategori ayarlarını döndürür
   */
  async getNotificationSettings(userId: string): Promise<{
    channels: Array<{
      notificationCode: NotificationCode;
      value: boolean;
    }>;
    categories: {
      trustNotifications: boolean;
      supportNotifications: boolean;
      messageNotifications: boolean;
      collectionNotifications: boolean;
      postNotifications: boolean;
      nftNotifications: boolean;
      rewardNotifications: boolean;
      transactionNotifications: boolean;
      walletNotifications: boolean;
      gamificationNotifications: boolean;
      expertNotifications: boolean;
      eventNotifications: boolean;
      systemNotifications: boolean;
    };
    global: {
      receiveNotifications: boolean | null;
    };
  }> {
    let settings = await this.settingsRepo.findByUserId(userId);
    if (!settings) {
      // Kullanıcının veritabanında var olup olmadığını kontrol et
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Default settings oluştur
      settings = await this.settingsRepo.create(userId);
    }

    return {
      channels: [
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
      ],
      categories: {
        trustNotifications: settings.trustNotifications,
        supportNotifications: settings.supportNotifications,
        messageNotifications: settings.messageNotifications,
        collectionNotifications: settings.collectionNotifications,
        postNotifications: settings.postNotifications,
        nftNotifications: settings.nftNotifications,
        rewardNotifications: settings.rewardNotifications,
        transactionNotifications: settings.transactionNotifications,
        walletNotifications: settings.walletNotifications,
        gamificationNotifications: settings.gamificationNotifications,
        expertNotifications: settings.expertNotifications,
        eventNotifications: settings.eventNotifications,
        systemNotifications: settings.systemNotifications,
      },
      global: {
        receiveNotifications: settings.receiveNotifications,
      },
    };
  }

  /**
   * Update Notification Settings - Kullanıcının bildirim ayarlarını günceller
   * Hem kanal ayarlarını (EMAIL, PUSH, IN_APP) hem de kategori ayarlarını güncelleyebilir
   */
  async updateNotificationSettings(
    userId: string,
    settings: Array<{
      notificationCode?: NotificationCode;
      value?: boolean;
    }> | {
      channels?: Array<{
        notificationCode: NotificationCode;
        value: boolean;
      }>;
      categories?: {
        trustNotifications?: boolean;
        supportNotifications?: boolean;
        messageNotifications?: boolean;
        collectionNotifications?: boolean;
        postNotifications?: boolean;
        nftNotifications?: boolean;
        rewardNotifications?: boolean;
        transactionNotifications?: boolean;
        walletNotifications?: boolean;
        gamificationNotifications?: boolean;
        expertNotifications?: boolean;
        eventNotifications?: boolean;
        systemNotifications?: boolean;
      };
      global?: {
        receiveNotifications?: boolean | null;
      };
    }
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
        trustNotifications?: boolean;
        supportNotifications?: boolean;
        messageNotifications?: boolean;
        collectionNotifications?: boolean;
        postNotifications?: boolean;
        nftNotifications?: boolean;
        rewardNotifications?: boolean;
        transactionNotifications?: boolean;
        walletNotifications?: boolean;
        gamificationNotifications?: boolean;
        expertNotifications?: boolean;
        eventNotifications?: boolean;
        systemNotifications?: boolean;
        receiveNotifications?: boolean;
      } = {};

      // Backward compatibility: Eğer array formatında gelirse (eski format)
      if (Array.isArray(settings)) {
        for (const setting of settings) {
          if (setting.notificationCode !== undefined && setting.value !== undefined) {
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
        }
      } else {
        // Yeni format: object with channels, categories, global
        if (settings.channels) {
          for (const channel of settings.channels) {
            switch (channel.notificationCode) {
              case NotificationCode.EMAIL:
                updateData.notificationEmailEnabled = channel.value;
                break;
              case NotificationCode.PUSH:
                updateData.notificationPushEnabled = channel.value;
                break;
              case NotificationCode.IN_APP:
                updateData.notificationInAppEnabled = channel.value;
                break;
            }
          }
        }

        if (settings.categories) {
          if (settings.categories.trustNotifications !== undefined) {
            updateData.trustNotifications = settings.categories.trustNotifications;
          }
          if (settings.categories.supportNotifications !== undefined) {
            updateData.supportNotifications = settings.categories.supportNotifications;
          }
          if (settings.categories.messageNotifications !== undefined) {
            updateData.messageNotifications = settings.categories.messageNotifications;
          }
          if (settings.categories.collectionNotifications !== undefined) {
            updateData.collectionNotifications = settings.categories.collectionNotifications;
          }
          if (settings.categories.postNotifications !== undefined) {
            updateData.postNotifications = settings.categories.postNotifications;
          }
          if (settings.categories.nftNotifications !== undefined) {
            updateData.nftNotifications = settings.categories.nftNotifications;
          }
          if (settings.categories.rewardNotifications !== undefined) {
            updateData.rewardNotifications = settings.categories.rewardNotifications;
          }
          if (settings.categories.transactionNotifications !== undefined) {
            updateData.transactionNotifications = settings.categories.transactionNotifications;
          }
          if (settings.categories.walletNotifications !== undefined) {
            updateData.walletNotifications = settings.categories.walletNotifications;
          }
          if (settings.categories.gamificationNotifications !== undefined) {
            updateData.gamificationNotifications = settings.categories.gamificationNotifications;
          }
          if (settings.categories.expertNotifications !== undefined) {
            updateData.expertNotifications = settings.categories.expertNotifications;
          }
          if (settings.categories.eventNotifications !== undefined) {
            updateData.eventNotifications = settings.categories.eventNotifications;
          }
          if (settings.categories.systemNotifications !== undefined) {
            updateData.systemNotifications = settings.categories.systemNotifications;
          }
        }

        if (settings.global) {
          if (settings.global.receiveNotifications !== undefined && settings.global.receiveNotifications !== null) {
            updateData.receiveNotifications = settings.global.receiveNotifications;
          }
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
    const settingResult = await this.privacySettingRepo.findByUserId(userId);
    // Wrap single result in array for iteration (repo returns single or null)
    const settings = settingResult ? [settingResult] : [];

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
      const setting = settings.find((s) => s.privacyCode === privacyCode);
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
   * Get Suggested Users - Trust edilmemiş kullanıcılardan öneriler getirir
   * Pagination, search ve mutual trust count desteği ile
   */
  async getSuggestedUsers(
    userId: string,
    options?: {
      cursor?: string;
      limit?: number;
      searchQuery?: string;
    }
  ): Promise<{
    items: Array<{
      id: string;
      userName: string | null;
      name: string | null;
      avatar: string | null;
      titles: string[];
      isTrusted: boolean;
      mutualTrustCount: number;
      stats: {
        posts: number;
        trust: number;
        truster: number;
      };
    }>;
    pagination: {
      nextCursor: string | null;
      hasMore: boolean;
    };
  }> {
    const limit = Math.min(options?.limit || 20, 50);
    const searchQuery = options?.searchQuery?.trim();
    const cursor = options?.cursor;

    // Kullanıcının trust ettiği kişilerin ID'lerini al
    const trustedRelations = await this.prisma.trustRelation.findMany({
      where: { trusterId: userId },
      select: { trustedUserId: true },
    });
    const trustedUserIds = trustedRelations.map(r => r.trustedUserId);

    // Kullanıcının kendisini ve engellediği/mute ettiği kişileri hariç tut
    const [blockedUsers, mutedUsers] = await Promise.all([
      this.prisma.userBlock.findMany({
        where: { blockerId: userId },
        select: { blockedUserId: true },
      }),
      this.prisma.userMute.findMany({
        where: { muterId: userId },
        select: { mutedUserId: true },
      }),
    ]);

    const excludedUserIds = [
      userId,
      ...trustedUserIds,
      ...blockedUsers.map(b => b.blockedUserId),
      ...mutedUsers.map(m => m.mutedUserId),
    ];

    // Where clause oluştur
    const whereClause: Prisma.ProfileWhereInput = {
      userId: {
        notIn: excludedUserIds,
        ...(cursor ? { lt: cursor } : {}),
      },
      user: { ...NOT_SYSTEM_USER },
      displayName: {
        not: null,
      },
      ...(searchQuery ? {
        OR: [
          { displayName: { contains: searchQuery, mode: 'insensitive' as const } },
          { userName: { contains: searchQuery, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    // Trust edilmemiş kullanıcıları getir (limit + 1 ile hasMore kontrolü)
    const profiles = await this.prisma.profile.findMany({
      where: whereClause,
      take: limit + 1, // Bir fazla çek hasMore için
      select: {
        userId: true,
        displayName: true,
        userName: true,
        postsCount: true,
        trustCount: true,
        trusterCount: true,
      },
      orderBy: [
        { trusterCount: 'desc' }, // Popüler kullanıcıları önce getir
        { postsCount: 'desc' },
        { userId: 'desc' }, // Consistent ordering için
      ],
    });

    // HasMore kontrolü
    const hasMore = profiles.length > limit;
    const paginatedProfiles = hasMore ? profiles.slice(0, limit) : profiles;
    const nextCursor = hasMore && paginatedProfiles.length > 0 
      ? paginatedProfiles[paginatedProfiles.length - 1].userId 
      : null;

    const userIds = paginatedProfiles.map(p => p.userId);

    // Avatar, title ve mutual trust bilgilerini paralel çek
    const [avatars, titles, mutualTrustCounts] = await Promise.all([
      this.prisma.userAvatar.findMany({
        where: {
          userId: { in: userIds },
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['userId'],
      }),
      this.prisma.userTitle.findMany({
        where: { userId: { in: userIds } },
        orderBy: { earnedAt: 'desc' },
      }),
      // Mutual trust count: Suggested user'ın trust ettiği kişilerden
      // kaç tanesini current user da trust ediyor
      Promise.all(
        userIds.map(async (suggestedUserId) => {
          const suggestedUserTrusts = await this.prisma.trustRelation.findMany({
            where: { trusterId: suggestedUserId },
            select: { trustedUserId: true },
          });
          const suggestedUserTrustIds = suggestedUserTrusts.map(t => t.trustedUserId);
          
          // Ortak trust sayısı
          const mutualCount = trustedUserIds.filter(id => 
            suggestedUserTrustIds.includes(id)
          ).length;
          
          return { userId: suggestedUserId, count: mutualCount };
        })
      ),
    ]);

    // Avatar, title ve mutual trust'ları map'e çevir
    const avatarMap = new Map(avatars.map(a => [a.userId, a.imageUrl]));
    const titlesByUser = titles.reduce((acc, t) => {
      if (!acc[t.userId]) acc[t.userId] = [];
      if (acc[t.userId].length < 5) acc[t.userId].push(t.title);
      return acc;
    }, {} as Record<string, string[]>);
    const mutualTrustMap = new Map(mutualTrustCounts.map(m => [m.userId, m.count]));

    // Sonuçları oluştur
    const items = paginatedProfiles.map(profile => ({
      id: profile.userId,
      userName: profile.userName,
      name: profile.displayName,
      avatar: resolveMediaUrl(avatarMap.get(profile.userId) ?? null, true),
      titles: titlesByUser[profile.userId] || [],
      isTrusted: false, // Zaten exclude listesinde oldukları için false
      mutualTrustCount: mutualTrustMap.get(profile.userId) || 0,
      stats: {
        posts: profile.postsCount,
        trust: profile.trustCount,
        truster: profile.trusterCount,
      },
    }));

    return {
      items,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
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

  /**
   * EP-01: Get user's badges separated by type (achievement/bridge) with pagination
   */
  async getUserBadgesWithCategories(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    const where: {
      userId: string;
      claimed: boolean;
      id?: { lt: string };
    } = {
      userId,
      claimed: true, // Only show claimed badges
    };

    if (cursor) {
      where.id = { lt: cursor }; // Cursor pagination
    }

    const userBadges = await this.prisma.userBadge.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Take one extra to check hasMore
    });

    const hasMore = userBadges.length > limit;
    const items = hasMore ? userBadges.slice(0, limit) : userBadges;

    // Separate by category
    const brandBadges: Array<{
      id: string;
      title: string;
      image: string | null;
      rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
      isClaimed: boolean;
      nftAddress: string | null;
      totalEarned: number;
      earnedDate: string | null;
      tasks: Array<{
        id: string;
        title: string;
        type: 'Comment' | 'Like' | 'Share';
        current: number;
        total: number;
        isCompleted: boolean;
      }>;
    }> = [];
    const achievementBadges: Array<{
      id: string;
      title: string;
      image: string | null;
      rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
      isClaimed: boolean;
      nftAddress: string | null;
      totalEarned: number;
      earnedDate: string | null;
      tasks: Array<{
        id: string;
        title: string;
        type: 'Comment' | 'Like' | 'Share';
        current: number;
        total: number;
        isCompleted: boolean;
      }>;
    }> = [];

    for (const ub of items) {
      const category = BadgeResponseMapper.mapBadgeCategory(ub.badge.type);

      // Get total earned count
      const totalEarned = await this.prisma.userBadge.count({
        where: { badgeId: ub.badgeId, claimed: true },
      });

      const badgeItem = {
        id: ub.badgeId,
        title: ub.badge.name,
        image: resolveMediaUrl(ub.badge.imageUrl ?? null),
        rarity: BadgeResponseMapper.mapRarity(ub.badge.rarity),
        isClaimed: ub.claimed,
        nftAddress: null, // EP-04 skipped
        totalEarned,
        earnedDate: ub.createdAt.toISOString(),
        tasks: ub.badge.achievementGoals.map((goal) =>
          BadgeResponseMapper.toTaskProgress(goal, goal.userAchievements[0]),
        ),
      };

      if (category === 'bridge') {
        brandBadges.push(badgeItem);
      } else {
        achievementBadges.push(badgeItem);
      }
    }

    return {
      brand: { items: brandBadges },
      achievement: { items: achievementBadges },
      pagination: {
        cursor: hasMore ? items[items.length - 1].id : null,
        hasMore,
        limit,
      },
    };
  }

  /**
   * EP-03: Get badge detail with tasks
   */
  async getBadgeDetailWithTasks(badgeId: string, userId?: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId },
      include: {
        achievementGoals: {
          include: {
            userAchievements: userId
              ? {
                  where: { userId },
                }
              : false,
          },
        },
      },
    });

    if (!badge) {
      throw new NotFoundError('Badge not found');
    }

    const totalEarned = await this.prisma.userBadge.count({
      where: { badgeId, claimed: true },
    });

    const userBadge = userId
      ? await this.prisma.userBadge.findUnique({
          where: { userId_badgeId: { userId, badgeId } },
        })
      : null;

    return {
      id: badge.id,
      title: badge.name,
      image: resolveMediaUrl(badge.imageUrl ?? null),
      rarity: BadgeResponseMapper.mapRarity(badge.rarity),
      isClaimed: userBadge?.claimed ?? false,
      nftAddress: null, // EP-04 skipped
      totalEarned,
      earnedDate: userBadge?.createdAt.toISOString() ?? null,
      description: badge.description,
      tasks: badge.achievementGoals.map((goal) =>
        BadgeResponseMapper.toTaskProgress(
          goal,
          goal.userAchievements?.[0],
        ),
      ),
    };
  }

  /**
   * EP-05: Get highlight badge selection data
   */
  async getHighlightBadgeSelectionData(userId: string) {
    // Get all user badges (claimed or not)
    const allBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { createdAt: 'desc' },
    });

    // Get current highlights
    const currentHighlights = await this.prisma.userBadge.findMany({
      where: {
        userId,
        isVisible: true,
        displayOrder: { not: null, lte: 3 }, // 0-3 = 4 badges
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Separate by badge type
    type BadgeItem = {
      id: string;
      title: string;
      image: string | null;
      rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
    };
    const collectionBadges: BadgeItem[] = [];
    const eventBadges: BadgeItem[] = [];
    const cosmeticBadges: BadgeItem[] = [];
    const brandBadges: BadgeItem[] = [];

    for (const ub of allBadges) {
      const item: BadgeItem = {
        id: ub.badgeId,
        title: ub.badge.name,
        image: resolveMediaUrl(ub.badge.imageUrl ?? null),
        rarity: BadgeResponseMapper.mapRarity(ub.badge.rarity),
      };

      switch (ub.badge.type) {
        case 'COLLECTION':
          collectionBadges.push(item);
          break;
        case 'EVENT':
          eventBadges.push(item);
          break;
        case 'COSMETIC':
          cosmeticBadges.push(item);
          break;
        case 'BRAND':
          brandBadges.push(item);
          break;
      }
    }

    return {
      selectedBadgeIds: currentHighlights.map((ub) => ub.badgeId),
      availableBadges: {
        collection: collectionBadges,
        event: eventBadges,
        cosmetic: cosmeticBadges,
        brand: brandBadges,
      },
    };
  }

  /**
   * EP-06: Update highlight badges (max 4)
   */
  async updateHighlightBadges(userId: string, badgeIds: string[]) {
    if (badgeIds.length > 4) {
      throw new ValidationError('Maximum 4 highlight badges allowed');
    }

    // Validate all badges are owned by the user
    const ownedBadges = await this.prisma.userBadge.findMany({
      where: {
        userId,
        badgeId: { in: badgeIds },
      },
    });

    if (ownedBadges.length !== badgeIds.length) {
      throw new ValidationError('Some badges are not owned by the user');
    }

    await this.prisma.$transaction(async (tx) => {
      // Reset all badges
      await tx.userBadge.updateMany({
        where: { userId },
        data: { displayOrder: null, isVisible: false },
      });

      // Set highlight badges (0-3)
      for (const [index, badgeId] of badgeIds.entries()) {
        await tx.userBadge.updateMany({
          where: { userId, badgeId },
          data: {
            displayOrder: index,
            isVisible: true,
            visibility: 'PUBLIC',
          },
        });
      }
    });

    // Invalidate cache
    await this.cacheService.del(`user:${userId}:profile`);

    return { success: true, badgeIds };
  }

  /**
   * Belirtilen kullanıcının envanterini listele (public endpoint).
   */
  async getUserInventory(
    userId: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<{
    items: Array<{
      id: string;
      productId: string;
      brand: { name: string; model: string; specs: string };
      image: string | null;
      tags: string[];
    }>;
    pagination: { cursor: string | null; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    // Kullanıcının var olup olmadığını kontrol et
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { items: [], pagination: { cursor: null, hasMore: false, limit } };
    }

    const inventories = await this.prisma.inventory.findMany({
      where: { userId, hasOwned: true },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
        media: true,
      },
    });

    const hasMore = inventories.length > limit;
    const resultInventories = hasMore ? inventories.slice(0, limit) : inventories;

    const items = resultInventories.map((inv) => {
      const product = inv.product;
      const mediaList = (inv as unknown as { media: Array<{ mediaUrl: string | null }> }).media || [];
      let image: string | null = null;
      if (mediaList.length > 0 && mediaList[0].mediaUrl) {
        const mediaUrl = mediaList[0].mediaUrl;
        if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
          image = mediaUrl;
        } else {
          image = resolveMediaUrl(mediaUrl);
        }
      }

      const tags: string[] = [];
      const daysSinceCreated = Math.floor(
        (Date.now() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceCreated <= 7) {
        tags.push('Recent');
      }
      tags.push('Owned');

      return {
        id: inv.id,
        productId: inv.productId,
        brand: {
          name: product?.brand?.name || 'Unknown',
          model: product?.name || '',
          specs: product?.description || '',
        },
        image,
        tags,
      };
    });

    const lastItem = resultInventories[resultInventories.length - 1];

    return {
      items,
      pagination: {
        cursor: hasMore && lastItem ? lastItem.id : null,
        hasMore,
        limit,
      },
    };
  }
}